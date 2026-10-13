import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithRetry,
  normalizeIndonesianPhone,
  isValidIndonesianWhatsApp,
} from '@/lib/defensive-client';
import {
  isFranchiseOrBlacklisted,
  isFreeWebsiteDomain,
} from '@/lib/lead-qualification';
import { OutreachLead } from '@/types/outreach';

export const dynamic = 'force-dynamic';

interface SerperPlaceItem {
  position?: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  ratingCount?: number;
  category?: string;
  phoneNumber?: string;
  website?: string;
  cid?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      cities = ['Malang'],
      category = 'Klinik & Apotek',
      categories,
      customQuery = '',
      onlyWithoutWebsite = true,
      excludeFranchise = true,
      onlyValidWhatsApp = true,
      strictA1 = true,
      blacklist = [],
    } = body;

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'SERPER_API_KEY belum dikonfigurasi di environment variable server.',
        },
        { status: 500 }
      );
    }

    const cityList: string[] =
      Array.isArray(cities) && cities.length > 0 ? cities : ['Malang'];

    // Support single or multiple categories seamlessly
    const categoryList: string[] =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : Array.isArray(category) && category.length > 0
        ? category
        : [typeof category === 'string' && category.trim() ? category.trim() : 'Klinik & Apotek'];

    const blacklistSet = new Set<string>(
      Array.isArray(blacklist)
        ? blacklist.map((p: string) => normalizeIndonesianPhone(p)).filter(Boolean)
        : []
    );

    const cleanLeads: OutreachLead[] = [];
    const skippedLogs: Array<{ phone: string; businessName: string; reason: string }> = [];
    const seenBatchPhones = new Set<string>();

    for (const cat of categoryList) {
      for (const city of cityList) {
        const searchTerm = customQuery.trim()
          ? `${customQuery.trim()} di ${city}`
          : `${cat} di ${city}`;

        try {
          const response = await fetchWithRetry('https://google.serper.dev/places', {
            method: 'POST',
            headers: {
              'X-API-KEY': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: searchTerm,
              gl: 'id',
              hl: 'id',
            }),
            timeoutMs: 12000,
            retries: 2,
          });

          if (!response.ok) {
            continue;
          }

          const data = await response.json().catch(() => null);
          if (!data || !Array.isArray(data.places)) {
            continue;
          }

          const places: SerperPlaceItem[] = data.places;

          for (const place of places) {
            const rawName = place.title || 'Tanpa Nama';
            const rawPhone = place.phoneNumber || '';
            const address = place.address || '';
            const rating = typeof place.rating === 'number' ? place.rating : 0;
            const reviewsCount = typeof place.ratingCount === 'number' ? place.ratingCount : 0;
            const rawWeb = place.website && place.website.trim().length > 0 ? place.website.trim() : null;

            // Periksa apakah website adalah link medsos atau direktori gratisan
            const isFreeLink = Boolean(rawWeb && isFreeWebsiteDomain(rawWeb));
            const hasOfficialWebsite = Boolean(rawWeb && !isFreeLink);

            // 1. Kualifikasi Ketat Nomor HP / WhatsApp (Seluler 08/628 saja, tolak telepon kabel 0341, 031, dll)
            const cleanPhone = normalizeIndonesianPhone(rawPhone);
            if (!cleanPhone) {
              continue; // Tidak ada nomor telepon
            }

            if (onlyValidWhatsApp || strictA1) {
              if (!isValidIndonesianWhatsApp(cleanPhone)) {
                skippedLogs.push({
                  phone: cleanPhone,
                  businessName: rawName,
                  reason: `Bukan nomor WhatsApp seluler valid (terdeteksi telepon kantor/PSTN)`,
                });
                continue;
              }
            }

            // 2. Kualifikasi Franchise Multinasional / Cabang
            if (excludeFranchise || strictA1) {
              const franchise = isFranchiseOrBlacklisted(rawName);
              if (franchise.isFranchise) {
                skippedLogs.push({
                  phone: cleanPhone,
                  businessName: rawName,
                  reason: `Waralaba/Franchise terdeteksi (${franchise.matchedKeyword})`,
                });
                continue;
              }
            }

            // 3. Kualifikasi Tanpa Website Resmi
            if (onlyWithoutWebsite && hasOfficialWebsite) {
              skippedLogs.push({
                phone: cleanPhone,
                businessName: rawName,
                reason: `Sudah memiliki website resmi mandiri (${rawWeb})`,
              });
              continue;
            }

            // 4. Kualifikasi Bisnis Aktif & Berjalan (Minimal 3 ulasan atau reputasi aktif)
            if (strictA1) {
              const isOperating = reviewsCount >= 3 || rating >= 3.5;
              if (!isOperating) {
                skippedLogs.push({
                  phone: cleanPhone,
                  businessName: rawName,
                  reason: `Ulasan di bawah 3 atau reputasi belum aktif`,
                });
                continue;
              }
            }

            // 5. Cek Anti-Duplikasi Google Sheets Realtime
            if (blacklistSet.has(cleanPhone)) {
              skippedLogs.push({
                phone: cleanPhone,
                businessName: rawName,
                reason: `Nomor sudah terdaftar di Google Sheets`,
              });
              continue;
            }

            // 6. Anti-Duplikasi di dalam batch berjalan
            if (seenBatchPhones.has(cleanPhone)) {
              skippedLogs.push({
                phone: cleanPhone,
                businessName: rawName,
                reason: `Duplikat nomor di dalam batch pencarian`,
              });
              continue;
            }

            seenBatchPhones.add(cleanPhone);

            const lead: OutreachLead = {
              id:
                place.cid ||
                `serper-${cleanPhone}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              businessName: rawName,
              category: place.category || cat,
              city,
              address,
              phone: cleanPhone,
              rawPhone,
              rating,
              reviewsCount,
              hasWebsite: hasOfficialWebsite,
              website: rawWeb,
              status: 'ready',
            };

            cleanLeads.push(lead);
          }
        } catch {
          // Abaikan error per iterasi untuk menjaga ketahanan batch
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalFound: cleanLeads.length,
      leads: cleanLeads,
      skippedLogs,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan pada pencarian Serper.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
