import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, normalizeIndonesianPhone, isValidIndonesianWhatsApp } from '@/lib/defensive-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Endpoint internal untuk import riwayat chat WhatsApp lama secara bulk ke Google Sheets.
 * Mencegah nomor-nomor yang sudah pernah di-chat dihubungi ulang oleh bot (Anti-Duplikasi).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawInput = body?.numbers;

    // Ekstrak daftar nomor dari array atau string teks (pisah enter / koma / spasi)
    let candidateList: string[] = [];
    if (Array.isArray(rawInput)) {
      candidateList = rawInput.map((n) => String(n));
    } else if (typeof rawInput === 'string' && rawInput.trim()) {
      candidateList = rawInput
        .split(/[\r\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // Normalisasi dan validasi nomor ke format standar 628xxx
    const validCleanPhones = new Set<string>();
    for (const raw of candidateList) {
      const clean = normalizeIndonesianPhone(raw);
      if (clean && isValidIndonesianWhatsApp(clean)) {
        validCleanPhones.add(clean);
      }
    }

    if (validCleanPhones.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tidak ditemukan nomor WhatsApp valid (format seluler 08xx / 628xx) dalam input yang ditempel.',
          totalSubmitted: 0,
          newImported: 0,
        },
        { status: 400 }
      );
    }

    const sheetUrl =
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    if (!sheetUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'GOOGLE_SHEETS_WEBAPP_URL belum dikonfigurasi di environment.',
        },
        { status: 500 }
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. AMBIL DATABASE NOMOR DARI GOOGLE SHEETS
    // ──────────────────────────────────────────────────────────────────────────
    const sheetsRes = await fetchWithRetry(sheetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: 15000,
      retries: 2,
    });

    if (!sheetsRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Google Sheets Apps Script mengembalikan status HTTP ${sheetsRes.status}`,
        },
        { status: 502 }
      );
    }

    const sheetsJson = await sheetsRes.json().catch(() => null);
    if (!sheetsJson || sheetsJson.status !== 'success' || !Array.isArray(sheetsJson.data)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format data respon Google Sheets tidak sesuai.',
        },
        { status: 502 }
      );
    }

    const existingInSheets = new Set<string>();
    for (const row of sheetsJson.data) {
      const raw =
        row.normalized_phone ||
        row.normalizedPhone ||
        row.phone_number ||
        row.phone ||
        row.no_telepon ||
        '';
      const clean = normalizeIndonesianPhone(raw);
      if (clean) existingInSheets.add(clean);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. FILTER NOMOR YANG BELUM ADA DI SHEETS
    // ──────────────────────────────────────────────────────────────────────────
    const toImport: string[] = [];
    let alreadyExistingCount = 0;

    for (const phone of validCleanPhones) {
      if (existingInSheets.has(phone)) {
        alreadyExistingCount++;
      } else {
        toImport.push(phone);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. KIRIM KE GOOGLE SHEETS DENGAN STATUS EXISTING_CHAT (CONCURRENT CHUNKS)
    // ──────────────────────────────────────────────────────────────────────────
    const importedNumbers: string[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const chunk = toImport.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map(async (phone) => {
          try {
            const payload = {
              action: 'sync_lead',
              business_name: `Kontak WA Lama (${phone.slice(-4)})`,
              category: 'WhatsApp Import',
              phone_number: phone,
              normalized_phone: phone,
              maps_url: '',
              rating: 0,
              review_count: 0,
              website: '',
              lead_status: 'EXISTING_CHAT',
              status: 'EXISTING_CHAT',
              rejection_reason: '',
              generated_pitch: 'Nomor riwayat chat WhatsApp lama (Import Manual Anti-Duplikat)',
              last_sync_at: new Date().toISOString(),
            };

            const res = await fetchWithRetry(sheetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              timeoutMs: 12000,
              retries: 1,
            });

            if (res.ok) {
              importedNumbers.push(phone);
            }
          } catch {
            // Abaikan kegagalan individu agar proses bulk tetap lanjut
          }
        })
      );
    }

    const message =
      importedNumbers.length > 0
        ? `[SYNC WA] Berhasil mengimpor ${importedNumbers.length} nomor riwayat WhatsApp lama ke Google Sheets!`
        : `[SYNC WA] Semua ${validCleanPhones.size} nomor yang ditempel sudah terdaftar di Google Sheets (0 duplikat baru).`;

    return NextResponse.json({
      success: true,
      totalSubmitted: validCleanPhones.size,
      alreadyInSheets: alreadyExistingCount,
      newImported: importedNumbers.length,
      importedNumbers,
      message,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Kesalahan jaringan saat impor riwayat nomor WA.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
