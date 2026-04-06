import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_VAPID_PUBLIC_KEY = 'BKnzAAYc68ghFIetuQXHvo4e2qRUzBmbrQ1xUs_GQsahkrVZd3JX3rCfxUnTah0rRwwzu6xNN-ibL5KoH6UdkSg';

const getEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
};

const sanitizeBase64Value = (value: string): string =>
  value
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\s+/g, "");

// ---- Web Push Encryption (RFC 8291 / aes128gcm) ----

function base64UrlDecode(str: string): Uint8Array {
  const sanitized = sanitizeBase64Value(str);
  // Replace URL-safe chars and add padding
  let base64 = sanitized.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buf);
  let b = '';
  for (const byte of bytes) b += String.fromCharCode(byte);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  // HKDF-Extract: PRK = HMAC-Hash(salt, IKM)
  const saltBuf = (salt.length ? salt : new Uint8Array(32)).buffer as ArrayBuffer;
  const saltKey = await crypto.subtle.importKey('raw', saltBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm.buffer as ArrayBuffer));
  
  // HKDF-Expand
  const prkKey = await crypto.subtle.importKey('raw', prk.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoWithCounter = concat(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, infoWithCounter.buffer as ArrayBuffer));
  return okm.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  const header = encoder.encode('WebPush: info\0');
  
  return concat(header, clientPublicKey, serverPublicKey);
}

async function encryptPayload(
  clientPublicKeyBytes: Uint8Array,
  clientAuthBytes: Uint8Array, 
  payload: string
): Promise<{ ciphertext: Uint8Array; serverPublicKeyBytes: Uint8Array; salt: Uint8Array }> {
  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw);
  
  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKey },
      serverKeyPair.privateKey,
      256
    )
  );
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // IKM info
  const ikmInfo = createInfo('', clientPublicKeyBytes, serverPublicKeyBytes);
  const ikm = await hkdf(clientAuthBytes, sharedSecret, ikmInfo, 32);
  
  // Content encryption key
  const encoder = new TextEncoder();
  const cekInfo = concat(encoder.encode('Content-Encoding: aes128gcm\0'));
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  
  // Nonce
  const nonceInfo = concat(encoder.encode('Content-Encoding: nonce\0'));
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  
  // Encrypt with AES-128-GCM
  // Payload needs padding: delimiter byte 0x02 then optional zeros
  const paddedPayload = concat(encoder.encode(payload), new Uint8Array([2]));
  
  const aesKey = await crypto.subtle.importKey('raw', cek.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer, tagLength: 128 },
    aesKey,
    paddedPayload
  );
  
  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);
  
  const header = concat(
    salt,
    new Uint8Array(rs.buffer),
    new Uint8Array([serverPublicKeyBytes.length]),
    serverPublicKeyBytes
  );
  
  const ciphertext = concat(header, new Uint8Array(encrypted));
  
  return { ciphertext, serverPublicKeyBytes, salt };
}

// ---- VAPID JWT ----

async function createVapidJwt(audience: string): Promise<{ jwt: string; publicKeyB64: string }> {
  const envPublicKeyB64 = sanitizeBase64Value(getEnv('VAPID_PUBLIC_KEY'));
  const privateKeyB64 = sanitizeBase64Value(getEnv('VAPID_PRIVATE_KEY'));

  const privateKeyBytes = base64UrlDecode(privateKeyB64);
  let publicKeyB64 = envPublicKeyB64;
  let publicKeyBytes: Uint8Array;

  try {
    publicKeyBytes = base64UrlDecode(envPublicKeyB64);
    if (publicKeyBytes.length !== 65) {
      throw new Error(`Unexpected VAPID public key length: ${publicKeyBytes.length}`);
    }
  } catch (error) {
    console.warn('Invalid VAPID_PUBLIC_KEY secret, using fallback public key', error instanceof Error ? error.message : error);
    publicKeyB64 = DEFAULT_VAPID_PUBLIC_KEY;
    publicKeyBytes = base64UrlDecode(DEFAULT_VAPID_PUBLIC_KEY);
  }
  
  // Build PKCS8 from raw private key + public key
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Middle = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);
  // Prepend 0x04 to public key if not already there
  const pubKeyWithPrefix = publicKeyBytes[0] === 0x04 ? publicKeyBytes : concat(new Uint8Array([0x04]), publicKeyBytes);
  const pkcs8 = concat(pkcs8Header, privateKeyBytes, pkcs8Middle, pubKeyWithPrefix);
  
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', pkcs8.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );
  
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: 'mailto:admin@domofondar.kz' };
  
  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${encHeader}.${encPayload}`;
  
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsigned)
  ));
  
  // Convert DER to raw r||s if needed
  let rawSig: Uint8Array;
  if (sig.length === 64) {
    rawSig = sig;
  } else {
    const rLen = sig[3];
    const r = sig.slice(4, 4 + rLen);
    const sLen = sig[4 + rLen + 1];
    const s = sig.slice(4 + rLen + 2, 4 + rLen + 2 + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }
  
  const jwt = `${unsigned}.${base64UrlEncode(rawSig.buffer as ArrayBuffer)}`;
  return { jwt, publicKeyB64 };
}

async function sendPushNotification(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<{ success: boolean; removeSubscription: boolean }> {
  try {
    const clientPublicKey = base64UrlDecode(sub.p256dh);
    const clientAuth = base64UrlDecode(sub.auth);
    
    const { ciphertext } = await encryptPayload(clientPublicKey, clientAuth, payload);
    
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const { jwt, publicKeyB64 } = await createVapidJwt(audience);
    
    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt}, k=${publicKeyB64}`,
      },
      body: ciphertext,
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`Push failed ${response.status}: ${text} for ${sub.endpoint}`);
      return { success: false, removeSubscription: response.status === 404 || response.status === 410 };
    }
    await response.text();
    console.log(`Push sent to ${sub.endpoint.substring(0, 60)}...`);
    return { success: true, removeSubscription: false };
  } catch (error) {
    console.error('Push send error:', error);
    return { success: false, removeSubscription: false };
  }
}

// ---- Main handler ----

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_ids, roles, title, body, url, data } = await req.json();
    
    if ((!Array.isArray(user_ids) || user_ids.length === 0) && (!Array.isArray(roles) || roles.length === 0) || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'user_ids or roles, title, body required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    let recipientUserIds = Array.isArray(user_ids) ? user_ids.filter(Boolean) : [];

    if (Array.isArray(roles) && roles.length > 0) {
      const { data: roleRecipients, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .in('role', roles);

      if (rolesError) throw rolesError;

      recipientUserIds = Array.from(new Set([
        ...recipientUserIds,
        ...(roleRecipients?.map((row) => row.user_id) ?? []),
      ]));
    }

    if (recipientUserIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No recipients found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientUserIds);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found for users:', user_ids);
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({ title, body, url: url || '/fsm', data });
    
    let sent = 0;
    const expiredEndpoints: string[] = [];
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
      );
      if (result.success) sent++;
      else {
        failedEndpoints.push(sub.endpoint);
        if (result.removeSubscription) expiredEndpoints.push(sub.endpoint);
      }
    }

    if (expiredEndpoints.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length, failed: failedEndpoints.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
