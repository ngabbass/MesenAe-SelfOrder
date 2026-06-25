/**
 * api/fcm-send.ts — Vercel Serverless Function
 *
 * Menerima array FCM device tokens + payload notifikasi,
 * lalu mengirimkan push notification via Firebase Admin SDK ke Google FCM.
 *
 * Google FCM meneruskan ke OS Android/iOS → Service Worker aktif → Notifikasi Native
 */

import * as admin from "firebase-admin";

// Inisialisasi Firebase Admin SDK (hanya sekali)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT || "{}"
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export default async function handler(req: any, res: any) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tokens, payload } = req.body as {
      tokens: string[];
      payload: { title: string; body: string; url?: string };
    };

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ error: "No tokens provided" });
    }

    // ── Buat pesan FCM multicast ───────────────────────────────────────────
    const message: admin.messaging.MulticastMessage = {
      tokens,

      // Data tingkat-root untuk kemudahan parsing latar belakang di semua perangkat
      data: {
        title: payload.title,
        body:  payload.body,
        url:   payload.url || "/",
        orderId: String(Date.now()),
      },

      // Notifikasi dasar (tampil di semua platform)
      notification: {
        title: payload.title,
        body:  payload.body,
      },

      // ── Android: prioritas tinggi + pola getar pager restoran ───────────
      android: {
        priority: "high",
        notification: {
          sound:         "default",
          priority:      "max",
          channelId:     "mesenae_orders",
          // Pola getar (ms): jeda, getar, jeda, getar, ...
          vibrateTimingsMillis: [0, 500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 500],
          defaultVibrateTimings: false,
          clickAction:   "FLUTTER_NOTIFICATION_CLICK",
          icon:          "ic_notification",
        },
        data: { url: payload.url || "/" },
      },

      // ── APNs (iOS): prioritas tinggi + suara default agar masuk dalam milidetik ──
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body:  payload.body,
            },
            sound: "default",
            badge: 1,
          },
        },
      },

      // ── Web Push: getar pager + renotify + requireInteraction ───────────
      webpush: {
        headers: {
          Urgency: "high",
          TTL:     "86400",
        },
        notification: {
          title:             payload.title,
          body:              payload.body,
          icon:              "/logo.png",
          badge:             "/logo.png",
          requireInteraction: true,
          vibrate:           [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 500],
          tag:               "mesenae-" + Date.now(),
          renotify:          true,
          data: { url: payload.url || "/" },
        } as any,
        fcmOptions: {
          link: payload.url || "/",
        },
      },
    };

    // ── Kirim ke semua device sekaligus ────────────────────────────────────
    const response = await admin.messaging().sendEachForMulticast(message);

    // Kumpulkan token yang sudah expired/invalid untuk dibersihkan
    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = (resp.error as any)?.code;
        // Token tidak valid → tandai untuk dihapus dari Firestore
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          failedTokens.push(tokens[idx]);
        }
        console.error(`[FCM] Token[${idx}] gagal:`, resp.error?.message);
      }
    });

    return res.status(200).json({
      success:      true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,          // Caller bisa pakai ini untuk bersihkan Firestore
    });
  } catch (error: any) {
    console.error("[FCM] Send error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
