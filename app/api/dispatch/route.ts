import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/fonnte-dispatch';
import { normalizeWhatsAppNumber } from '@/lib/phone-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prospectId, phone, message, businessName } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Nomor tujuan (phone) wajib diisi.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Pesan (message) tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeWhatsAppNumber(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: `Nomor ${phone} tidak valid.` },
        { status: 400 }
      );
    }

    const dispatchResult = await sendWhatsAppMessage({
      target: normalizedPhone,
      message: message.trim(),
    });

    if (!dispatchResult.success) {
      return NextResponse.json(
        {
          success: false,
          prospectId,
          phone: normalizedPhone,
          error: dispatchResult.error || 'Gagal mengirim via Foonte.',
          details: dispatchResult.details,
        },
        { status: 400 }
      );
    }

    const targetUrl =
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    let syncedToSheets = false;

    if (targetUrl) {
      try {
        const sheetRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: businessName || prospectId || 'Prospek',
            phone_number: phone,
            normalized_phone: normalizedPhone,
            category: '',
            lead_status: 'CONTACTED',
            last_sync_at: new Date().toISOString(),
          }),
        });

        if (sheetRes.ok) {
          syncedToSheets = true;
        }
      } catch {
        syncedToSheets = false;
      }
    }

    return NextResponse.json({
      success: true,
      prospectId,
      phone: normalizedPhone,
      businessName: businessName || 'Prospek',
      sentToSheets: syncedToSheets,
      message: 'Pesan berhasil dikirim dan status diperbarui ke CONTACTED.',
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'Terjadi kesalahan pada server saat dispatch.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}