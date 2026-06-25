# 🧾 MesenAe - Self Order (PWA Pelanggan)

<p align="center">
  <strong>Aplikasi Menu & Pemesanan Mandiri (Self-Order) Pelanggan, Terhubung Langsung ke MesenAe Dashboard.</strong><br>
  <em>(Repositori ini khusus untuk portal Pelanggan / Customer App)</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge" alt="Production Ready" />
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20PWA-orange?style=for-the-badge" alt="PWA Platform" />
  <img src="https://img.shields.io/badge/Database-Firebase%20Firestore-blue?style=for-the-badge" alt="Firebase Firestore" />
  <img src="https://img.shields.io/badge/Storage-Cloudinary%20API-yellow?style=for-the-badge" alt="Cloudinary Storage" />
  <img src="https://img.shields.io/badge/Performance-React%20Query%20Cache-purple?style=for-the-badge" alt="React Query Cache" />
  <img src="https://img.shields.io/badge/Optimized-Zero%20Deadcode-success?style=for-the-badge" alt="Zero Deadcode" />
</p>

---

## 🔒 Lisensi & Hak Cipta (MIT License)

> [!NOTE]
> **MIT LICENSE**  
> Hak Cipta © 2026 **Ahmad Basith**.  
> 
> Dengan ini diberikan izin, secara cuma-cuma, kepada siapa pun yang memperoleh salinan perangkat lunak ini dan file dokumentasi terkait (Perangkat Lunak), untuk memperlakukan Perangkat Lunak ini tanpa batasan, termasuk tanpa batasan hak untuk menggunakan, menyalin, memodifikasi, menggabungkan, memublikasikan, mendistribusikan, mensublisensikan, dan/atau menjual salinan Perangkat Lunak, serta mengizinkan orang yang menerima Perangkat Lunak ini untuk melakukannya, dengan tunduk pada ketentuan standar lisensi MIT.

---

## 🌟 Tentang MesenAe

**MesenAe** adalah platform Point of Sale (POS) kelas atas yang dirancang khusus untuk memenuhi kebutuhan operasional dan digitalisasi kafe, restoran, dan UMKM modern di Indonesia. 

MesenAe menggunakan **100% infrastruktur Firebase (Cloud Firestore)** sebagai basis data utama, memastikan sinkronisasi transaksi secara seketika (*real-time*). Untuk penyimpanan media, aplikasi ini menggunakan integrasi cerdas **Cloudinary** yang didukung *Web Worker Compression*, menjaga ukuran foto tetap mini dan sangat jernih tanpa membebani server Firebase Anda.

---

## ⚡ Arsitektur Caching & Real-time Sync

MesenAe menerapkan strategi pengelolaan data modern menggunakan `@tanstack/react-query` yang dikombinasikan dengan *Real-time Listeners* dari Firebase SDK:

1. **Real-time Updates:** Setiap perubahan data (seperti pesanan baru, pembaruan stok, dll) langsung di-push oleh Firestore ke semua klien yang terhubung dalam hitungan milidetik. Layar kasir dan dapur selalu sinkron tanpa perlu *refresh*.
2. **Smooth UI Update:** UI akan ter-update secara mulus tanpa mengganggu aktivitas interaksi pengguna berkat integrasi React Query dengan Firebase `onSnapshot`.
3. **Offline Resilience:** React Query menyimpan *cache* lokal sehingga perpindahan antar halaman terasa instan (0 milidetik) tanpa ada kedipan layar loader (*zero visual flash*).

---

## ✨ Fitur Unggulan Kelas Atas (High-End POS)

### 🛒 1. Operasional Kasir Super Lengkap
*   **Split Bill & Cicilan:** Solusi pembayaran fleksibel di mana satu nota/meja bisa dibayar sebagian, dibagi rata, atau dicicil dengan beberapa metode pembayaran berbeda sekaligus!
*   **Manajemen Open Bill & Simpan Bill:** Tahan pesanan pelanggan untuk diselesaikan nanti. Stok produk dikelola secara dinamis saat menahan/membatalkan bill.
*   **Voucher & Diskon Spesifik:** Terapkan diskon manual (nominal/persentase) yang tervalidasi secara instan pada keranjang belanja.
*   **Sistem Variasi Produk (Product Variants):** Tambahkan pilihan topping/variasi (opsional/wajib, *single/multiple choice*) dengan penyesuaian harga otomatis saat checkout.
*   **Batas Modifikasi Nomor Meja:** Pelanggan yang memesan melalui kode QR di meja terkunci nomor mejanya agar tidak dapat dimodifikasi secara manual.

