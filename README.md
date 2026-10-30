# Leads Machine v4 · "Siap Tempur November"

Aplikasi sales & client outreach terpadu untuk solo freelancer jasa pembuatan website UMKM (Klinik Gigi, Villa/Penginapan, Kontraktor/Interior, Apotek).

---

## 🚀 Fitur Utama & Alur Kerja Harian

1. **Radar Klien (`1`)**: Tarik prospek terverifikasi A1 dari Google Maps / Serper, filter no-website, kirim WA instan atau jalankan auto-send bertahap (jeda acak 45–90 detik).
2. **Deal Room (`2`)**: Pipeline visual 4 kolom (Antre, Terkirim, Hangat, Closing), banner Prospek Hangat real-time, proposal generator, dan amunisi closing (Voice note script, invoice generator).
3. **Prototype Studio (`3`)**: Rancang preview website interaktif mobile/desktop secara instan per prospek, 3 pilihan amunisi copy (Soft intro, Follow-up H+2, Urgensi), tombol salin & kirim WA.
4. **Keuangan & Misi Rp 100 Jt (`4`)**: Pelacak progres omzet menuju target Rp 100 Juta sebelum usia 20 tahun. Tanggal deadline dan target dapat diatur secara dinamis.
5. **Peluang Kerja & Freelance (`5`)**: Papan pelacak proyek web, part-time, dan retainer IT pemeliharaan website bulanan.

---

## 📱 Konfigurasi Webhook Masuk Fonnte (WhatsApp Gateway)

Leads Machine dilengkapi webhook cerdas dua arah untuk mendeteksi balasan klien secara otomatis tanpa polling.

### 1. Endpoint Webhook
- **URL Publik**: `https://domain-anda.com/api/fonnte/webhook`
- **Metode**: `POST`
- **Secret Param / Header**: `?secret=YOUR_FONNTE_WEBHOOK_SECRET` atau header `Authorization: Bearer YOUR_FONNTE_WEBHOOK_SECRET`

### 2. Cara Setting di Dashboard Fonnte (docs.fonnte.com)
1. Masuk ke dashboard resmi **[Fonnte](https://fonnte.com)**.
2. Buka menu **Device** > pilih perangkat aktif Anda > klik **Edit**.
3. Di kolom **Webhook URL**, masukkan URL publik Anda:
   ```
   https://domain-anda.com/api/fonnte/webhook?secret=leads_machine_webhook_secret_2026
   ```
4. Pengaturan status:
   - **Auto Read**: Pastikan **ON** (agar tanda centang dua biru terbaca di HP pengirim).
   - **Autoreply**: Pastikan **OFF** (agar bot otomatis bawaan Fonnte tidak mengganggu respons alami).
5. Klik **Save**.

### 3. Pengujian Lokal Menggunakan Tunnel (Cloudflare Tunnel / Ngrok)
Karena Fonnte berada di server cloud internet dan `localhost:3000` ada di laptop Anda, gunakan tunnel saat pengujian lokal:

#### Menggunakan Cloudflare Tunnel (Rekomendasi, Gratis & Tanpa Batas):
```bash
cloudflared tunnel --url http://localhost:3000
```
Salin URL publik yang dihasilkan (misal `https://random-subdomain.trycloudflare.com`) lalu masukkan ke Fonnte Webhook URL:
`https://random-subdomain.trycloudflare.com/api/fonnte/webhook?secret=leads_machine_webhook_secret_2026`

#### Menggunakan Ngrok:
```bash
ngrok http 3000
```
Salin URL HTTPS ngrok ke dashboard Fonnte.

#### Uji Instan di Aplikasi:
Klik indikator **WA Fonnte Aktif** di header Leads Machine > klik tombol **"Uji Webhook Sekarang"**. Aplikasi akan mengirimkan simulasi balasan prospek dan mencatatnya ke status **Hangat**.

---

## 🔒 Deteksi Opt-Out & Pembatalan Otomatis (Anti-Spam)

- Jika prospek membalas dengan kata-kata penolakan (*"stop", "tidak tertarik", "jangan hubungi", "salah nomor"*), sistem secara otomatis menandai prospek sebagai `Ditolak` dan mengaktifkan `jangan_hubungi = true`.
- Nomor tersebut **tidak akan pernah dikirimi pesan kembali** oleh fitur auto-send maupun follow-up.
- Jika prospek membalas santai / positif, status langsung naik ke `Hangat` dan seluruh antrean follow-up berikutnya dibatalkan otomatis.

---

## ☁️ Rekomendasi Deployment (Vercel / VPS)

Untuk memastikan balasan klien tetap tercatat saat laptop Anda mati di malam hari:
1. Deploy Next.js ke **Vercel** atau **VPS (Docker / Node.js)**.
2. Salin environment variable berikut ke dashboard project:
   ```env
   FONNTE_API_TOKEN=token_fonnte_anda
   FONNTE_WEBHOOK_SECRET=leads_machine_webhook_secret_2026
   SERPER_API_KEY=api_key_serper_anda
   GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/.../exec
   ```
3. Arahkan URL webhook Fonnte ke domain produksi Vercel/VPS Anda.

---

## ⌨️ Shortcut Keyboard

- `1`: Buka Radar Klien
- `2`: Buka Deal Room
- `3`: Buka Prototype Studio
- `4`: Buka Keuangan & Target
- `5`: Buka Peluang Proyek
- `/`: Fokus ke kolom pencarian Deal Room
- `Esc`: Tutup drawer & modal
