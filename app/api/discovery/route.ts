import { NextRequest, NextResponse } from 'next/server';
import { POST as searchHandler } from '@/app/api/outreach/search/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return searchHandler(req);
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/discovery',
    status: 'online',
    description: 'Serper Places Discovery Engine dengan kualifikasi ketat Tier A1 & anti-duplikasi Sheets',
  });
}
