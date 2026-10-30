import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getLeads,
  saveLeads,
  addMessage,
  addLog,
  getSettings,
  saveSettings,
  maskPhoneNumber,
} from '@/lib/leads-store';
import { normalizeIndonesianPhone } from '@/lib/defensive-client';

export const dynamic = 'force-dynamic';

// Processed message cache to guarantee idempotency
const processedHashes = new Set<string>();

export function isConservativeRejection(message: string): boolean {
  const low = message.toLowerCase().trim();

  // 1. False positive guard: kata ambigu bernada positif TIDAK boleh ditolak (PRD 10.5)
  if (
    low.includes('tidak masalah') ||
    low.includes('tidak apa-apa') ||
    low.includes('tidak keberatan') ||
    low.includes('tidak buru-buru') ||
    low.includes('boleh') ||
    low.includes('silakan') ||
    low.includes('kirim aja') ||
    low.includes('mau tanya')
  ) {
    return false;
  }

  // 2. Frasa penolakan eksplisit
  const explicitPhrases = [
    'jangan hubungi',
    'jangan wa lagi',
    'jangan chat lagi',
    'tidak tertarik',
    'gak tertarik',
    'salah sambung',
    'salah nomor',
    'bukan saya',
    'bukan klinik',
    'bukan toko',
    'bukan villa',
    'hapus nomor',
    'blokir',
    'unsub',
  ];

  if (explicitPhrases.some((phrase) => low.includes(phrase))) {
    return true;
  }

  // 3. Kata 'stop' dengan word boundary (mencegah salah deteksi pada 'desktop' atau 'nonstop')
  if (/\bstop\b/i.test(low)) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    // 10.2 Keamanan: verifikasi secret webhook Fonnte wajib (401 jika tidak cocok)
    const expectedSecret = process.env.FONNTE_WEBHOOK_SECRET || 'leads_machine_webhook_secret_2026';
    const authHeader = req.headers.get('authorization') || '';
    const xSecret = req.headers.get('x-fonnte-secret') || req.headers.get('x-secret') || '';
    const urlSecret = req.nextUrl.searchParams.get('secret') || '';

    // Read body (form data or json)
    let body: Record<string, any> = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        formData.forEach((val, key) => {
          body[key] = typeof val === 'string' ? val : '';
        });
      }
    }

    const bodySecret = String(body.secret || '');

    const isValid =
      authHeader === expectedSecret ||
      authHeader === `Bearer ${expectedSecret}` ||
      xSecret === expectedSecret ||
      urlSecret === expectedSecret ||
      bodySecret === expectedSecret;

    if (!isValid) {
      addLog({
        nomor_disamarkan: 'UNKNOWN',
        arah: 'terima',
        status: 'gagal',
        alasan_gagal: 'Akses webhook ditolak: secret tidak valid',
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid webhook secret' },
        { status: 401 }
      );
    }

    // 10.1 Payload Fonnte fields
    const rawSender = String(body.sender || body.from || '');
    const message = String(body.message || body.text || '').trim();
    const pushName = String(body.name || body.pushName || '');
    const device = String(body.device || '');
    const timestamp = body.timestamp ? String(body.timestamp) : new Date().toISOString();
    const inboxId = String(body.inboxid || body.id || '');

    if (!rawSender || !message) {
      return NextResponse.json({ success: true, message: 'No sender or message' });
    }

    // 10.6 Idempotency: cek sender + timestamp + hash message
    const messageHash = crypto
      .createHash('md5')
      .update(`${rawSender}:${timestamp}:${message}:${inboxId}`)
      .digest('hex');

    if (processedHashes.has(messageHash)) {
      return NextResponse.json({ success: true, message: 'Duplicate webhook ignored' });
    }
    processedHashes.add(messageHash);
    if (processedHashes.size > 2000) {
      const firstItem = processedHashes.values().next().value;
      if (firstItem) processedHashes.delete(firstItem);
    }

    // 10.3 Pencocokan: normalisasi nomor telepon
    const cleanSender = normalizeIndonesianPhone(rawSender.replace(/@c\.us$/, ''));
    if (!cleanSender) {
      return NextResponse.json({ success: true, message: 'Invalid phone format' });
    }

    const allLeads = getLeads();
    const targetLeadIndex = allLeads.findIndex((l) => l.nomor_wa === cleanSender);

    // Update settings: last webhook timestamp & 24h count
    const settings = getSettings();
    saveSettings({
      last_webhook_at: new Date().toISOString(),
      webhook_count_24h: (settings.webhook_count_24h || 0) + 1,
    });

    // Privasi: Jika bukan nomor prospek di database, abaikan dan jangan simpan
    if (targetLeadIndex === -1) {
      addLog({
        nomor_disamarkan: maskPhoneNumber(cleanSender),
        arah: 'terima',
        status: 'sukses',
        alasan_gagal: 'Pesan masuk dari nomor non-prospek (diabaikan untuk privasi)',
      });
      return NextResponse.json({
        success: true,
        matched: false,
        message: 'Non-lead message ignored',
      });
    }

    const targetLead = allLeads[targetLeadIndex];

    // 10.4 & 10.5 Analisis penolakan vs minat secara konservatif
    const isExplicitRejection = isConservativeRejection(message);

    // Save message record
    addMessage({
      prospek_id: targetLead.id,
      nomor_wa: cleanSender,
      arah: 'masuk',
      isi: message,
      status: 'diterima',
    });

    if (isExplicitRejection) {
      // 10.5 Status Ditolak & jangan_hubungi = true
      targetLead.status = 'Ditolak';
      targetLead.jangan_hubungi = true;
      targetLead.balasan_at = new Date().toISOString();
      targetLead.balasan_terakhir = message;
      targetLead.diubah_at = new Date().toISOString();
      allLeads[targetLeadIndex] = targetLead;
      saveLeads(allLeads);

      addLog({
        prospek_id: targetLead.id,
        nomor_disamarkan: maskPhoneNumber(cleanSender),
        arah: 'terima',
        status: 'sukses',
        alasan_gagal: `Prospek menolak: "${message.slice(0, 30)}..."`,
      });

      // Update Sheets in background
      try {
        const sheetUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
        if (sheetUrl) {
          fetch(sheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: cleanSender,
              status: 'REJECTED',
              businessName: targetLead.nama_bisnis,
              notes: `Ditolak via WhatsApp: ${message}`,
            }),
          }).catch(() => {});
        }
      } catch {}

      return NextResponse.json({
        success: true,
        matched: true,
        leadId: targetLead.id,
        status: 'Ditolak',
      });
    }

    // 10.4 Status Hangat & batalkan follow-up tersisa
    targetLead.status = 'Hangat';
    targetLead.balasan_at = new Date().toISOString();
    targetLead.balasan_terakhir = message;
    targetLead.jadwal_berikutnya_at = undefined; // Batalkan jadwal follow-up
    targetLead.diubah_at = new Date().toISOString();
    allLeads[targetLeadIndex] = targetLead;
    saveLeads(allLeads);

    addLog({
      prospek_id: targetLead.id,
      nomor_disamarkan: maskPhoneNumber(cleanSender),
      arah: 'terima',
      status: 'sukses',
      alasan_gagal: `Balasan diterima (Hangat): "${message.slice(0, 30)}..."`,
    });

    // Update Sheets in background
    try {
      const sheetUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
      if (sheetUrl) {
        fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanSender,
            status: 'INTERESTED',
            businessName: targetLead.nama_bisnis,
            notes: `Balasan masuk: ${message}`,
          }),
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json({
      success: true,
      matched: true,
      leadId: targetLead.id,
      status: 'Hangat',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Kesalahan internal webhook';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

