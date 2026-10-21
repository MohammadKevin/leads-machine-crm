import { NextResponse } from 'next/server';
import crypto from 'crypto';

const ENCRYPTION_KEY_STR = 'GeraiKitaProdEncryptKey2026XXX01';
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_STR, 'utf8');

function generateTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function sha256Hex(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function sha256Bytes(str: string): Buffer {
  return crypto.createHash('sha256').update(str, 'utf8').digest();
}

function md5Hex(bufOrStr: Buffer | string): string {
  return crypto.createHash('md5').update(bufOrStr).digest('hex');
}

function aesEncrypt(text: string, keyBuf: Buffer, ivBuf: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, ivBuf);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
}

function createEncryptedHeaders(): Record<string, string> {
  const t = generateTimestamp();
  const iv = sha256Bytes(t).slice(0, 16);
  const emptyHash = sha256Hex('');
  const data = `${t}|${emptyHash}`;
  const encryptedBytes = aesEncrypt(data, ENCRYPTION_KEY, iv);
  const hexStr = encryptedBytes.toString('hex');
  const signature = md5Hex(hexStr);

  return {
    Timestamp: t,
    Signature: signature,
  };
}

function decryptResponse(ciphertextBase64: string, ivBase64: string): Record<string, unknown> | null {
  try {
    const iv = Buffer.from(ivBase64, 'base64');
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

function formatTokens(n: number): string {
  if (n >= 1000000) {
    const m = (n / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${m}M Token`;
  }
  if (n >= 1000) {
    const k = Math.round(n / 1000);
    return `${k}K Token`;
  }
  return `${n.toLocaleString('id-ID')} Token`;
}

export async function GET() {
  const apiKey = process.env.GERAIKITA_API_KEY || 'gk-bD6TbeKscdQM4dqidveYbIIm7IjUWskTlOJi6MOT';
  const sessionCookie = process.env.GERAIKITA_COOKIE || process.env.GERAIKITA_AUTH_TOKEN;

  if (sessionCookie) {
    try {
      const encHeaders = createEncryptedHeaders();
      const cookieHeader = sessionCookie.includes('=')
        ? sessionCookie
        : `token=${sessionCookie}; gk_token=${sessionCookie}`;

      const [resBal, resMe] = await Promise.all([
        fetch('https://api.geraikita.com/api/v1/balance', {
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Authorization: sessionCookie.startsWith('Bearer ') ? sessionCookie : `Bearer ${sessionCookie}`,
            ...encHeaders,
          },
        }).catch(() => null),
        fetch('https://api.geraikita.com/api/v1/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Authorization: sessionCookie.startsWith('Bearer ') ? sessionCookie : `Bearer ${sessionCookie}`,
            ...encHeaders,
          },
        }).catch(() => null),
      ]);

      let tokens: number | null = null;
      let balance: number | null = null;

      if (resMe && resMe.ok) {
        const iv = resMe.headers.get('x-random-key') || resMe.headers.get('X-Random-Key');
        const text = await resMe.text();
        const json = iv ? decryptResponse(text, iv) : null;
        if (json && typeof json === 'object') {
          const rawTokens =
            (json as { tokens?: number }).tokens ??
            (json as { data?: { tokens?: number; token_quota?: number } }).data?.tokens ??
            (json as { data?: { tokens?: number; token_quota?: number } }).data?.token_quota;
          if (typeof rawTokens === 'number') tokens = rawTokens;
        }
      }

      if (resBal && resBal.ok) {
        const iv = resBal.headers.get('x-random-key') || resBal.headers.get('X-Random-Key');
        const text = await resBal.text();
        const json = iv ? decryptResponse(text, iv) : null;
        if (json && typeof json === 'object') {
          const bal =
            (json as { balance?: number }).balance ??
            (json as { data?: { balance?: number } }).data?.balance;
          if (typeof bal === 'number') {
            balance = bal;
            if (tokens === null) tokens = bal;
          }
        }
      }

      if (tokens !== null) {
        return NextResponse.json({
          success: true,
          source: 'live_api',
          tokens,
          formattedTokens: formatTokens(tokens),
          fullTokensFormatted: `${tokens.toLocaleString('id-ID')} Token`,
          balance,
          formattedBalance: balance !== null ? `Rp ${balance.toLocaleString('id-ID')}` : undefined,
          model: process.env.GERAIKITA_MODEL || 'claude-sonnet-4-6',
        });
      }
    } catch {
      // fallback
    }
  }

  try {
    const res = await fetch('https://ai.geraikita.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const hasModels = Array.isArray(data?.data) && data.data.length > 0;

      return NextResponse.json({
        success: true,
        source: 'api_key_valid',
        keyValid: hasModels,
        tokens: null,
        formattedTokens: 'Claude Aktif',
        model: process.env.GERAIKITA_MODEL || 'claude-sonnet-4-6',
      });
    }

    return NextResponse.json({
      success: false,
      error: 'API Key GeraiKita tidak merespons.',
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi ai.geraikita.com',
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cookieToken, manualTokens, manualBalance } = body;

    const tokenNum = typeof manualTokens === 'number'
      ? manualTokens
      : typeof manualBalance === 'number'
      ? manualBalance
      : null;

    if (tokenNum !== null) {
      return NextResponse.json({
        success: true,
        source: 'manual',
        tokens: tokenNum,
        formattedTokens: formatTokens(tokenNum),
        fullTokensFormatted: `${tokenNum.toLocaleString('id-ID')} Token`,
        balance: tokenNum,
        formattedBalance: `Rp ${tokenNum.toLocaleString('id-ID')}`,
      });
    }

    if (typeof cookieToken === 'string' && cookieToken.trim()) {
      const encHeaders = createEncryptedHeaders();
      const cookieHeader = cookieToken.includes('=')
        ? cookieToken
        : `token=${cookieToken}; gk_token=${cookieToken}`;

      const [resBal, resMe] = await Promise.all([
        fetch('https://api.geraikita.com/api/v1/balance', {
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Authorization: cookieToken.startsWith('Bearer ') ? cookieToken : `Bearer ${cookieToken}`,
            ...encHeaders,
          },
        }).catch(() => null),
        fetch('https://api.geraikita.com/api/v1/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            Authorization: cookieToken.startsWith('Bearer ') ? cookieToken : `Bearer ${cookieToken}`,
            ...encHeaders,
          },
        }).catch(() => null),
      ]);

      let tokens: number | null = null;
      let balance: number | null = null;

      if (resMe && resMe.ok) {
        const iv = resMe.headers.get('x-random-key') || resMe.headers.get('X-Random-Key');
        const text = await resMe.text();
        const json = iv ? decryptResponse(text, iv) : null;
        if (json && typeof json === 'object') {
          const rawTokens =
            (json as { tokens?: number }).tokens ??
            (json as { data?: { tokens?: number; token_quota?: number } }).data?.tokens ??
            (json as { data?: { tokens?: number; token_quota?: number } }).data?.token_quota;
          if (typeof rawTokens === 'number') tokens = rawTokens;
        }
      }

      if (resBal && resBal.ok) {
        const iv = resBal.headers.get('x-random-key') || resBal.headers.get('X-Random-Key');
        const text = await resBal.text();
        const json = iv ? decryptResponse(text, iv) : null;
        if (json && typeof json === 'object') {
          const bal =
            (json as { balance?: number }).balance ??
            (json as { data?: { balance?: number } }).data?.balance;
          if (typeof bal === 'number') {
            balance = bal;
            if (tokens === null) tokens = bal;
          }
        }
      }

      if (tokens !== null) {
        return NextResponse.json({
          success: true,
          source: 'live_api',
          tokens,
          formattedTokens: formatTokens(tokens),
          fullTokensFormatted: `${tokens.toLocaleString('id-ID')} Token`,
          balance,
          formattedBalance: balance !== null ? `Rp ${balance.toLocaleString('id-ID')}` : undefined,
        });
      }

      return NextResponse.json({
        success: false,
        error: 'Sesi token tidak valid atau telah kadaluarsa di ai.geraikita.com',
      });
    }

    return NextResponse.json({ success: false, error: 'Parameter tidak valid' });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Kesalahan server',
    });
  }
}