### 💳 2. Integrasi Pembayaran Otomatis & Terpusat
*   **Midtrans Gateway:** Terima pembayaran e-Wallet (GoPay, OVO, ShopeePay), QRIS, dan Transfer Bank langsung di layar Kasir/Pelanggan. Status pembayaran akan terupdate otomatis!
*   **Pencatatan QRIS/Bank Manual:** Mendukung pencatatan manual metode pembayaran apapun melalui manajemen Settings yang bisa disesuaikan sepenuhnya.

### 🖨️ 3. Struk, Laporan PDF & Integrasi WhatsApp
*   **Cetak Struk Thermal:** Hubungkan perangkat POS (HP/Tablet/PC) ke printer *thermal* bluetooth atau USB, cetak struk rapi dengan Header & Footer *custom* dari pengaturan.
*   **Cetak Invoice PDF & Bagikan ke WA:** Sediakan struk digital profesional dalam bentuk file PDF atau pesan teks rapi yang langsung dibagikan ke WhatsApp pelanggan.

### 📦 4. Manajemen Database & Cloudinary Storage
*   **Firebase Firestore Database:** Manajemen tabel produk, stok, transaksi, dan data pengguna secara terstruktur menggunakan NoSQL.
*   **Web Worker Compression:** Gambar dikompresi di latar belakang peramban (*browser*) secara otomatis menjadi di bawah 300KB (max resolusi 1920px) tanpa pembekuan antarmuka (*UI freeze*).
*   **Cloudinary Auto-Delete:** Integrasi pintar di mana sistem akan otomatis memusnahkan gambar lama di server Cloudinary ketika Anda menghapus/mengganti foto produk atau *banner* toko!

### 📱 5. UI/UX Interaktif & Pro Progressive Web App (PWA)
*   **Interactive Drag & Drop Banner:** Bangun *banner* promosi toko Anda secara bebas! Pindahkan gambar, teks, dan tombol promo ke mana saja menggunakan kursor secara presisi langsung dari panel Admin.
*   **Store Logo Cropper:** Alat pemotong otomatis (*cropper*) untuk merapikan logo toko Anda agar presisi di struk dan aplikasi pelanggan.
*   **Premium Edge-to-Edge UI:** Foto produk ditampilkan tanpa jarak (*borderless*) di beranda pelanggan. Ditambah dukungan mode layar Dapur (*Kitchen View*) dan *Horizontal Carousel* untuk pengalaman sekelas aplikasi *Native*.
*   **Split Bill Sync to Kitchen:** Tagihan bayar parsial (Split Bill) otomatis melanjutkan pesanan ke status dapur sesaat setelah lunas, menjamin efisiensi koki tanpa *delay*!
*   **Dynamic High-Res Store Logo:** Logo di Sidebar Admin dan Struk diatur terpusat berdasarkan prioritas; menggunakan Logo Toko Anda jika ada, atau turun *(fallback)* ke Ikon sistem.
*   **Indikator Animasi & Loading Mulus:** Memberikan respons visual (seperti Spinner & "Menyimpan...") di semua aksi simpan.
*   **Premium Built-In Modals:** Semua komponen dialog, checkout, variasi, dan hapus bill dibuat menggunakan komponen bawaan (`Dialog` & `AlertDialog` shadcn). Aplikasi ini **100% bebas dari dialog native browser**.

---

## 🛠️ Stack Teknologi

