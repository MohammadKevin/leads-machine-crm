import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, normalizeIndonesianPhone } from '@/lib/defensive-client';
import { SheetResponseStatus } from '@/types/outreach';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { phone, status, businessName } = body as {
      phone?: string;
      status?: SheetResponseStatus;
      businessName?: string;
    };

    if (!phone || !status) {
      return NextResponse.json(
        { success: false, error: 'Nomor telepon dan status wajib disediakan.' },
        { status: 400 }
      );
    }

    const cleanPhone = normalizeIndonesianPhone(phone);
    const sheetUrl =
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    if (!sheetUrl) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_SHEETS_WEBAPP_URL belum dikonfigurasi.' },
        { status: 500 }
      );
    }

    const payload = {
      action: 'update_status',
      phone: cleanPhone,
      normalized_phone: cleanPhone,
      status,
      lead_status: status,
      business_name: businessName || '',
      last_sync_at: new Date().toISOString(),
    };

    const res = await fetchWithRetry(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 10000,
      retries: 2,
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Google Sheets mengembalikan HTTP ${res.status}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      phone: cleanPhone,
      status,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Gagal memperbarui status di Google Sheets.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
