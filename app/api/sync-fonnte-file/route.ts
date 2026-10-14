import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';
import { fetchWithRetry, normalizeIndonesianPhone } from '@/lib/defensive-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  try {
    // 1. Baca File dari Disk
    const filePath = path.join(process.cwd(), 'public', 'fonnte-history.xlsx');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        {
          success: false,
          message: 'File public/fonnte-history.xlsx tidak ditemukan.',
        },
        { status: 404 }
      );
    }

    // 2. Parsing & Ekstraksi Kolom 'Target'
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName || !workbook.Sheets[sheetName]) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sheet pertama pada file fonnte-history.xlsx kosong atau tidak terbaca.',
        },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);

    // 3. Normalisasi Format Nomor Telepon Indonesia
    const extractedNumbers = new Set<string>();
    for (const row of rows) {
      const rawTarget =
        row['Target'] ??
        row['target'] ??
        row['TARGET'] ??
        row['Recipient'] ??
        row['recipient'] ??
        '';

      if (!rawTarget) continue;

      // Hapus karakter non-digit
      const digits = String(rawTarget).replace(/\D/g, '');
      if (!digits) continue;

      let norm = digits;
      if (norm.startsWith('0')) {
        norm = '62' + norm.slice(1);
      } else if (norm.startsWith('8')) {
        norm = '62' + norm;
      }

      // Pastikan panjang nomor valid (10-15 digit) dan berawalan 628
      if (norm.startsWith('628') && norm.length >= 10 && norm.length <= 15) {
        extractedNumbers.add(norm);
      }
    }

    if (extractedNumbers.size === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Tidak ditemukan nomor telepon valid pada kolom Target di file Excel.',
        },
        { status: 400 }
      );
    }

    // 4. Cek Nomor yang Sudah Ada di Google Sheets
    const sheetUrl =
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    if (!sheetUrl) {
      return NextResponse.json(
        {
          success: false,
          message: 'GOOGLE_SHEETS_WEBAPP_URL belum dikonfigurasi di environment.',
        },
        { status: 500 }
      );
    }

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
          message: `Google Sheets Apps Script mengembalikan status HTTP ${sheetsRes.status}`,
        },
        { status: 502 }
      );
    }

    const sheetsJson = await sheetsRes.json().catch(() => null);
    if (!sheetsJson || sheetsJson.status !== 'success' || !Array.isArray(sheetsJson.data)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Format data respon Google Sheets tidak sesuai.',
        },
        { status: 502 }
      );
    }

    const existingInSheets = new Set<string>();
    for (const item of sheetsJson.data) {
      const rawPhone =
        item.normalized_phone ||
        item.normalizedPhone ||
        item.phone_number ||
        item.phone ||
        item.no_telepon ||
        '';
      const cleanPhone = normalizeIndonesianPhone(rawPhone);
      if (cleanPhone) {
        existingInSheets.add(cleanPhone);
      }
    }

    const numbersToInsert: string[] = [];
    let alreadyExisted = 0;

    for (const phone of extractedNumbers) {
      if (existingInSheets.has(phone)) {
        alreadyExisted++;
      } else {
        numbersToInsert.push(phone);
      }
    }

    // 5. Kirim Nomor Baru ke Google Sheets Web App (Batch Paralel)
    const insertedNumbers: string[] = [];
    const BATCH_SIZE = 8;
    const timestamp = new Date().toISOString();

    for (let i = 0; i < numbersToInsert.length; i += BATCH_SIZE) {
      const batch = numbersToInsert.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (phone) => {
          try {
            const payload = {
              action: 'sync_lead',
              phone: phone,
              phone_number: phone,
              normalized_phone: phone,
              status: 'EXISTING_CHAT',
              lead_status: 'EXISTING_CHAT',
              businessName: 'History Fonnte',
              business_name: 'History Fonnte',
              category: 'WhatsApp History',
              timestamp,
              last_sync_at: timestamp,
              generated_pitch: 'Import riwayat pesan dari public/fonnte-history.xlsx',
            };

            const res = await fetchWithRetry(sheetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              timeoutMs: 12000,
              retries: 1,
            });

            if (res.ok) {
              insertedNumbers.push(phone);
            }
          } catch {
            // Lanjutkan jika ada kegagalan individu agar proses bulk tidak berhenti
          }
        })
      );
    }

    // 6. Respons API
    return NextResponse.json({
      success: true,
      totalInFile: extractedNumbers.size,
      newInserted: insertedNumbers.length,
      alreadyExisted,
      message: `Berhasil membaca ${extractedNumbers.size} nomor dari fonnte-history.xlsx! ${insertedNumbers.length} nomor baru disinkronkan ke Google Sheets (${alreadyExisted} sudah terdaftar).`,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses fonnte-history.xlsx.';
    return NextResponse.json(
      {
        success: false,
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
