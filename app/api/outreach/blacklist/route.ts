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

    const json = await response.json().catch(() => null);

    if (!json || json.status !== 'success' || !Array.isArray(json.data)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format data respon Google Sheets tidak sesuai.',
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
      const rawPhone = item.phone_number || item.phone || item.no_telepon || '';
      const cleanPhone = normalizeIndonesianPhone(
        item.normalized_phone || item.normalizedPhone || rawPhone
      );

      const rawStatus = (item.lead_status || item.status_lead || item.status || 'CONTACTED').toUpperCase();

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
        timestamp: item.timestamp || item.last_sync_at || item.terakhir_disinkron || '',
        businessName: item.business_name || item.nama_bisnis || item.name || 'Prospek',
        category: item.category || item.kategori || 'general',
        city: item.city || item.kota || '',
        phone: rawPhone || cleanPhone,
        normalizedPhone: cleanPhone,
        mapsUrl: item.maps_url || item.link_google_maps || item.address || '',
        rating: Number(item.rating || 0),
        reviewsCount: Number(item.review_count || item.reviewsCount || item.jumlah_ulasan || 0),
        hasWebsite: Boolean(item.website || item.website_asli),
        website: item.website || item.website_asli || null,
        status: mappedStatus,
        rejectionReason: item.rejection_reason || item.alasan_penolakan || null,
        messageSent: item.generated_pitch || item.draft_pitch_wa || item.messageSent || '',
        lastSyncAt: item.last_sync_at || item.terakhir_disinkron || new Date().toISOString(),
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
