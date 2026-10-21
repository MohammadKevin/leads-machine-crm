import { NextRequest, NextResponse } from 'next/server';
import { generatePersonalizedPitch, getTimeOfDayWIB } from '@/lib/gemini-pitch';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      businessName,
      category = 'Umum',
      city = 'Jawa Timur',
      address = '',
      rating = 0,
      userRatingCount = 0,
      reviewsCount = 0,
      highlightReview = '',
      forcedAngle,
      targetMode = 'admin_gatekeeper',
    } = body;

    if (!businessName) {
      return NextResponse.json(
        { success: false, error: 'Nama bisnis wajib disertakan.' },
        { status: 400 }
      );
    }

    const { message, source, angleUsed, timeGreeting } = await generatePersonalizedPitch({
      businessName,
      category,
      city,
      address,
      rating,
      reviewsCount: reviewsCount || userRatingCount,
      highlightReview,
      forcedAngle,
      targetMode,
    });

    return NextResponse.json({
      success: true,
      businessName,
      message,
      source,
      angleUsed,
      timeGreeting: timeGreeting || getTimeOfDayWIB(),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Server error saat membuat copywriting.';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
