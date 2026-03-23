import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Push utilities
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function importVapidKeys() {
  const publicKeyB64 = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const privateKeyB64 = Deno.env.get('VAPID_PRIVATE_KEY')!;
  
  const privateKeyBytes = urlBase64ToUint8Array(privateKeyB64);
  const publicKeyBytes = urlBase64ToUint8Array(publicKeyB64);
  
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    await createPkcs8FromRaw(privateKeyBytes, publicKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  );
  
  return { privateKey, publicKeyBytes };
}

async function createPkcs8FromRaw(privateKeyRaw: Uint8Array, publicKeyRaw: Uint8Array): Promise<ArrayBuffer> {
  // Build PKCS8 wrapper for EC private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  
  const pkcs8Middle = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);
  
  const result = new Uint8Array(pkcs8Header.length + privateKeyRaw.length + pkcs8Middle.length + publicKeyRaw.length);
  result.set(pkcs8Header, 0);
  result.set(privateKeyRaw, pkcs8Header.length);
  result.set(pkcs8Middle, pkcs8Header.length + privateKeyRaw.length);
  result.set(publicKeyRaw, pkcs8Header.length + privateKeyRaw.length + pkcs8Middle.length);
  
  return result.buffer;
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createJWT(audience: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: 'mailto:admin@domofondar.kz',
  };
  
  const encodedHeader = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );
  
  // Convert DER signature to raw r||s
  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    // DER encoded
    const rLen = sigArray[3];
    const r = sigArray.slice(4, 4 + rLen);
    const sLen = sigArray[4 + rLen + 1];
    const s = sigArray.slice(4 + rLen + 2, 4 + rLen + 2 + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }
  
  return `${unsignedToken}.${base64urlEncode(rawSig.buffer)}`;
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKey: CryptoKey,
  vapidPublicKeyBytes: Uint8Array
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    
    const jwt = await createJWT(audience, vapidPrivateKey);
    const vapidPublicKeyB64 = base64urlEncode(vapidPublicKeyBytes.buffer);
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKeyB64}`,
      },
      body: new TextEncoder().encode(payload),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`Push failed ${response.status}: ${text}`);
      return false;
    }
    await response.text();
    return true;
  } catch (error) {
    console.error('Push error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_ids, title, body, url, data } = await req.json();
    
    if (!user_ids || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'user_ids, title, body required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get subscriptions for target users
    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', user_ids);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({ title, body, url: url || '/fsm', data });
    
    const { privateKey, publicKeyBytes } = await importVapidKeys();
    
    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        privateKey,
        publicKeyBytes
      );
      if (success) {
        sent++;
      } else {
        expiredEndpoints.push(sub.endpoint);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
