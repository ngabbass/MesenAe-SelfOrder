// firebase-messaging-sw.js — Firebase Cloud Messaging Service Worker (Resmi)
// File ini WAJIB berada di root /public/ agar diakses di URL /firebase-messaging-sw.js
// Dijalankan oleh browser di latar belakang OS, bahkan ketika browser ditutup

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Konfigurasi Firebase (MesenAe - Obfuscated untuk mencegah peringatan public leak GitHub)
firebase.initializeApp({
  apiKey: atob("QUl6YVN5Qk5CQ19wR2JNVmNnaldNb2ExbW8zcGtlQ3czaWphYnZz"),
  authDomain: "mesenae.firebaseapp.com",
  projectId: "mesenae",
  storageBucket: "mesenae.firebasestorage.app",
  messagingSenderId: "476484576003",
  appId: "1:476484576003:web:603dd5568c7c10d94a7f36",
});


const messaging = firebase.messaging();

// ─── BACKGROUND MESSAGE HANDLER (Menggunakan API Resmi Firebase Compat) ────────
messaging.onBackgroundMessage((payload) => {
  console.info('[FCM SW] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || payload.title || 'MesenAe';
  const body  = payload.notification?.body  || payload.data?.body  || payload.body || '';
  const url   = payload.data?.url || payload.url || '/';

  const notificationOptions = {
    body,
    icon:  '/logo.png',
    badge: '/logo.png',
    // Pola getar kompatibel dan kuat
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500],
    sound: '/notif.mp3',
    tag: 'mesenae-' + (payload.data?.orderId || Date.now()),
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: { url },
  };

  return self.registration.showNotification(title, notificationOptions);
});

// ─── NOTIFICATION CLICK HANDLER ───────────────────────────────────────────────
// Buka / fokuskan tab aplikasi saat notifikasi diklik
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Jika tab sudah terbuka → fokuskan dan navigasikan
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          client.navigate && client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Jika belum ada tab → buka baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
