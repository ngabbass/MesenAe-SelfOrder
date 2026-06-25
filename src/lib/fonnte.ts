/**
 * fonnte.ts — Fonnte WhatsApp Gateway Integration
 * * Mengirim notifikasi WhatsApp menggunakan REST API Fonnte ke nomor tujuan.
 * Mendukung pengiriman teks dan gambar (struk) melalui URL publik atau file lokal.
 */

export interface FonntePayload {
  target: string;
  message: string;
  /** Gunakan `url` jika gambar struk sudah dihosting online (berupa link publik) */
  url?: string;
  /** Gunakan `file` jika gambar berupa objek File/Blob (misal: upload langsung dari device pengguna) */
  file?: File | Blob;
  /** Opsional: Untuk memberikan nama spesifik pada file struk yang dikirim */
  filename?: string;
}

export interface FonnteResponse {
  status: boolean;
  detail: string;
  [key: string]: any; // Menangkap data respons lainnya dari Fonnte
}

export const sendWhatsAppNotification = async (
  payload: FonntePayload
): Promise<FonnteResponse | null> => {
  const token = import.meta.env.VITE_FONNTE_TOKEN;
  
  if (!token) {
    console.warn("[Fonnte] Token (VITE_FONNTE_TOKEN) tidak ditemukan di environment variables.");
    return null;
  }

  const { target, message, url, file, filename } = payload;
  
  // 1. Membersihkan nomor telepon agar hanya berisi angka
  let cleanTarget = target.replace(/[^0-9]/g, '');
  
  // 2. Mengubah prefix 0 menjadi 62 (Kode Negara Indonesia) secara aman
  if (cleanTarget.startsWith('0')) {
    cleanTarget = '62' + cleanTarget.substring(1);
  }

  try {
    console.info(`[Fonnte] Mengirim pesan ke ${cleanTarget}...`);
    
    // 3. Menggunakan FormData untuk mendukung Teks sekaligus File (multipart/form-data)
    const formData = new FormData();
    formData.append('target', cleanTarget);
    formData.append('message', message); // Di Fonnte, 'message' otomatis menjadi caption untuk gambar
    
    // Melampirkan gambar dengan parameter yang tepat sesuai jenisnya
    if (url) {
      formData.append('url', url);
    }
    if (file) {
      formData.append('file', file);
    }
    if (filename) {
      formData.append('filename', filename);
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token
        // CATATAN PENTING: Jangan mengatur 'Content-Type': 'multipart/form-data' secara manual di sini.
        // Fetch() dan browser akan mengaturnya secara otomatis beserta hash boundary-nya.
      },
      body: formData
    });
    
    const result = await response.json();
    
    // 4. Pengecekan status yang lebih ketat
    if (response.ok && result.status) {
      console.info("[Fonnte] Pesan berhasil terkirim:", result);
    } else {
      console.error("[Fonnte] Gagal dari server Fonnte:", result);
    }

    return result as FonnteResponse;
  } catch (error) {
    console.error("[Fonnte] Network / CORS Error saat mengirim pesan WhatsApp:", error);
    return null;
  }
};
