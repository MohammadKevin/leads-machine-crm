import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeWhatsAppNumber,
} from '@/lib/phone-utils';
import {
  evaluateLeadQualification,
  LeadEntity,
  LeadStatus,
  PriorityScore,
  RejectionReason,
} from '@/lib/lead-qualification';

export const GOOGLE_APPS_SCRIPT_SAMPLE_CODE = `/**
 * ============================================================
 * LEADS MACHINE CRM — Google Apps Script (v2.1)
 * ============================================================
 * 11 Kolom Target:
 * [Nama Bisnis, Kategori, No Telepon, Link Google Maps, Rating, Jumlah Ulasan, Website Asli, Status Lead, Alasan Penolakan, Draft Pitch WA, Terakhir Disinkron]
 */
var SHEET_NAME = 'Leads CRM';
var HEADERS = [
  'Nama Bisnis', 'Kategori', 'No Telepon', 'Link Google Maps', 'Rating',
  'Jumlah Ulasan', 'Website Asli', 'Status Lead', 'Alasan Penolakan', 'Draft Pitch WA', 'Terakhir Disinkron'
];
var STATUS_OPTIONS = ['NEW', 'QUALIFIED', 'CONTACTED', 'INTERESTED', 'LOST_FRANCHISE', 'CLOSED', 'UNQUALIFIED_FRANCHISE', 'UNQUALIFIED_CORPORATE'];
var REJECTION_OPTIONS = ['Franchise', 'No Budget', 'Already Has Vendor', 'No Response', 'Corporate'];

function initNewLeadsCrmSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#F3F4F6')
    .setFontColor('#111827')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 38);
  var ruleStatus = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).build();
  sheet.getRange(2, 8, 1000, 1).setDataValidation(ruleStatus);
  var ruleRejection = SpreadsheetApp.newDataValidation().requireValueInList(REJECTION_OPTIONS, true).build();
  sheet.getRange(2, 9, 1000, 1).setDataValidation(ruleRejection);
}
`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customSheetUrl = searchParams.get('sheetUrl');
    const targetUrl =
      customSheetUrl ||
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    const contactedSet = new Set<string>();
    const remoteRecords: LeadEntity[] = [];

    let sheetsConnected = false;
    let syncError: string | null = null;

    if (targetUrl) {
      try {
        const res = await fetch(targetUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          next: { revalidate: 0 },
        });

        if (res.ok) {
          const json = await res.json();
          if (json && json.status === 'success') {
            sheetsConnected = true;

            if (Array.isArray(json.data)) {
              for (const item of json.data) {
                const rawPhone = item.phone_number || item.phone || item.no_telepon || '';
                const clean = normalizeWhatsAppNumber(item.normalized_phone || item.normalizedPhone || rawPhone);
                const name = item.business_name || item.nama_bisnis || item.name || 'Prospek';
                const status = (item.lead_status || item.status_lead || item.status || 'QUALIFIED') as LeadStatus;
                const rejection = (item.rejection_reason || item.alasan_penolakan || item.rejectionReason || null) as RejectionReason;
                const priority = (item.priority_score || item.priorityScore || 'MEDIUM') as PriorityScore;
                const mapsUrl = item.maps_url || item.link_google_maps || item.address || '';
                const rating = Number(item.rating || 0);
                const reviewCount = Number(item.review_count || item.jumlah_ulasan || 0);
                const website = (item.website || item.website_asli || null) as string | null;
                const pitch = item.generated_pitch || item.draft_pitch_wa || item.pitch || '';
                const lastSync = item.last_sync_at || item.terakhir_disinkron || item.contactedAt || '';

                if (clean) {
                  if (
                    status === 'CONTACTED' ||
                    status === 'INTERESTED' ||
                    status === 'CLOSED' ||
                    item.status === 'Sudah' ||
                    item.status === 'Sudah Di-Chat'
                  ) {
                    contactedSet.add(clean);
                  }

                  const qual = evaluateLeadQualification({
                    name,
                    website,
                    rating,
                    reviewCount,
                  });

                  remoteRecords.push({
                    id: `sheet-${clean}`,
                    business_name: name,
                    category: item.category || item.kategori || 'general',
                    phone_number: rawPhone || clean,
                    normalized_phone: clean,
                    maps_url: mapsUrl,
                    rating,
                    review_count: reviewCount,
                    website: website || null,
                    priority_score: priority,
                    lead_status: status,
                    rejection_reason: rejection,
                    generated_pitch: pitch,
                    last_sync_at: lastSync,
                    qualification_notes: qual.qualificationNotes,
                    is_ideal_target: qual.isIdealTarget,
                  });
                }
              }
            }

            if (Array.isArray(json.contacted)) {
              for (const p of json.contacted) {
                const clean = normalizeWhatsAppNumber(p);
                if (clean) contactedSet.add(clean);
              }
            }
          }
        } else {
          syncError = `HTTP ${res.status}: ${res.statusText}`;
        }
      } catch (fetchErr) {
        syncError = fetchErr instanceof Error ? fetchErr.message : 'Koneksi ke Google Sheets gagal';
      }
    }

    return NextResponse.json({
      success: true,
      sheetsConnected,
      spreadsheetId: process.env.NEW_SPREADSHEET_ID || null,
      syncError,
      totalContacted: contactedSet.size,
      contactedNumbers: Array.from(contactedSet),
      remoteRecords,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_name,
      name,
      phone_number,
      phone,
      category = 'general',
      maps_url = '',
      address = '',
      rating = 0,
      review_count = 0,
      website = null,
      lead_status,
      status,
      rejection_reason,
      rejectionReason,
      priority_score,
      priorityScore,
      generated_pitch,
      pitch,
      last_sync_at,
      contactedAt,
      sheetUrl,
      action,
      leads,
    } = body;

    const targetUrl =
      sheetUrl ||
      process.env.GOOGLE_SHEETS_WEBAPP_URL ||
      process.env.NEXT_PUBLIC_LEADS_SHEET_API;

    if (action === 'bulk_resync') {
      if (!targetUrl) {
        return NextResponse.json(
          { success: false, error: 'Google Sheets Web App URL belum dikonfigurasi.' },
          { status: 400 }
        );
      }

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_resync',
          leads: Array.isArray(leads) ? leads : [],
        }),
      });

      const resJson = await res.json().catch(() => null);
      return NextResponse.json({
        success: res.ok,
        message: 'Bulk resync selesai.',
        response: resJson,
      });
    }

    const rawPhone = phone_number || phone || '';
    const normalizedPhone = normalizeWhatsAppNumber(rawPhone);
    const finalName = business_name || name || 'Prospek';
    const finalStatus: LeadStatus = lead_status || status || 'QUALIFIED';
    const finalRejection = rejection_reason || rejectionReason || '';
    const finalPriority: PriorityScore = priority_score || priorityScore || 'MEDIUM';
    const finalMapsUrl = maps_url || address || '';
    const finalWebsite = typeof website === 'string' ? website.trim() : '';
    const finalPitch = generated_pitch || pitch || '';
    const finalSyncAt = last_sync_at || contactedAt || new Date().toISOString();

    if (!normalizedPhone) {
      return NextResponse.json(
        { success: false, error: 'Nomor telepon tidak valid untuk disimpan.' },
        { status: 400 }
      );
    }

    let syncedToSheets = false;
    let sheetResponse: unknown = null;

    if (targetUrl) {
      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: finalName,
            category,
            phone_number: rawPhone,
            normalized_phone: normalizedPhone,
            maps_url: finalMapsUrl,
            rating: Number(rating),
            review_count: Number(review_count),
            website: finalWebsite,
            lead_status: finalStatus,
            rejection_reason: finalRejection,
            priority_score: finalPriority,
            generated_pitch: finalPitch,
            last_sync_at: finalSyncAt,
          }),
        });

        if (res.ok) {
          syncedToSheets = true;
          try {
            sheetResponse = await res.json();
          } catch {
            sheetResponse = { status: 'success' };
          }
        }
      } catch {
        syncedToSheets = false;
      }
    }

    return NextResponse.json({
      success: true,
      syncedToSheets,
      business_name: finalName,
      normalized_phone: normalizedPhone,
      lead_status: finalStatus,
      message: syncedToSheets
        ? 'Status berhasil dicatat dan disinkronkan ke Google Sheets.'
        : 'Status berhasil dicatat secara lokal.',
      sheetResponse,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