Perangkat lunak ini dikembangkan tanpa satupun dead-code, 100% divalidasi dengan arsitektur web modern yang sangat solid:
*   **Core Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite 8](https://vite.dev/)
*   **UI & Desain**: Vanilla CSS + [Tailwind CSS 3](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Premium Glassmorphism)
*   **Kueri & State**: [TanStack React Query 5](https://tanstack.com/query/latest)
*   **Database & Storage**: [Firebase SDK](https://firebase.google.com/) (Cloud Firestore & Firebase Storage)
*   **Ikonografi & Interaksi**: [Lucide React](https://lucide.dev/) & [html5-qrcode](https://github.com/mebjas/html5-qrcode) (Kamera Barcode/QR)

---

## 📂 Struktur Folder Proyek

```text
MesenAe/
├── src/
│   ├── admin/              # Panel Administrasi, Kasir, Dapur, Laporan, Pengaturan Lengkap
│   │   ├── components/     # Komponen penunjang kasir, struk, dan dialog modal scrollable
│   │   └── pages/          # Halaman Dashboard, Cashier, Vouchers, Kitchen, Settings, dll.
│   ├── customer/           # Panel Menu Mandiri Pelanggan (Self-Service Ordering Page)
│   │   └── pages/          # CartView, LandingView, HistoryView, SuccessView, TrackingView
│   ├── hooks/              # Custom React Hooks & Real-time Firestore Listeners (db-hooks.ts)
│   ├── lib/                # Konfigurasi utilitas (Firebase Config, Password Hashing, Image Utils)
│   ├── App.tsx             # Entry Point Router Utama Aplikasi
│   └── index.css           # Token Desain & Styling Global
├── public/                 # Aset Publik (Logo, PWA Manifest Icons)
├── vite.config.ts          # Konfigurasi PWA Generator & Vite Bundler
└── package.json            # Daftar Dependencies
```

---

## 📊 Skema Database (Firestore Collections)

Database disimpan dalam koleksi Firestore berikut:

1.  **`store_settings`**: Menyimpan data profil toko, nama, alamat, telepon, teks footer struk thermal, tabel aktif, daftar warna tema, dan banner.
2.  **`categories`**: Daftar kategori produk (nama, warna tag, ikon visual).
3.  **`products`**: Data inventaris menu (nama, SKU, harga jual, HPP, stok saat ini, variasi, URL foto dari Storage, dan barcode).
4.  **`vouchers`**: Kode promo/voucher belanja, potongan diskon, dan kriteria berlakunya.
5.  **`transactions`**: Histori bill transaksi lengkap beserta status pembayaran dan dapur.
6.  **`transaction_items`**: Rincian produk per transaksi yang terhubung ke dokumen `transactions`.
7.  **`suppliers`**: Data pemasok/supplier bahan baku.
8.  **`stock_ins` & `stock_outs`**: Rekaman log pergerakan stok barang.
9.  **`hpp_history`**: Riwayat perubahan Harga Pokok Penjualan (HPP).
10. **`payment_methods`**: Daftar opsi pembayaran (tunai, QRIS, dll).
11. **`users`**: Data kredensial pengguna admin/kasir/dapur (dengan password terenkripsi Web Crypto API SHA-256).

---

## 🚀 Panduan Deployment & Variabel Lingkungan (.env)

Buat file `.env` di direktori utama proyek Anda:

```bash
# FIREBASE CONFIGURATION
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# CLOUDINARY MEDIA STORAGE
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_API_KEY=your_api_key
VITE_CLOUDINARY_API_SECRET=your_api_secret

# MIDTRANS PAYMENT GATEWAY
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-your_client_key_here
MIDTRANS_SERVER_KEY=SB-Mid-server-your_server_key_here
MIDTRANS_IS_PRODUCTION=false # set ke true di production
```

Terapkan variabel ini pada dashboard deployment Anda (misal: Vercel Environment Variables).

---

## 💻 Cara Menjalankan Secara Lokal (Development)

Pastikan perangkat Anda sudah terinstall **Node.js 18+** atau runtime **Bun**.

1.  **Instalasi Dependencies:**
    ```bash
    npm install
    ```

2.  **Jalankan Server Development:**
    ```bash
    npm run dev
    ```
    Buka `http://localhost:5173` di browser Anda.

3.  **Lakukan Build Produksi:**
    ```bash
    npm run build
    ```

4.  **Uji Build Lokal:**
    ```bash
    npm run preview
    ```

---

## 👨‍💻 Pengembang Utama

Dikembangkan dengan dedikasi tinggi, kode yang bersih (*clean code*), terstruktur secara solid, dan dioptimasi secara penuh untuk memajukan perekonomian UMKM digital oleh **Ahmad Basith**.
