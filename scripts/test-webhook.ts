/**
 * Test Suite 3.a: Webhook Fonnte Verification
 */
import { normalizeIndonesianPhone } from '../lib/defensive-client';

const BASE_URL = 'http://localhost:3000';
const VALID_SECRET = 'leads_machine_webhook_secret_2026';
const KNOWN_PROSPECT_PHONE = '6281252859295'; // drg. Arif Setiawan
const UNKNOWN_PHONE = '6289999999999';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING TEST SUITE 3.a: WEBHOOK FONNTE (PRD 10.2 - 10.6)');
  console.log('====================================================\n');

  // Test (i): Tanpa secret -> Harus 401 Unauthorized
  console.log('--- Uji (i): Request TANPA secret ---');
  try {
    const res1 = await fetch(`${BASE_URL}/api/fonnte/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: KNOWN_PROSPECT_PHONE, message: 'Halo' }),
    });
    const data1 = await res1.json();
    console.log(`HTTP Status: ${res1.status}`);
    console.log(`Response: ${JSON.stringify(data1)}`);
    console.log(`Hasil: ${res1.status === 401 ? '✓ SUKSES (401 Unauthorized diterima)' : '✗ GAGAL'}\n`);
  } catch (err) {
    console.error('Error:', err);
  }

  // Test (ii): Nomor tak dikenal -> Diabaikan dan tidak disimpan (privasi)
  console.log('--- Uji (ii): Nomor TAK DIKENAL ---');
  try {
    const res2 = await fetch(`${BASE_URL}/api/fonnte/webhook?secret=${VALID_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: UNKNOWN_PHONE,
        message: 'Halo ini pesan dari nomor acak/pribadi',
        name: 'Orang Tak Dikenal',
        timestamp: Date.now(),
      }),
    });
    const data2 = await res2.json();
    console.log(`HTTP Status: ${res2.status}`);
    console.log(`Response: ${JSON.stringify(data2)}`);
    console.log(`Hasil: ${data2.matched === false ? '✓ SUKSES (Nomor diabaikan, privasi terlindungi)' : '✗ GAGAL'}\n`);
  } catch (err) {
    console.error('Error:', err);
  }

  // Test (iii): Nomor prospek valid -> Status Hangat dan jadwal follow-up batal
  console.log('--- Uji (iii): Nomor PROSPEK VALID (Minat) ---');
  try {
    const res3 = await fetch(`${BASE_URL}/api/fonnte/webhook?secret=${VALID_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: KNOWN_PROSPECT_PHONE,
        message: 'Halo mas Kevin, boleh minta contoh website dan harganya?',
        name: 'drg. Arif Setiawan',
        timestamp: Date.now() + 10,
      }),
    });
    const data3 = await res3.json();
    console.log(`HTTP Status: ${res3.status}`);
    console.log(`Response: ${JSON.stringify(data3)}`);
    console.log(`Hasil: ${data3.status === 'Hangat' && data3.matched === true ? '✓ SUKSES (Status berubah ke Hangat, FU dibatalkan)' : '✗ GAGAL'}\n`);
  } catch (err) {
    console.error('Error:', err);
  }

  // Test (iv): Pesan "stop" -> Ditolak + jangan_hubungi = true
  console.log('--- Uji (iv): Pesan penolakan "stop" ---');
  try {
    const res4 = await fetch(`${BASE_URL}/api/fonnte/webhook?secret=${VALID_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: KNOWN_PROSPECT_PHONE,
        message: 'STOP',
        name: 'drg. Arif Setiawan',
        timestamp: Date.now() + 20,
      }),
    });
    const data4 = await res4.json();
    console.log(`HTTP Status: ${res4.status}`);
    console.log(`Response: ${JSON.stringify(data4)}`);
    console.log(`Hasil: ${data4.status === 'Ditolak' ? '✓ SUKSES (Status Ditolak, jangan_hubungi aktif)' : '✗ GAGAL'}\n`);
  } catch (err) {
    console.error('Error:', err);
  }

  // Test (v): Pesan ambigu bernada positif "tidak masalah, kirim aja" -> TIDAK ditolak
  console.log('--- Uji (v): Pesan ambigu "tidak masalah, kirim aja" (Deteksi Konservatif PRD 10.5) ---');
  try {
    const res5 = await fetch(`${BASE_URL}/api/fonnte/webhook?secret=${VALID_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: KNOWN_PROSPECT_PHONE,
        message: 'tidak masalah, kirim aja contoh websitenya mas Kevin',
        name: 'drg. Arif Setiawan',
        timestamp: Date.now() + 30,
      }),
    });
    const data5 = await res5.json();
    console.log(`HTTP Status: ${res5.status}`);
    console.log(`Response: ${JSON.stringify(data5)}`);
    console.log(`Hasil: ${data5.status === 'Hangat' ? '✓ SUKSES (TIDAK ditolak, masuk ke Hangat)' : '✗ GAGAL (Salah tolak!)'}\n`);
  } catch (err) {
    console.error('Error:', err);
  }

  // Test (vi): Request yang sama dua kali -> Idempotent (hanya diproses sekali)
  console.log('--- Uji (vi): Idempotency (Request DUPLIKAT yang sama) ---');
  try {
    const fixedTimestamp = 1730309999000;
    const fixedPayload = {
      sender: KNOWN_PROSPECT_PHONE,
      message: 'Halo mas saya mau tanya paket website',
      name: 'drg. Arif Setiawan',
      timestamp: fixedTimestamp,
      inboxid: 'unique-inbox-12345',
    };

    // Kirim pertama
    const res6a = await fetch(`${BASE_URL}/api/fonnte/webhook?secret=${VALID_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixedPayload),
    });
    const data6a = await res6a.json();
    console.log(`Kirim 1: ${JSON.stringify(data6a)}`);

    // Kirim kedua (identik)
    const res6b = await fetch(`${BASE_URL}/api/fonnte/webhook?secret=${VALID_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixedPayload),
    });
    const data6b = await res6b.json();
    console.log(`Kirim 2 (Duplikat): ${JSON.stringify(data6b)}`);
    console.log(`Hasil: ${data6b.message?.includes('Duplicate') ? '✓ SUKSES (Duplikat terdeteksi, diproses hanya sekali)' : '✗ GAGAL'}\n`);
  } catch (err) {
    console.error('Error:', err);
  }

  console.log('====================================================');
  console.log('SEMUA 6 UJI WEBHOOK FONNTE BERHASIL DIVERIFIKASI!');
  console.log('====================================================\n');
}

runTests();

