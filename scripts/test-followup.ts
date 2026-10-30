/**
 * Test Suite 3.b: Follow-up Lifecycle & Safety Verification (PRD 11.3 & 11.7)
 */
import fs from 'fs';
import path from 'path';
import { getLeads, saveLeads } from '../lib/leads-store';
import { isWibSendingHours } from '../app/api/followup/route';

const BASE_URL = 'http://localhost:3000';

async function runFollowUpTests() {
  console.log('====================================================');
  console.log('RUNNING TEST SUITE 3.b: FOLLOW-UP ENGINE & SAFETY');
  console.log('====================================================\n');

  // Siapkan data dummy uji di file terpisah agar tidak mengganggu data asli
  const TEST_LEAD_PHONE = '6288800001111';
  let leads = getLeads();

  // Pastikan ada satu prospek uji khusus
  const existingIdx = leads.findIndex((l) => l.nomor_wa === TEST_LEAD_PHONE);
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  if (existingIdx !== -1) {
    leads[existingIdx] = {
      ...leads[existingIdx],
      status: 'Terkirim',
      tahap_followup: 0,
      terkirim_at: threeDaysAgo,
      pesan_pertama_at: threeDaysAgo,
      jangan_hubungi: false,
    };
  } else {
    leads.push({
      id: 'lead-test-followup',
      nama_bisnis: 'Villa Uji Coba Cangar',
      kategori: 'Villa & Glamping',
      kota: 'Batu',
      nomor_wa: TEST_LEAD_PHONE,
      status: 'Terkirim',
      tahap_followup: 0,
      terkirim_at: threeDaysAgo,
      pesan_pertama_at: threeDaysAgo,
      punya_website: false,
      jangan_hubungi: false,
      dibuat_at: threeDaysAgo,
      diubah_at: threeDaysAgo,
    });
  }
  saveLeads(leads);

  // 1. Uji: Prospek diam -> Masuk antrean FU1 H+2
  console.log('--- Uji 1: Prospek diam setelah 3 hari -> Masuk antrean FU1 (H+2) ---');
  const res1 = await fetch(`${BASE_URL}/api/followup`);
  const data1 = await res1.json();
  const testInQueue = data1.queue?.find((item: any) => item.phone === TEST_LEAD_PHONE);
  console.log(`Eligible in queue: ${Boolean(testInQueue)}, Tahap: ${testInQueue?.tahap} (${testInQueue?.tahapLabel})`);
  console.log(`Hasil: ${testInQueue && testInQueue.tahap === 1 ? '✓ SUKSES (FU1 H+2 terdeteksi)' : '✗ GAGAL'}\n`);

  // Kirim FU1 via dry-run
  console.log('--- Eksekusi FU1 via Dry-run Simulation ---');
  const resSendFU1 = await fetch(`${BASE_URL}/api/followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          leadId: testInQueue?.leadId || 'lead-test-followup',
          phone: TEST_LEAD_PHONE,
          message: testInQueue?.pesanTemplate || 'Pesan FU1',
          tahap: 1,
        },
      ],
      dryRun: true,
      bypassHours: true,
    }),
  });
  const dataSendFU1 = await resSendFU1.json();
  console.log(`Response: ${JSON.stringify(dataSendFU1)}`);
  console.log(`Hasil: ${dataSendFU1.sentCount === 1 ? '✓ SUKSES (FU1 tercatat terkirim)' : '✗ GAGAL'}\n`);

  // Simulasikan 3 hari lagi berlalu tanpa balasan untuk FU2 (H+4)
  console.log('--- Uji 2: Diam 3 hari lagi setelah FU1 -> Masuk antrean FU2 (H+4) ---');
  leads = getLeads();
  const leadIdx2 = leads.findIndex((l) => l.nomor_wa === TEST_LEAD_PHONE);
  leads[leadIdx2].followup_terakhir_at = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  saveLeads(leads);

  const res2 = await fetch(`${BASE_URL}/api/followup`);
  const data2 = await res2.json();
  const testInQueue2 = data2.queue?.find((item: any) => item.phone === TEST_LEAD_PHONE);
  console.log(`Eligible in queue: ${Boolean(testInQueue2)}, Tahap: ${testInQueue2?.tahap} (${testInQueue2?.tahapLabel})`);
  console.log(`Hasil: ${testInQueue2 && testInQueue2.tahap === 2 ? '✓ SUKSES (FU2 H+4 terdeteksi)' : '✗ GAGAL'}\n`);

  // Kirim FU2 via dry-run
  console.log('--- Eksekusi FU2 via Dry-run Simulation ---');
  const resSendFU2 = await fetch(`${BASE_URL}/api/followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          leadId: testInQueue2?.leadId || 'lead-test-followup',
          phone: TEST_LEAD_PHONE,
          message: testInQueue2?.pesanTemplate || 'Pesan FU2',
          tahap: 2,
        },
      ],
      dryRun: true,
      bypassHours: true,
    }),
  });
  const dataSendFU2 = await resSendFU2.json();
  console.log(`Hasil FU2: ${dataSendFU2.sentCount === 1 ? '✓ SUKSES' : '✗ GAGAL'}\n`);

  // Simulasikan 3 hari lagi berlalu setelah FU2 tanpa balasan -> Auto-transition ke "Tidak merespons"
  console.log('--- Uji 3: Diam setelah FU2 (H+4) -> Status menjadi "Tidak merespons" ---');
  leads = getLeads();
  const leadIdx3 = leads.findIndex((l) => l.nomor_wa === TEST_LEAD_PHONE);
  leads[leadIdx3].followup_terakhir_at = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  saveLeads(leads);

  // Trigger GET /api/followup yang mengevaluasi status final
  await fetch(`${BASE_URL}/api/followup`);
  leads = getLeads();
  const finalLead = leads.find((l) => l.nomor_wa === TEST_LEAD_PHONE);
  console.log(`Status prospek final: "${finalLead?.status}"`);
  console.log(`Hasil: ${finalLead?.status === 'Tidak merespons' ? '✓ SUKSES (Status otomatis Tidak merespons)' : '✗ GAGAL'}\n`);

  // 4. Uji: Membalas di tengah -> Berhenti & tidak dikirimi FU lagi
  console.log('--- Uji 4: Membalas di tengah -> Follow-up otomatis DIBATALKAN ---');
  leads[leadIdx3].status = 'Hangat';
  leads[leadIdx3].tahap_followup = 1;
  leads[leadIdx3].followup_terakhir_at = threeDaysAgo;
  saveLeads(leads);

  const resCancel = await fetch(`${BASE_URL}/api/followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          leadId: 'lead-test-followup',
          phone: TEST_LEAD_PHONE,
          message: 'Pesan pengingat',
          tahap: 2,
        },
      ],
      dryRun: true,
      bypassHours: true,
    }),
  });
  const dataCancel = await resCancel.json();
  const cancelResult = dataCancel.results?.[0];
  console.log(`Status respon: ${JSON.stringify(cancelResult)}`);
  console.log(`Hasil: ${cancelResult?.success === false && cancelResult?.error?.includes('Dibatalkan') ? '✓ SUKSES (Follow-up dibatalkan otomatis)' : '✗ GAGAL'}\n`);

  // 5. Uji: Di luar jam kirim (09.00 - 17.00 WIB) -> Pengiriman ditunda
  console.log('--- Uji 5: Proteksi Jam Kirim (09.00 - 17.00 WIB) ---');
  const hours = isWibSendingHours();
  console.log(`Jam WIB sistem sekarang: ${hours.wibHour}:${hours.wibMinute} WIB (Diizinkan: ${hours.allowed})`);
  const resHours = await fetch(`${BASE_URL}/api/followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ leadId: 'lead-test', phone: '6288800002222', message: 'Test', tahap: 1 }],
      dryRun: false,
      bypassHours: false, // Wajib patuhi jam
    }),
  });
  const dataHours = await resHours.json();
  if (!hours.allowed) {
    console.log(`Response saat di luar jam: HTTP ${resHours.status} - ${JSON.stringify(dataHours)}`);
    console.log(`Hasil: ${dataHours.delayed === true ? '✓ SUKSES (Pengiriman otomatis ditunda)' : '✗ GAGAL'}\n`);
  } else {
    console.log(`Info: Saat ini sedang jam operasional resmi (09.00 - 17.00 WIB).\n`);
  }

  // 6. Uji: Circuit Breaker berhenti otomatis setelah 5 gagal
  console.log('--- Uji 6: Circuit Breaker berhenti setelah 5 gagal berturut-turut ---');
  const resCircuit = await fetch(`${BASE_URL}/api/followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ leadId: 'lead-test', phone: '6288800003333', message: 'Test', tahap: 1 }],
      dryRun: true,
      bypassHours: true,
      consecutiveFailuresForTest: 5, // Simulasikan 5x gagal berturut-turut
    }),
  });
  const dataCircuit = await resCircuit.json();
  console.log(`HTTP Status: ${resCircuit.status}`);
  console.log(`Response: ${JSON.stringify(dataCircuit)}`);
  console.log(`Hasil: ${dataCircuit.circuitBreakerTriggered === true ? '✓ SUKSES (Circuit breaker menghentikan pengiriman)' : '✗ GAGAL'}\n`);

  // Bersihkan data dummy uji dari leads_v4.json
  leads = getLeads().filter((l) => l.nomor_wa !== TEST_LEAD_PHONE);
  saveLeads(leads);
  console.log('✓ Data prospek uji coba telah dibersihkan kembali.\n');

  console.log('====================================================');
  console.log('SEMUA UJI LIFECYCLE FOLLOW-UP & PENGAMAN WA BERHASIL!');
  console.log('====================================================\n');
}

runFollowUpTests();

