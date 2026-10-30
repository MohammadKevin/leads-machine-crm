import { NextRequest, NextResponse } from 'next/server';

// Subdomain yang digunakan untuk dashboard aplikasi Leads Machine (bukan prototype UMKM)
const RESERVED_SUBDOMAINS = new Set([
  '',
  'www',
  'crm',
  'leads',
  'app',
  'dashboard',
  'admin',
]);

const ROOT_DOMAIN = 'corecraft.my.id';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Lewati file statis, aset Next.js, dan rute API
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/p/') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Bersihkan port (misal localhost:3000 -> localhost, crm.corecraft.my.id:443 -> crm.corecraft.my.id)
  const hostWithoutPort = hostname.replace(/:\d+$/, '').toLowerCase();

  let subdomain: string | null = null;

  // Format 1: [subdomain].corecraft.my.id
  if (hostWithoutPort.endsWith(ROOT_DOMAIN)) {
    if (hostWithoutPort !== ROOT_DOMAIN && hostWithoutPort.endsWith(`.${ROOT_DOMAIN}`)) {
      const sub = hostWithoutPort.slice(0, -(ROOT_DOMAIN.length + 1)).split('.')[0];
      if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
        subdomain = sub;
      }
    }
  }
  // Format 2: Pengujian lokal, misal [subdomain].localhost:3000
  else if (hostWithoutPort.endsWith('localhost')) {
    const parts = hostWithoutPort.split('.');
    if (parts.length >= 2 && parts[0] && !RESERVED_SUBDOMAINS.has(parts[0])) {
      subdomain = parts[0];
    }
  }

  // Jika terdeteksi subdomain klien (misal klinik.corecraft.my.id), rewrite internal ke /p/[subdomain]
  if (subdomain) {
    const rewrittenUrl = new URL(`/p/${subdomain}${url.pathname === '/' ? '' : url.pathname}`, req.url);
    return NextResponse.rewrite(rewrittenUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
