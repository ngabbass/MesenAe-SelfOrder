import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Pastikan hanya ada 1 instance Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db      = getFirestore(app);
const storage = getStorage(app);

// Analytics — hanya di browser yang mendukung
let analytics: any = null;
isAnalyticsSupported().then(supported => {
  if (supported) analytics = getAnalytics(app);
});

// Messaging — hanya di browser yang mendukung (bukan SSR / Node)
// Ekspor sebagai fungsi async agar tidak error di lingkungan non-browser
const getMessagingInstance = async () => {
  try {
    const supported = await isMessagingSupported();
    if (!supported) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
};

export { app, db, storage, analytics, getMessagingInstance };
