import { useEffect, useState, useRef } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';

// ══════════════════════════════════════════════════════════
//  Types (Customer-facing — keep only what customer needs)
// ══════════════════════════════════════════════════════════
export interface ProductVariantOption { name: string; price: number; }
export interface ProductVariantGroup { name: string; type: 'single' | 'multiple'; required: boolean; options: ProductVariantOption[]; }
export interface Category { id?: string | number; name: string; color: string; icon: string; needsKitchen?: boolean; }
export interface Product { id?: string | number; name: string; sku: string; categoryId: string | number; price: number; hpp: number; stock: number; unit: string; variants?: ProductVariantGroup[]; photo?: string; barcode?: string; }
export interface PaymentMethod { id?: string | number; name: string; category: string; isDefault: boolean; provider?: string; qrisString?: string; accountName?: string; accountNumber?: string; bankName?: string; iconName?: string; sortOrder?: number; }
export interface Transaction { id?: string | number; subtotal: number; discountType: string | null; discountValue: number; discountAmount: number; taxAndService?: number; total: number; paymentMethodId: string | number; paymentAmount: number; payments?: any[]; change: number; profit: number; date: Date | string; receiptNumber: string; status: string; kitchenStatus?: string; orderNumber?: string; customerName?: string; tableNumber?: string; remarks?: string; needsKitchen?: boolean; }
export interface TransactionItemRecord { id?: string | number; transactionId: string | number; productId: string | number; productName: string; quantity: number; price: number; hpp: number; discountType: string | null; discountValue: number; discountAmount: number; subtotal: number; selectedVariants?: any[]; notes?: string; }
export interface StoreSettings { id?: string | number; storeName: string; address: string; phone: string; receiptFooter: string; onboardingDone: boolean; themeColor?: string; selfOrderTheme?: string; logo?: string; tables?: string[]; promoBanners?: any[]; deliveryMode?: 'ambil' | 'diantar'; enableSplitBill?: boolean; }
export interface User { id?: string | number; username: string; password_hash: string; role: string; name?: string; whatsapp?: string; }
export interface Voucher { id?: string | number; code: string; type: string; value: number; isActive: boolean; applicableProductIds?: (string | number)[]; validUntil: Date | string | null; }
export interface Banner { id?: string | number; type?: string; heading?: string; title: string; description?: string; imageUrl?: string | null; isActive: boolean; link?: string; overlayImageUrl?: string | null; headingPos?: { x: number; y: number; w?: number }; titlePos?: { x: number; y: number; w?: number }; descPos?: { x: number; y: number; w?: number }; buttonPos?: { x: number; y: number; w?: number }; overlayPos?: { x: number; y: number }; buttonText?: string; bgType?: 'image' | 'solid' | 'gradient'; bgColor?: string; bgGradient?: string; overlayFlipX?: boolean; overlayRotate?: number; overlayScale?: number; overlayBorderRadius?: number; badgeStyle?: string; canvasBgFilter?: any; canvasOverlayFilter?: any; bgGradientOverlay?: { enabled: boolean; color: string; opacityLeft: number; opacityRight: number; angle: number }; headingStyle?: string; overlays?: any[]; }


// ── Table name mapping (camelCase → snake_case) ──────────────
const TABLE_MAP: Record<string, string> = {
  categories: 'categories',
  products: 'products',
  paymentMethods: 'payment_methods',
  transactions: 'transactions',
  transactionItems: 'transaction_items',
  storeSettings: 'store_settings',
  users: 'users',
  vouchers: 'vouchers',
  banners: 'banners',
};

// ── Converters ────────────────────────────────────────────────
const mapSnakeToCamel = (obj: any): any => {
  if (obj === undefined || obj === null) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(mapSnakeToCamel);
  const out: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    out[camelKey] = mapSnakeToCamel(value);
  }
  return out;
};

const mapCamelToSnake = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(mapCamelToSnake);
  const out: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
    out[snakeKey] = mapCamelToSnake(value);
  }
  return out;
};

// ══════════════════════════════════════════════════════════
//  Shared Listener Pool + In-Memory Cache
// ══════════════════════════════════════════════════════════
//
//  Mekanisme:
//  - SATU listener Firestore per collection, reference-counted.
//  - Subscriber pertama membuat listener onSnapshot.
//  - Subscriber berikutnya langsung dapat data cached (instant).
//  - Data tetap REALTIME — onSnapshot push update otomatis.
//  - Grace period: listener tetap hidup beberapa detik setelah
//    semua subscriber unmount (mencegah re-subscribe saat navigasi).
//
//  Cache ini BUKAN cache stale — data selalu realtime via onSnapshot.
//  Hanya menghindari listener duplikat (hemat Firebase reads ~60-80%).

