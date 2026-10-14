import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, normalizeIndonesianPhone, isValidIndonesianWhatsApp } from '@/lib/defensive-client';

export const dynamic = 'force-dynamic';

interface SyncPayloadItem {
  target?: string;
  recipient?: string;
  phone?: string;
  to?: string;
  number?: string;
  name?: string;
  message?: string;
  timestamp?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const manualNumbers: string[] = Array.isArray(body?.numbers) ? body.numbers : [];

    const token = process.env.FONNTE_TOKEN || process.env.FONNTE_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'FONNTE_TOKEN / FONNTE_API_TOKEN belum dikonfigurasi di environment variable server.',
        },
        { status: 500 }
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
    // 1. AMBIL RIWAYAT PESAN DARI FONNTE API
    // ──────────────────────────────────────────────────────────────────────────
    const fonnteTargets = new Set<string>();
    const fonnteTargetNames = new Map<string, string>();

    // Tambahkan input manual jika disediakan oleh operator
    for (const num of manualNumbers) {
      const clean = normalizeIndonesianPhone(num);
      if (clean && isValidIndonesianWhatsApp(clean)) {
        fonnteTargets.add(clean);
      }
    }

    // Panggil Fonnte get-messages (POST dan fallback GET)
    let fonnteResponseStatus = 'uncalled';
    try {
      let fonnteRes = await fetchWithRetry('https://api.fonnte.com/get-messages', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        timeoutMs: 12000,
        retries: 1,
      });

      if (!fonnteRes.ok) {
        fonnteRes = await fetchWithRetry('https://api.fonnte.com/get-messages', {
          method: 'GET',
          headers: {
            Authorization: token,
          },
          timeoutMs: 12000,
          retries: 1,
        });
      }

      fonnteResponseStatus = `HTTP_${fonnteRes.status}`;

      if (fonnteRes.ok) {
        const fonnteJson = await fonnteRes.json().catch(() => null);
        const rawList: SyncPayloadItem[] = Array.isArray(fonnteJson)
          ? fonnteJson
          : Array.isArray(fonnteJson?.data)
          ? fonnteJson.data
          : Array.isArray(fonnteJson?.messages)
          ? fonnteJson.messages
          : Array.isArray(fonnteJson?.rows)
          ? fonnteJson.rows
          : [];

        for (const item of rawList) {
          const rawPhone =
            item.target || item.recipient || item.phone || item.to || item.number || '';
          const clean = normalizeIndonesianPhone(rawPhone);
          if (clean && isValidIndonesianWhatsApp(clean)) {
            fonnteTargets.add(clean);
            if (item.name && typeof item.name === 'string') {
              fonnteTargetNames.set(clean, item.name.trim());
            }
          }
        }
      }
    } catch (fonnteErr) {
      fonnteResponseStatus =
        fonnteErr instanceof Error ? fonnteErr.message : 'network_error';
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. AMBIL DATABASE NOMOR DARI GOOGLE SHEETS
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
    // 3. COCOKKAN DAN FILTER NOMOR YANG BELUM ADA DI SHEETS
    // ──────────────────────────────────────────────────────────────────────────
    const toImport: string[] = [];
    for (const phone of fonnteTargets) {
      if (!existingInSheets.has(phone)) {
        toImport.push(phone);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. KIRIM DATA KE GOOGLE SHEETS WEB APP (STATUS: EXISTING_CHAT / CONTACTED_MANUAL)
    // ──────────────────────────────────────────────────────────────────────────
    const importedNumbers: string[] = [];
    for (const phone of toImport) {
      try {
        const customName = fonnteTargetNames.get(phone);
        const payload = {
          action: 'sync_lead',
          business_name: customName || `Kontak WA (${phone.slice(-4)})`,
          category: 'WhatsApp History',
          phone_number: phone,
          normalized_phone: phone,
          maps_url: '',
          rating: 0,
          review_count: 0,
          website: '',
          lead_status: 'EXISTING_CHAT',
          status: 'EXISTING_CHAT',
          rejection_reason: '',
          generated_pitch: 'Riwayat pesan keluar WhatsApp Fonnte',
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
        // Abaikan kegagalan individu dan lanjutkan antrean
      }
    }

    const totalFonnte = fonnteTargets.size;
    const newImported = importedNumbers.length;

    let message = '';
    if (newImported > 0) {
      message = `[SYNC WA] Berhasil mengimpor ${newImported} nomor riwayat WhatsApp lama ke Google Sheets!`;
    } else if (totalFonnte > 0) {
      message = `[SYNC WA] Semua nomor riwayat WhatsApp (${totalFonnte} nomor) sudah terdaftar di Google Sheets.`;
    } else {
      message = `[SYNC WA] Tidak ada riwayat pesan keluar baru yang ditemukan di Fonnte (${fonnteResponseStatus}).`;
    }

    return NextResponse.json({
      success: true,
      totalFonnte,
      existingInSheets: existingInSheets.size,
      newImported,
      importedNumbers,
      fonnteResponseStatus,
      message,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Kesalahan jaringan saat sinkronisasi riwayat WA.';
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
