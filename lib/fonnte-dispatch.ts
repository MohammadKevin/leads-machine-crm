export interface FoonteDispatchPayload {
  target: string;
  message: string;
  token?: string;
}

export interface FoonteDispatchResult {
  success: boolean;
  target: string;
  error?: string;
  details?: unknown;
}

export async function sendWhatsAppMessage(
  payload: FoonteDispatchPayload
): Promise<FoonteDispatchResult> {
  const { target, message, token: customToken } = payload;

  const token = customToken || process.env.FONNTE_API_TOKEN;

  if (!token) {
    return {
      success: false,
      target,
      error: 'FONNTE_API_TOKEN belum dikonfigurasi di environment.',
    };
  }

  const digitsOnly = target.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return {
      success: false,
      target,
      error: `Nomor ${target} tidak valid.`,
    };
  }

  const formData = new FormData();
  formData.append('target', digitsOnly);
  formData.append('message', message.trim());
  formData.append('countryCode', '62');

  try {
    const fonnteRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const data = await fonnteRes.json().catch(() => null);

    if (!fonnteRes.ok || (data && data.status === false)) {
      const reason = data?.reason || data?.message || 'Gagal mengirim pesan melalui Fonnte Gateway.';
      return {
        success: false,
        target: digitsOnly,
        error: reason,
        details: data,
      };
    }

    return {
      success: true,
      target: digitsOnly,
      details: data,
    };
  } catch (err) {
    return {
      success: false,
      target: digitsOnly,
      error: err instanceof Error ? err.message : 'Kesalahan jaringan saat mengirim ke Fonnte.',
    };
  }
}