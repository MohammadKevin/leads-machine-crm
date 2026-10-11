import { NextRequest, NextResponse } from 'next/server';
import { cleanPhoneNumber } from '@/lib/phone-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = typeof body?.target === 'string' ? body.target.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Nomor tujuan (target) wajib diisi.' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Pesan (message) tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const phoneAnalysis = cleanPhoneNumber(target);
    if (!phoneAnalysis.isValid || !phoneAnalysis.isMobile) {
      return NextResponse.json(
        {
          success: false,
          error: `Nomor ${target} bukan nomor WhatsApp seluler yang valid (${phoneAnalysis.notes}).`,
        },
        { status: 400 }
      );
    }

    const token = process.env.FONNTE_TOKEN || process.env.FONNTE_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'FONNTE_TOKEN belum dikonfigurasi di environment.' },
        { status: 400 }
      );
    }

    const formData = new FormData();
    formData.append('target', phoneAnalysis.cleaned);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const fonnteRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });

    const result = await fonnteRes.json().catch(() => null);

    if (!fonnteRes.ok || (result && result.status === false)) {
      const reason =
        result?.reason || result?.message || 'Gagal mengirim pesan melalui Fonnte Gateway.';
      return NextResponse.json(
        {
          success: false,
          error: reason,
          data: result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      target: phoneAnalysis.cleaned,
      data: result,
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'Terjadi kesalahan pada server saat mengirim pesan.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
