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
      ? `Hello, warm greetings! I came across ${businessName} on Google Maps and was impressed by your ${rating > 0 ? `${rating}-star ` : 'positive'} reputation.

I often see businesses like yours where staff spend a lot of time replying to the same catalog/price questions repeatedly, confirming bookings manually, or losing customers who get tired of waiting for a reply.

I can help streamline this with something simple:
• An interactive catalog/portfolio that customers can browse directly — no manual PDF sharing
• An automatic booking/reservation flow connected straight to your WhatsApp
• A Google Maps 5-star review QR stand for your counter/reception area

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`
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
      ? `Write a professional cold outreach WhatsApp message as a freelance developer "Kevin" to the business owner of "${businessName}" (${category}) in ${address || 'local area'}. The business has a ${rating > 0 ? `${rating}-star` : 'positive'} reputation on Google Maps.

REQUIRED STRUCTURE (4 paragraphs, separated by double newline \n\n):

1. Greeting & appreciation — Polite opener mentioning the business naturally. Appreciate their Google Maps presence.

2. Pain-point context — Gently highlight common operational struggles: staff busy replying to the same price/catalog questions repeatedly, manual booking confirmation, or slow response causing lost customers.

3. Solution with WhatsApp integration — Present 2-3 concise bullet points using the "•" character (each on a separate line):
• Interactive catalog/portfolio — no more manual PDF sharing via chat
• Direct booking/reservation flow connected to WhatsApp
• Google Maps 5-star review QR stand for the counter/reception area

4. Hook / zero-risk CTA — Warm closing with a free preview offer: "Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali."

STRICT RULES:
- Language: English. Polite, professional, warm — not salesy, not robotic.
- NEVER mention "website", "web developer", "software house", "cheap services".
- Format clearly with \n\n paragraph breaks for readability on mobile WhatsApp.
- Output ONLY the ready-to-send message. No quotes, no explanation, no signature.`
      : `Buat pesan WhatsApp cold outreach profesional atas nama freelance developer "Kevin" kepada pemilik "${businessName}" (kategori: ${category}) di ${address || 'Indonesia'}. Bisnis ini memiliki rating ${rating > 0 ? `${rating} bintang (${userRatingCount} ulasan)` : 'positif'} di Google Maps.

STRUKTUR WAJIB (4 paragraf, pisahkan dengan \n\n):

1. Salam & Apresiasi — Sapaan sopan dengan menyebut nama bisnis secara natural. Apresiasi reputasi positif mereka di Google Maps.

2. Pain-Point & Konteks — Angkat kendala yang umum di bidang ini: admin kerepotan balas chat tanya harga/katalog berulang kali, konfirmasi jadwal/booking manual, atau calon pelanggan kabur karena respon lama.

3. Solusi Terintegrasi WhatsApp — Jabarkan 2-3 poin ringkas menggunakan bullet "•" (tiap poin di baris terpisah):
• Tampilan katalog/portofolio interaktif — tidak perlu kirim PDF manual via chat
• Alur pemesanan/reservasi langsung otomatis terhubung ke WhatsApp operasional
• Dukungan stand akrilik QR review Google Maps di meja kasir/resepsionis

4. Hook / CTA Tanpa Beban — Penutup ramah dengan tawaran preview/demo gratis tanpa risiko: "Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali."

ATURAN KETAT:
- Bahasa Indonesia sopan, profesional, hangat — jangan seperti sales template, jangan kaku.
- DILARANG: menyebut "website", "web developer", "software house", "jasa website murah".
- Format rapi dengan spasi antar paragraf (\n\n) agar mudah dibaca di HP.
- Output HANYA teks pesan siap kirim. Tanpa tanda kutip, tanpa penjelasan, tanpa tanda tangan.`;

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
                maxOutputTokens: 350,
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
