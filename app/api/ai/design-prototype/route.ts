import { NextRequest, NextResponse } from 'next/server';
import { PrototypeData, PrototypeNiche } from '@/types/prototype';
import { slugify, detectNicheFromCategory } from '@/lib/prototype-templates';
import { normalizeIndonesianPhone } from '@/lib/defensive-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, leadData, currentPrototype } = body;

    const apiKey = process.env.GERAIKITA_API_KEY;
    const baseUrl = process.env.GERAIKITA_BASE_URL || 'https://ai.geraikita.com/v1';
    const model = process.env.GERAIKITA_MODEL || 'claude-sonnet-4-6';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API Key GeraiKita belum terpasang di server (.env.local).' },
        { status: 500 }
      );
    }

    const businessName = leadData?.businessName || currentPrototype?.businessName || 'Bisnis Anda';
    const category = leadData?.category || currentPrototype?.category || 'Layanan Profesional';
    const city = leadData?.city || currentPrototype?.city || 'Malang';
    const phone = normalizeIndonesianPhone(leadData?.normalizedPhone || leadData?.phone || currentPrototype?.phone || '081234567890');
    const rating = leadData?.rating || currentPrototype?.rating || 4.9;
    const reviewsCount = leadData?.reviewsCount || currentPrototype?.reviewsCount || 45;
    const address = leadData?.mapsUrl || currentPrototype?.address || `Jl. Utama Bisnis No. 12, ${city}`;
    const chatMessage = body.chatMessage || leadData?.messageSent;

    const systemPrompt = `Anda adalah Lead UX Designer & Conversion Specialist agensi web "CoreCraft Studio".
Tugas Anda adalah merancang atau merevisi struktur website interaktif prototype khusus untuk calon klien bisnis lokal di Indonesia ("${businessName}", kategori: ${category}, kota: ${city}).

Instruksi Penting:
- Desain harus terasa SANGAT PREMIUM, SPESIFIK UNTUK INDUSTRI INI, dan BUKAN TEMPLATE GENERIK (ANTI AI SLOP).
- JANGAN gunakan teks klise seperti "Layanan Utama Berkualitas" atau "Pelayanan Unggul". Berikan nama layanan dan produk yang nyata dan spesifik (misal jika Toko Bunga/Florist: "Buket Mawar Wisuda Korean Wrapping", "Karangan Bunga Papan Same-Day Delivery", "Standing Flower Ucapan Selamat & Duka Cita", "Bloom Box & Snack Bouquet").
- Jika diberikan konteks chat outreach yang dikirim Kevin ke klien, selaraskan copy dan penawaran agar nyambung 100% dengan chat tersebut!
- Tentukan 3-4 layanan/paket unggulan dengan rincian harga realistis dalam Rupiah dan URL foto Unsplash yang relevan di properti "image".
- Tentukan 4 keunggulan utama (features) yang relevan dan meyakinkan.
- Tentukan 2-3 FAQ praktis yang biasa ditanyakan pembeli lokal (misal: same-day delivery, jam buka, booking WA, pembayaran).
- Tentukan 2 ulasan pelanggan realistis bintang 5 yang relevan dengan kota ${city}.
- Pilih warna primer heksadesimal yang elegan:
  * Florist: #be185d (Deep Rose / Ruby) atau #0f766e (Emerald)
  * Villa/Resort: #0284c7 (Sky Blue) atau #0f766e (Forest)
  * Klinik/Kesehatan: #059669 (Medical Emerald)
  * Otomotif/Bengkel: #b91c1c (Automotive Red)
  * Resto/Cafe: #d97706 (Warm Amber)
  * Kontraktor: #0f172a (Deep Slate)

Format output WAJIB HANYA JSON MURNI TANPA MARKDOWN DAN TANPA BACKTICKS (\`\`\`json).
Struktur JSON yang WAJIB dipenuhi:
{
  "niche": "florist" | "klinik" | "villa" | "kontraktor" | "bengkel" | "resto" | "corporate" | "general",
  "themeStyle": "modern" | "luxury" | "clean" | "warm",
  "primaryColor": "#be185d",
  "badgeText": "string singkat penegas reputasi",
  "headline": "string headline hero yang kuat dan menggugah",
  "subheadline": "string subheadline penjelas nilai tambah",
  "promoBanner": "string promo terbatas yang memicu booking cepat",
  "heroImage": "url unsplash berkualitas tinggi yang relevan",
  "services": [
    {
      "title": "string nama spesifik produk/layanan",
      "description": "string penjelasan manfaat dan spesifikasi",
      "price": "string harga jelas (misal: Mulai Rp 185.000)",
      "badge": "string opsional (misal: Paling Laris / Same Day Delivery)",
      "image": "url unsplash spesifik produk"
    }
  ],
  "features": ["keunggulan 1", "keunggulan 2", "keunggulan 3", "keunggulan 4"],
  "gallery": [
    { "url": "url unsplash", "title": "keterangan foto 1" },
    { "url": "url unsplash", "title": "keterangan foto 2" },
    { "url": "url unsplash", "title": "keterangan foto 3" },
    { "url": "url unsplash", "title": "keterangan foto 4" }
  ],
  "testimonials": [
    {
      "name": "nama pelanggan lokal",
      "comment": "ulasan kepuasan nyata",
      "rating": 5,
      "role": "konteks pembeli"
    }
  ],
  "faqs": [
    {
      "question": "pertanyaan umum pelanggan",
      "answer": "jawaban ramah dan jelas"
    }
  ],
  "businessHours": "string jam buka operasional"
}`;

    const chatContext = chatMessage ? `\nKonteks Chat Outreach yang telah dikirim ke klien: "${chatMessage}". Buat website selaras dengan topik obrolan ini!` : '';
    const userMessage = prompt
      ? `Instruksi Khusus dari Kevin: "${prompt}".\nData Bisnis: Nama: ${businessName}, Kategori: ${category}, Kota: ${city}, Rating: ${rating} (${reviewsCount} ulasan).${chatContext}\nBuatkan/sesuaikan JSON website-nya sekarang secara profesional.`
      : `Buatkan konsep website profesional tanpa AI-slop untuk: Nama: ${businessName}, Kategori: ${category}, Kota: ${city}, Rating: ${rating} (${reviewsCount} ulasan).${chatContext}\nHANYA keluarkan JSON.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.65,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, error: `Gagal memanggil Claude via GeraiKita: ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await response.json();
    const rawContent = json?.choices?.[0]?.message?.content || '';

    // Clean JSON markdown blocks
    const cleanedJsonStr = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsedResult: Record<string, unknown> = {};
    try {
      parsedResult = JSON.parse(cleanedJsonStr);
    } catch {
      // Find JSON object boundaries if model added preamble
      const match = cleanedJsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        throw new Error('Claude menghasilkan format respon non-JSON.');
      }
    }

    const slug = currentPrototype?.slug || slugify(businessName) || 'preview-klien';
    const niche = (parsedResult.niche as PrototypeNiche) || detectNicheFromCategory(category, businessName);

    const fullPrototype: PrototypeData = {
      id: currentPrototype?.id || `proto-${slug}-${Date.now()}`,
      slug,
      businessName,
      category,
      niche,
      city,
      phone,
      address,
      rating,
      reviewsCount,
      customDomain: currentPrototype?.customDomain || 'corecraft.my.id',
      subdomainEnabled: true,
      status: currentPrototype?.status || 'published',
      publishedAt: currentPrototype?.publishedAt || new Date().toISOString(),
      viewCount: currentPrototype?.viewCount || 1,
      createdAt: currentPrototype?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      badgeText: (parsedResult.badgeText as string) || 'Layanan Terpercaya',
      headline: (parsedResult.headline as string) || `Layanan Profesional Terbaik di ${city}`,
      subheadline: (parsedResult.subheadline as string) || 'Konsultasi praktis dan cepat langsung via WhatsApp resmi kami.',
      primaryColor: (parsedResult.primaryColor as string) || '#059669',
      themeStyle: (parsedResult.themeStyle as any) || 'modern',
      promoBanner: (parsedResult.promoBanner as string) || undefined,
      heroImage: (parsedResult.heroImage as string) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
      services: (parsedResult.services as any) || [],
      features: (parsedResult.features as any) || [],
      gallery: (parsedResult.gallery as any) || [],
      testimonials: (parsedResult.testimonials as any) || [],
      faqs: (parsedResult.faqs as any) || currentPrototype?.faqs || [],
      businessHours: (parsedResult.businessHours as string) || 'Senin - Sabtu: 08.00 - 18.00 WIB',
    };

    // Auto-save prototype so the preview is immediately live
    try {
      const { savePrototype } = await import('@/lib/prototype-storage');
      await savePrototype(fullPrototype);
    } catch (saveErr) {
      console.error('Auto-save prototype error:', saveErr);
    }

    return NextResponse.json({
      success: true,
      modelUsed: model,
      prototype: fullPrototype,
      tokensUsed: json?.usage?.total_tokens || 1850,
      message: `Konsep website untuk ${businessName} berhasil diracik oleh Claude 3.5 Sonnet!`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan saat generate prototype.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