const GRACE_PERIOD_MS = 15_000; // 15 detik grace period (cukup untuk navigasi antar halaman)

interface ListenerEntry {
  unsubscribe: () => void;
  data: any[];
  subscribers: Set<(data: any[]) => void>;
  graceTimeout: ReturnType<typeof setTimeout> | null;
}

const listenerPool = new Map<string, ListenerEntry>();

function subscribeToCollection(
  tableName: string,
  callback: (data: any[]) => void
): () => void {
  let entry = listenerPool.get(tableName);

  if (entry) {
    // Existing listener — reuse, cancel grace timeout if pending
    if (entry.graceTimeout) {
      clearTimeout(entry.graceTimeout);
      entry.graceTimeout = null;
    }
    entry.subscribers.add(callback);
    // Immediately deliver cached data (instant display)
    callback(entry.data);
  } else {
    // First subscriber — create new Firestore listener
    const subscribers = new Set<(d: any[]) => void>();
    subscribers.add(callback);

    const colRef = collection(firestoreDb, tableName);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const docsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const camelData = mapSnakeToCamel(docsData);
        // Update cache & notify all subscribers
        const current = listenerPool.get(tableName);
        if (current) {
          current.data = camelData;
          current.subscribers.forEach(cb => cb(camelData));
        }
      },
      (error) => {
        if (import.meta.env.DEV) {
          console.warn(`[db] Snapshot error for ${tableName}:`, error);
        }
      }
    );

    entry = { unsubscribe, data: [], subscribers, graceTimeout: null };
    listenerPool.set(tableName, entry);
  }

  // Return unsubscribe for this specific subscriber
  return () => {
    const current = listenerPool.get(tableName);
    if (!current) return;

    current.subscribers.delete(callback);

    if (current.subscribers.size === 0) {
      // No subscribers left — start grace period before closing
      current.graceTimeout = setTimeout(() => {
        const check = listenerPool.get(tableName);
        if (check && check.subscribers.size === 0) {
          check.unsubscribe();
          listenerPool.delete(tableName);
        }
      }, GRACE_PERIOD_MS);
    }
  };
}

// ══════════════════════════════════════════════════════════
//  useDbQuery — Shared Firestore Real-time with Cache
// ══════════════════════════════════════════════════════════
export function useDbQuery<T = any>(tableCamelCase: string): T[] {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;

  // Use ref to avoid re-subscribing on every render
  const callbackRef = useRef<(data: T[]) => void>(() => {});
  const [data, setData] = useState<T[]>(() => {
    // Initialize with cached data if available (instant display)
    const existing = listenerPool.get(tableName);
    return existing ? existing.data as T[] : [];
  });

  callbackRef.current = setData;

  useEffect(() => {
    const unsubscribe = subscribeToCollection(tableName, (newData) => {
      callbackRef.current(newData as T[]);
    });

    return () => unsubscribe();
  }, [tableName]);

  return data;
}

// ══════════════════════════════════════════════════════════
//  CRUD helpers (Customer only needs insert + update for orders)
// ══════════════════════════════════════════════════════════

/** Insert satu record, kembalikan ID record baru */
export async function dbInsert(tableCamelCase: string, data: any): Promise<string> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;
  const snakeData = mapCamelToSnake(data);
  const docId = data?.id ? String(data.id) : String(Date.now() + Math.floor(Math.random() * 1000));

  const docRef = doc(firestoreDb, tableName, docId);
  await setDoc(docRef, { ...snakeData, id: docId });
  return docId;
}

/** Update record berdasarkan ID */
export async function dbUpdate(tableCamelCase: string, id: number | string, data: any): Promise<void> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;
  const snakeData = mapCamelToSnake(data);

  const docRef = doc(firestoreDb, tableName, String(id));
  await updateDoc(docRef, snakeData);
}

/** Hard delete (hanya untuk kebutuhan cancel order) */
export async function dbDelete(tableCamelCase: string, id: number | string): Promise<void> {
  const tableName = TABLE_MAP[tableCamelCase] || tableCamelCase;

  const docRef = doc(firestoreDb, tableName, String(id));
  await deleteDoc(docRef);
}
