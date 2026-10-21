import { NextResponse } from 'next/server';
import { fetchWithRetry, normalizeIndonesianPhone } from '@/lib/defensive-client';
import { SheetLeadRecord, OutreachMetrics } from '@/types/outreach';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sheetUrl =
    process.env.GOOGLE_SHEETS_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_LEADS_SHEET_API;

  if (!sheetUrl) {
    return NextResponse.json(
      {
        success: false,
        error: 'GOOGLE_SHEETS_WEBAPP_URL belum dikonfigurasi di environment.',
        blacklist: [],
        records: [],
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetchWithRetry(sheetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: 10000,
      retries: 2,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Google Sheets Apps Script mengembalikan status ${response.status}`,
          blacklist: [],
          records: [],
        },
        { status: 502 }
      );
    }

    // Safe Response Handling (Anti-Crash): Baca text terlebih dahulu
    const rawBlacklistText = await response.text().catch(() => '');
    let json: { status?: string; data?: Array<Record<string, any>> } | null = null;
    try {
      json = JSON.parse(rawBlacklistText);
    } catch {
      console.warn('Google Apps Script returned non-JSON on blacklist GET:', rawBlacklistText.slice(0, 200));
    }

    if (!json || json.status !== 'success' || !Array.isArray(json.data)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Sheets sedang sibuk atau mengembalikan format non-JSON. Silakan coba beberapa saat lagi.',
          blacklist: [],
          records: [],
        },
        { status: 502 }
      );
    }

    const blacklistSet = new Set<string>();
    const records: SheetLeadRecord[] = [];

    let totalUniqueContacted = 0;
    let interestedCount = 0;
    let closingDealCount = 0;
    let inProgressCount = 0;
    let rejectedCount = 0;

    for (const item of json.data) {
      const name = String(item.business_name || item.nama_bisnis || item.name || '');
      const rawPhone = String(item.phone_number || item.phone || item.no_telepon || '');
      const cleanPhone = normalizeIndonesianPhone(
        String(item.normalized_phone || item.normalizedPhone || rawPhone)
      );

      // Exclude WB & MMC explicitly (user requested: MMC only 500k, not in 25jt high ticket deals)
      const nameLower = name.toLowerCase();
      const phoneNorm = cleanPhone || '';
      if (
        nameLower.includes('wb') ||
        nameLower.includes('rindu') ||
        nameLower.includes('mmc') ||
        nameLower.includes('mas poer') ||
        phoneNorm.includes('553829266') ||
        phoneNorm.includes('333469032') ||
        phoneNorm.includes('3666555')
      ) {
        continue;
      }

      const rawStatus = String(item.lead_status || item.status_lead || item.status || 'CONTACTED').toUpperCase();

      let mappedStatus: SheetLeadRecord['status'] = 'CONTACTED';
      if (rawStatus === 'INTERESTED' || rawStatus === 'FOLLOWUP') {
        mappedStatus = 'INTERESTED';
        interestedCount++;
      } else if (rawStatus === 'CLOSED' || rawStatus === 'CLOSED_DEAL' || rawStatus === 'DEAL') {
        mappedStatus = 'CLOSED_DEAL';
        closingDealCount++;
      } else if (rawStatus === 'IN_PROGRESS') {
        mappedStatus = 'IN_PROGRESS';
        inProgressCount++;
      } else if (rawStatus.includes('REJECT') || rawStatus.includes('LOST') || rawStatus.includes('FRANCHISE')) {
        mappedStatus = 'REJECTED';
        rejectedCount++;
      } else {
        mappedStatus = 'CONTACTED';
      }

      if (cleanPhone) {
        blacklistSet.add(cleanPhone);
        totalUniqueContacted++;
      }

      records.push({
        id: `sheet-${cleanPhone || Math.random().toString(36).slice(2, 8)}`,
        timestamp: String(item.timestamp || item.last_sync_at || item.terakhir_disinkron || ''),
        businessName: String(item.business_name || item.nama_bisnis || item.name || 'Prospek'),
        category: String(item.category || item.kategori || 'general'),
        city: String(item.city || item.kota || ''),
        phone: rawPhone || cleanPhone,
        normalizedPhone: cleanPhone,
        mapsUrl: String(item.maps_url || item.link_google_maps || item.address || ''),
        rating: Number(item.rating || 0),
        reviewsCount: Number(item.review_count || item.reviewsCount || item.jumlah_ulasan || 0),
        hasWebsite: Boolean(item.website || item.website_asli),
        website: item.website ? String(item.website) : item.website_asli ? String(item.website_asli) : null,
        status: mappedStatus,
        rejectionReason: item.rejection_reason ? String(item.rejection_reason) : item.alasan_penolakan ? String(item.alasan_penolakan) : null,
        messageSent: String(item.generated_pitch || item.draft_pitch_wa || item.messageSent || ''),
        lastSyncAt: String(item.last_sync_at || item.terakhir_disinkron || new Date().toISOString()),
      });
    }

    const metrics: OutreachMetrics = {
      totalUniqueContacted: blacklistSet.size,
      interestedCount,
      closingDealCount,
      inProgressCount,
      rejectedCount,
      lastSyncTimestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      blacklist: Array.from(blacklistSet),
      records,
      metrics,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Kesalahan jaringan saat pre-fetch kontak existing.';
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        blacklist: [],
        records: [],
      },
      { status: 500 }
    );
  }
}
