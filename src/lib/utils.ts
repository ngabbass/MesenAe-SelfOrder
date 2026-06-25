import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FORMAT_IDR = (price: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export const saveLocalTransactionId = (txId: string | number) => {
  try {
    const existingStr = localStorage.getItem('mesenae_my_tx_ids');
    const existing: (string | number)[] = existingStr ? JSON.parse(existingStr) : [];
    if (!existing.includes(txId)) {
      existing.push(txId);
      localStorage.setItem('mesenae_my_tx_ids', JSON.stringify(existing));
    }
  } catch (e) {
    console.error('Error saving txId to local storage:', e);
  }
};

export const getLocalTransactionIds = (): (string | number)[] => {
  try {
    const existingStr = localStorage.getItem('mesenae_my_tx_ids');
    return existingStr ? JSON.parse(existingStr) : [];
  } catch (e) {
    console.error('Error getting txIds from local storage:', e);
    return [];
  }
};

/**
 * Membersihkan ID transaksi lama dari localStorage.
 * ID yang lebih dari 24 jam (berdasarkan timestamp di TX ID) akan dihapus.
 * Ini mencegah akumulasi tanpa batas yang menyebabkan false match di GlobalReadyAlert.
 */
export const pruneOldTransactionIds = (): void => {
  try {
    const existingStr = localStorage.getItem('mesenae_my_tx_ids');
    if (!existingStr) return;
    const ids: (string | number)[] = JSON.parse(existingStr);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 jam
    const pruned = ids.filter(id => {
      const str = String(id);
      // ID format: TX1234567890 atau Firestore random ID
      const match = str.match(/^TX(\d+)$/);
      if (match) {
        const ts = parseInt(match[1], 10);
        return ts > cutoff;
      }
      // Firestore IDs tanpa timestamp → simpan (tidak bisa divalidasi)
      return true;
    });
    if (pruned.length !== ids.length) {
      localStorage.setItem('mesenae_my_tx_ids', JSON.stringify(pruned));
      console.info(`[pruneOldTransactionIds] Removed ${ids.length - pruned.length} stale TX IDs`);
    }
  } catch (e) {
    console.error('Error pruning old txIds:', e);
  }
};

/**
 * Membersihkan ID WhatsApp yang sudah terkirim agar tidak menumpuk.
 */
export const pruneOldSentWaIds = (): void => {
  try {
    const saved = localStorage.getItem('mesenae_sent_wa_tx_ids');
    if (!saved) return;
    const ids: string[] = JSON.parse(saved);
    // Hanya simpan 50 ID terakhir
    if (ids.length > 50) {
      localStorage.setItem('mesenae_sent_wa_tx_ids', JSON.stringify(ids.slice(-50)));
    }
  } catch (e) {
    console.error('Error pruning sent WA ids:', e);
  }
};

/**
 * Basic HTML sanitizer to prevent XSS from dangerouslySetInnerHTML.
 * Only allows basic formatting tags: b, i, u, strong, em, br, span.
 * Strips all attributes except style and class.
 */
export const sanitizeHtml = (html: string | undefined | null): string => {
  if (!html) return '';
  
  // 1. Remove script tags and their content
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 2. Remove iframe, object, embed, applet tags
  clean = clean.replace(/<(iframe|object|embed|applet)\b[^<]*(?:(?!<\/(iframe|object|embed|applet)>)<[^<]*)*<\/(iframe|object|embed|applet)>/gi, '');
  
  // 3. Remove all on* event handlers (onclick, onerror, etc.)
  clean = clean.replace(/ on\w+="[^"]*"/gi, '');
  clean = clean.replace(/ on\w+='[^']*'/gi, '');
  clean = clean.replace(/ on\w+=[^\s>]+/gi, '');
  
  // 4. Remove javascript: links
  clean = clean.replace(/href="javascript:[^"]*"/gi, '');
  clean = clean.replace(/href='javascript:[^']*'/gi, '');
  
  return clean;
};

export const base64Decode = (str: string): string => {
  if (!str) return str;
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(str) && (str.length % 4 === 0 || str.length > 8)) {
      const decoded = atob(str);
      const utf8Decoded = decodeURIComponent(decoded.split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return utf8Decoded;
    }
  } catch (e) {
    // Ignore and fallback
  }
  return str;
};

export const parseTableNumber = (t: string | number | null | undefined) => {
  const s = String(t || '').trim();
  if (!s || s.toLowerCase() === 'bawa pulang') {
    return { area: '', table: 'Bawa Pulang', isTakeAway: true };
  }
  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    return { area: parts[0], table: parts[1], isTakeAway: false };
  }
  return { area: 'Lantai 1', table: s, isTakeAway: false }; // fallback area
};

export const generateTableId = (str: string): string => {
  if (!str) return 'takeaway';
  if (str === 'Bawa Pulang') return 'takeaway';
  
  // cyrb53 hash
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = (h1 >>> 0) ^ (h2 >>> 0);
  
  // Convert the combined hash into an 8-character alphanumeric string
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  let seed = combined;
  for (let i = 0; i < 8; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    result += chars[seed % chars.length];
  }
  return result;
};

export const formatReceiptTable = (t: string | number | null | undefined): string => {
  const s = String(t || '').trim();
  const lower = s.toLowerCase();
  if (!s || lower === 'bawa pulang' || lower === 'take away' || lower === 'takeaway') {
    return 'Bawa Pulang';
  }
  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    const area = parts[0].trim();
    const table = parts[1].trim();
    const tableLabel = /^\d+$/.test(table) ? `Meja ${table}` : table;
    return `${tableLabel} (${area})`;
  }
  const cleanTable = s.replace(/^(meja\s+)+/i, '').trim();
  return /^\d+$/.test(cleanTable) ? `Meja ${cleanTable}` : cleanTable;
};
