// Push notification service worker extension

async function setBadge(count) {
  try {
    if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
      await self.navigator.setAppBadge(count);
      return;
    }

    if (self.registration && typeof self.registration.setAppBadge === 'function') {
      await self.registration.setAppBadge(count);
    }
  } catch (error) {
    console.error('Badge set error:', error);
  }
}

async function clearBadge() {
  try {
    if (self.navigator && typeof self.navigator.clearAppBadge === 'function') {
      await self.navigator.clearAppBadge();
      return;
    }

    if (self.registration && typeof self.registration.clearAppBadge === 'function') {
      await self.registration.clearAppBadge();
    }
  } catch (error) {
    console.error('Badge clear error:', error);
  }
}

self.addEventListener('push', function(event) {
  let data = { title: 'Домофондар', body: 'Новое уведомление', badgeCount: 1 };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: data.tag || 'default',
    renotify: true,
    timestamp: Date.now(),
    data: {
      url: data.url || '/fsm',
      ...data.data
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title, options);
    await setBadge(typeof data.badgeCount === 'number' ? data.badgeCount : 1);
  })());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/fsm';
  
  event.waitUntil((async () => {
    await clearBadge();
    return clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    });
  })());
});

self.addEventListener('message', function(event) {
  if (event.data?.type === 'CLEAR_BADGE') {
    event.waitUntil(clearBadge());
  }
});
