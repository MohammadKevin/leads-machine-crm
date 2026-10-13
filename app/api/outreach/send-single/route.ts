import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, normalizeIndonesianPhone, isValidIndonesianWhatsApp } from '@/lib/defensive-client';
import { OutreachLead } from '@/types/outreach';

export const dynamic = 'force-dynamic';

function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const lead = body?.lead as OutreachLead | undefined;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!lead || !lead.phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Data lead dan pesan wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanPhone = normalizeIndonesianPhone(lead.phone);
    if (!cleanPhone || !isValidIndonesianWhatsApp(cleanPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: `Nomor telepon ${lead.phone} tidak valid untuk pengiriman WhatsApp.`,
        },
        { status: 400 }
      );
    }

    const token = process.env.FONNTE_API_TOKEN || process.env.FONNTE_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'FONNTE_API_TOKEN belum dikonfigurasi di environment variable server.',
        },
        { status: 500 }
      );
    }

    // 1. Kirim pesan melalui Fonnte Gateway
    const formData = new FormData();
    formData.append('target', cleanPhone);
    formData.append('message', message);
    formData.append('countryCode', '62');

    let fonnteData: unknown = null;
    try {
      const fonnteRes = await fetchWithRetry('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: formData,
        timeoutMs: 15000,
        retries: 1,
      });

      fonnteData = await fonnteRes.json().catch(() => null);

      if (!fonnteRes.ok || (fonnteData && typeof fonnteData === 'object' && (fonnteData as any).status === false)) {
        const reason =
          (fonnteData as any)?.reason ||
          (fonnteData as any)?.message ||
          'Gagal mengirim pesan melalui Fonnte Gateway.';
        return NextResponse.json(
          {
            success: false,
            error: reason,
            fonnteData,
          },
          { status: 400 }
        );
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Kesalahan jaringan/timeout saat menghubungi Fonnte.';
      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
        },
        { status: 502 }
      );
    }

    // 2. Fonnte sukses -> POST ke Google Sheets
    const sheetUrl =
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    let sheetsSynced = false;
    let sheetsError: string | null = null;

    if (sheetUrl) {
      const timestampFormatted = formatTimestamp();
      const sheetsPayload = {
        action: 'insert',
        timestamp: timestampFormatted,
        businessName: lead.businessName,
        business_name: lead.businessName,
        category: lead.category,
        city: lead.city,
        phone: cleanPhone,
        phone_number: cleanPhone,
        normalized_phone: cleanPhone,
        maps_url: lead.address || lead.city || '',
        rating: Number(lead.rating || 0),
        reviewsCount: Number(lead.reviewsCount || 0),
        review_count: Number(lead.reviewsCount || 0),
        hasWebsite: Boolean(lead.hasWebsite),
        website: lead.website || null,
        website_asli: lead.website || null,
        status: 'CONTACTED',
        lead_status: 'CONTACTED',
        messageSent: message,
        draft_pitch_wa: message,
        generated_pitch: message,
        last_sync_at: new Date().toISOString(),
      };

      try {
        const sheetRes = await fetchWithRetry(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetsPayload),
          timeoutMs: 12000,
          retries: 2,
        });

        if (sheetRes.ok) {
          sheetsSynced = true;
        } else {
          sheetsError = `Google Sheets HTTP status ${sheetRes.status}`;
          console.error(
            `[CRITICAL ERROR] Gagal insert ke Google Sheets untuk nomor ${cleanPhone}:`,
            sheetsError
          );
        }
      } catch (err: unknown) {
        sheetsError =
          err instanceof Error ? err.message : 'Timeout / Network error pada Google Sheets';
        console.error(
          `[CRITICAL ERROR] Exception saat insert ke Google Sheets untuk nomor ${cleanPhone}:`,
          err
        );
      }
    } else {
      sheetsError = 'GOOGLE_SHEETS_WEBAPP_URL belum dikonfigurasi.';
      console.warn('[WARN] Google Sheets Web App URL tidak tersedia.');
    }

    return NextResponse.json({
      success: true,
      whatsappSent: true,
      phone: cleanPhone,
      sheetsSynced,
      pendingSync: !sheetsSynced,
      sheetsError,
      fonnteData,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kegagalan server internal saat pengiriman.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
