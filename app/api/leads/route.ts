import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LEADS, KOTA_JATIM, type Lead, type LeadCategory } from '@/lib/outreach-data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const city = searchParams.get('city');
  const status = searchParams.get('status');
  const q = searchParams.get('q')?.toLowerCase() || '';

  let result: Lead[] = [...DEFAULT_LEADS];

  if (category && category !== 'semua') {
    result = result.filter((l) => l.category === category);
  }

  if (city && city !== 'semua') {
    result = result.filter((l) => l.city === city);
  }

  if (status && status !== 'semua') {
    result = result.filter((l) => l.status === status);
  }

  if (q) {
    result = result.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.area.toLowerCase().includes(q) ||
        l.phone.includes(q)
    );
  }

  return NextResponse.json({ success: true, leads: result });
}

export type { Lead, LeadCategory };