import { NextRequest, NextResponse } from 'next/server';
import { generateOutreachMessage } from '@/lib/template-generator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      businessName,
      category = 'general',
      address = '',
      rating = 0,
      userRatingCount = 0,
      senderName = 'Mohammad Kevin',
      senderRole = 'freelance web developer',
      senderEmail = 'mhmdkevin198@gmail.com',
      marketMode = 'indo',
      geminiKey: customGeminiKey,
    } = body;

    if (!businessName) {
      return NextResponse.json(
        { error: 'Nama bisnis wajib disertakan.' },
        { status: 400 }
      );
    }

    const apiKey = customGeminiKey || process.env.GEMINI_API_KEY;

    const isGlobal =
      marketMode === 'global' ||
      /\b(london|manchester|birmingham|berlin|munich|paris|amsterdam|dublin|sydney|melbourne|new york|los angeles|chicago|singapore|dubai|uk|usa|australia|germany|france)\b/i.test(
        address
      );

    const fallbackText = isGlobal
      ? `Hi ${businessName} Team,

I noticed your positive ${rating > 0 ? `${rating}-star ` : ''}reputation on Google Maps around ${address || 'your area'}.

To help you capture direct orders/bookings automatically and boost more 5-star reviews with a dedicated QR stand system, I can help set up a lightweight custom flow.

Could I prepare a quick, zero-cost preview demo for ${businessName}?

Best regards,
${senderName}`
      : generateOutreachMessage({
          businessName,
          category,
          senderName,
          senderRole,
          rating,
          userRatingCount,
          address,
        });

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        businessName,
        message: fallbackText,
        source: 'template_fallback',
      });
    }

    const prompt = isGlobal
      ? `You are an expert B2B cold outreach copywriter crafting high-converting, value-first messages for freelance developer "${senderName}".
Target:
- Business: ${businessName} (${category})
- Location: ${address || 'Local area'}
- Reviews: ${rating > 0 ? `${rating} stars (${userRatingCount} reviews)` : 'Good reputation'}

STRICT RULES:
1. NO robotic sales cliches (never say "We are a software house", "Cheap website services", "Do you need a website?").
2. Max 60-80 words total. Warm, natural, and value-first.
3. Light audit: Praise their Google Maps reputation, then highlight automation (streamlined booking/catalog) or a cashier Google Review QR acrylic stand to boost 5-star reviews.
4. Soft frictionless CTA: "Could I put together a free demo flow for you to preview first?"
5. Output ONLY the ready-to-send message text.`
      : `Anda adalah copywriter outreach B2B profesional di Indonesia yang ahli dalam pesan pembuka bernilai tinggi (value-first).
Target Prospek:
- Nama Bisnis: ${businessName}
- Kategori Usaha: ${category}
- Lokasi: ${address || 'Indonesia'}
- Rating Google Maps: ${rating > 0 ? `${rating} bintang (${userRatingCount} ulasan)` : 'Reputasi aktif'}

ATURAN KETAT (WAJIB DIPATUHI):
1. DILARANG KERAS menggunakan frasa klise sales robotik seperti: "Perkenalkan kami dari software house", "Kami menawarkan jasa website murah", "Apakah Anda butuh web?".
2. Pendekatan VALUE-FIRST (Audit Ringan):
   - Puji hal positif lokalnya (reputasi/lokasi di Google Maps).
   - Tunjukkan pain point spesifik: alur reservasi/katalog yang masih manual via chat ATAU kebutuhan stand akrilik QR review Google Maps di meja kasir/resepsionis untuk mendongkrak bintang 5.
3. Akhiri dengan Call-to-Action (CTA) santai tanpa risiko/beban: "Boleh saya buatkan demo alur/sistemnya dulu tanpa biaya Kak?" (atau variasi serupa yang sangat ramah).
4. Panjang pesan WAJIB antara 60–80 KATA. Bahasa Indonesia sopan, santai, dan fleksibel (Kak/Pak/Bu).
5. Output HANYA teks pesan yang siap dikirim tanpa tanda kutip pembuka atau penjelas tambahan.`;

    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite',
    ];
    let generatedText = '';
    const GEMINI_TIMEOUT_MS = 7000;

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.6,
                maxOutputTokens: 150,
              },
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            generatedText = candidate.trim().replace(/^["']|["']$/g, '');
            break;
          }
        }
      } catch {
        // model failed or timed out, try next
      }
    }

    const finalMessage = generatedText || fallbackText;

    return NextResponse.json({
      success: true,
      businessName,
      message: finalMessage,
      marketMode: isGlobal ? 'global' : 'indo',
      source: generatedText ? 'gemini_ai' : 'template_fallback',
    });
  } catch (error: unknown) {
    const fallbackNow = generateOutreachMessage({
      businessName: 'Bapak/Ibu',
      category: 'general',
      senderName: 'Mohammad Kevin',
      senderRole: 'freelance web developer',
    });
    return NextResponse.json({
      success: true,
      businessName: 'Bapak/Ibu',
      message: fallbackNow,
      source: 'template_fallback',
      error: error instanceof Error ? error.message : 'Server error, fallback template digunakan.',
    });
  }
}
