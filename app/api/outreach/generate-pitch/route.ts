import { NextRequest, NextResponse } from 'next/server';
import { generatePersonalizedPitch } from '@/lib/gemini-pitch';
import { OutreachLead } from '@/types/outreach';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const lead = body?.lead as OutreachLead | undefined;
    const highlightReview = body?.highlightReview as string | undefined;

    if (!lead || !lead.businessName) {
      return NextResponse.json(
        { success: false, error: 'Data lead tidak valid.' },
        { status: 400 }
      );
    }

    const { message, source, angleUsed, timeGreeting } = await generatePersonalizedPitch({
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      address: lead.address,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      highlightReview,
    });

    return NextResponse.json({
      success: true,
      message,
      source,
      angleUsed,
      timeGreeting,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal menghasilkan pitch.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
