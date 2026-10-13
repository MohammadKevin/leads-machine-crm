/**
 * ==============================================================================
 * DEFENSIVE HTTP CLIENT & PHONE NORMALIZATION UTILITIES
 * ==============================================================================
 */

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

/**
 * Normalisasi nomor telepon Indonesia ke format standar internasional: 628xxxxxxxxxx
 * Menangani format: 08xx, +62xx, 62xx, 8xx, 620xx, spasi, tanda hubung, dan tanda kurung.
 */
export function normalizeIndonesianPhone(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';

  let normalized = digits;

  // Handle leading 0 -> 62
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  }
  // Handle 8xxxxxxxx -> 628xxxxxxxx
  else if (normalized.startsWith('8')) {
    normalized = '62' + normalized;
  }
  // Handle typo 6208xxx -> 628xxx
  else if (normalized.startsWith('620')) {
    normalized = '62' + normalized.slice(3);
  }

  // Validasi nomor WhatsApp seluler Indonesia: wajib berawalan 628 dan panjang 10 - 15 digit
  if (normalized.startsWith('628') && normalized.length >= 10 && normalized.length <= 15) {
    return normalized;
  }

  // Jika berawalan 62 tapi bukan 628 (misal PSTN / landline), tetap kembalikan jika valid
  if (normalized.startsWith('62') && normalized.length >= 9 && normalized.length <= 15) {
    return normalized;
  }

  return '';
}

/**
 * Validasi apakah nomor merupakan nomor WhatsApp seluler Indonesia yang valid (628xxxxxxxxxx)
 */
export function isValidIndonesianWhatsApp(raw?: string | null): boolean {
  const normalized = normalizeIndonesianPhone(raw);
  return Boolean(normalized && normalized.startsWith('628') && normalized.length >= 10 && normalized.length <= 15);
}

/**
 * Format nomor untuk tampilan UI yang nyaman dibaca (e.g. +62 812-3456-7890)
 */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '-';
  const clean = normalizeIndonesianPhone(phone);
  if (!clean) return phone;

  if (clean.startsWith('628')) {
    const prefix = clean.slice(0, 4); // 6281
    const mid = clean.slice(4, 8);    // 2345
    const rest = clean.slice(8);      // 67890
    return `+62 ${prefix.slice(2)}-${mid}-${rest}`;
  }

  return `+${clean}`;
}

/**
 * Fetch defensif dengan timeout AbortController dan retry backoff
 */
export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 12000,
    retries = 2,
    backoffMs = 800,
    ...fetchInit
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Jika response 5xx, coba retry jika masih ada kuota attempt
      if (response.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        continue;
      }

      return response;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error(`Gagal menghubungi ${url} setelah ${retries + 1} percobaan.`);
}
