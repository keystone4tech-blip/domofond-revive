import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BKnzAAYc68ghFIetuQXHvo4e2qRUzBmbrQ1xUs_GQsahkrVZd3JX3rCfxUnTah0rRwwzu6xNN-ibL5KoH6UdkSg';

type BadgeNavigator = Navigator & {
  clearAppBadge?: () => Promise<void>;
};

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

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const syncSubscriptionWithServer = useCallback(async (subscription: PushSubscription | null) => {
    if (!subscription) {
      setIsSubscribed(false);
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSubscribed(false);
      return false;
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      setIsSubscribed(false);
      return false;
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;

    setIsSubscribed(true);
    return true;
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      await syncSubscriptionWithServer(subscription);
    } catch (e) {
      console.error('Check subscription error:', e);
      setIsSubscribed(false);
    }
  }, [syncSubscriptionWithServer]);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      void checkExistingSubscription();
    }
  }, [checkExistingSubscription]);

  useEffect(() => {
    if (!isSupported) return;

    const clearBadge = async () => {
      try {
        const badgeNavigator = navigator as BadgeNavigator;
        await badgeNavigator.clearAppBadge?.();
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: 'CLEAR_BADGE' });
      } catch (error) {
        console.error('Clear badge error:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void clearBadge();
      }
    };

    void clearBadge();
    window.addEventListener('focus', clearBadge);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', clearBadge);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void checkExistingSubscription();
      } else {
        setIsSubscribed(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkExistingSubscription, isSupported]);

  const waitForServiceWorker = async () => {
    // PWA service worker imports sw-push.js via importScripts
    // Just wait for it to be ready
    await navigator.serviceWorker.ready;
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);
    try {
      await waitForServiceWorker();
      
      const permResult = await Notification.requestPermission();
      setPermission(permResult);
      if (permResult !== 'granted') {
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });

      const synced = await syncSubscriptionWithServer(subscription);
      setIsLoading(false);
      return synced;
    } catch (e) {
      console.error('Subscribe error:', e);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
      const badgeNavigator = navigator as BadgeNavigator;
      await badgeNavigator.clearAppBadge?.();
      registration.active?.postMessage({ type: 'CLEAR_BADGE' });
      setIsSubscribed(false);
    } catch (e) {
      console.error('Unsubscribe error:', e);
    }
    setIsLoading(false);
  }, []);

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
