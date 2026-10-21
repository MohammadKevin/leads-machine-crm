import { NextRequest, NextResponse } from 'next/server';

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

  // Bersihkan port (misal localhost:3000 -> localhost)
  const hostWithoutPort = hostname.replace(/:\d+$/, '').toLowerCase();
  const parts = hostWithoutPort.split('.');

  let subdomain: string | null = null;

  // Format 1: [subdomain].corecraft.my.id
  if (hostWithoutPort.endsWith('corecraft.my.id')) {
    const subParts = hostWithoutPort.replace('.corecraft.my.id', '').split('.');
    if (subParts.length > 0 && subParts[0] && subParts[0] !== 'www' && subParts[0] !== 'leads' && subParts[0] !== 'app') {
      subdomain = subParts[0];
    }
  }
  // Format 2: Pengujian lokal, misal [subdomain].localhost:3000
  else if (hostWithoutPort.endsWith('localhost') && parts.length === 2 && parts[0] !== 'www') {
    subdomain = parts[0];
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
