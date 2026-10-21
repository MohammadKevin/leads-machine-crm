import { NextRequest, NextResponse } from 'next/server';
import { PrototypeData } from '@/types/prototype';
import { getAllPrototypes, savePrototype } from '@/lib/prototype-storage';

export async function GET() {
  try {
    const list = await getAllPrototypes();
    return NextResponse.json({ success: true, prototypes: list });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Gagal memuat prototypes.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<PrototypeData>;
    if (!body.slug || !body.businessName) {
      return NextResponse.json(
        { success: false, error: 'Slug dan Nama Bisnis wajib diisi.' },
        { status: 400 }
      );
    }

    const currentList = await getAllPrototypes();
    const existingIndex = currentList.findIndex((p) => p.slug === body.slug);

    const now = new Date().toISOString();
    let updatedItem: PrototypeData;

    if (existingIndex >= 0) {
      updatedItem = {
        ...currentList[existingIndex],
        ...body,
        updatedAt: now,
      } as PrototypeData;
    } else {
      updatedItem = {
        id: `proto-${body.slug}-${Date.now()}`,
        slug: body.slug,
        businessName: body.businessName,
        category: body.category || 'Layanan Profesional',
        niche: body.niche || 'general',
        city: body.city || 'Malang',
        phone: body.phone || '081234567890',
        address: body.address || 'Alamat Bisnis',
        mapsUrl: body.mapsUrl,
        rating: body.rating || 4.9,
        reviewsCount: body.reviewsCount || 50,
        badgeText: body.badgeText || 'Layanan Terpercaya',
        headline: body.headline || `Layanan Profesional Terbaik di ${body.city || 'Kota Anda'}`,
        subheadline: body.subheadline || 'Konsultasi cepat dan praktis melalui WhatsApp resmi kami.',
        heroImage:
          body.heroImage ||
          'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
        primaryColor: body.primaryColor || '#059669',
        themeStyle: body.themeStyle || 'modern',
        promoBanner: body.promoBanner,
        services: body.services || [],
        features: body.features || [],
        gallery: body.gallery || [],
        testimonials: body.testimonials || [],
        businessHours: body.businessHours || 'Senin - Sabtu: 08.00 - 18.00 WIB',
        customDomain: body.customDomain || 'corecraft.my.id',
        subdomainEnabled: body.subdomainEnabled ?? true,
        status: body.status || 'published',
        publishedAt: body.publishedAt || now,
        viewCount: body.viewCount || 1,
        createdAt: now,
        updatedAt: now,
      };
    }

    await savePrototype(updatedItem);
    return NextResponse.json({ success: true, prototype: updatedItem });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Gagal menyimpan prototype.' },
      { status: 500 }
    );
  }
}
