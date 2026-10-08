import {
  evaluateLeadQualification,
  LeadEntity,
  LeadStatus,
} from '../lib/lead-qualification';
import { generateOutreachMessage } from '../lib/template-generator';
import { normalizeWhatsAppNumber } from '../lib/phone-utils';

interface RawSheetRow {
  business_name?: string;
  name?: string;
  category?: string;
  kategori?: string;
  phone_number?: string;
  phone?: string;
  nomor_wa?: string;
  maps_url?: string;
  address?: string;
  alamat?: string;
  rating?: number | string;
  review_count?: number | string;
  lead_status?: string;
  status_chat?: string;
  status?: string;
  rejection_reason?: string;
  priority_score?: string;
  generated_pitch?: string;
  last_sync_at?: string;
  chatted_at?: string;
}

async function runResyncAndClean() {
  console.log('====================================================');
  console.log('🚀 MEMULAI RESYNC & CLEANING DATABASE LEADS CRM');
  console.log('====================================================\n');

  const sheetUrl =
    process.env.GOOGLE_SHEETS_WEBAPP_URL ||
    process.env.NEXT_PUBLIC_LEADS_SHEET_API ||
    '';

  if (!sheetUrl) {
    console.error('❌ ERROR: GOOGLE_SHEETS_WEBAPP_URL belum dikonfigurasi di environment variable.');
    process.exit(1);
  }

  console.log(`📡 Menghubungi Google Sheets Web App: ${sheetUrl}`);

  let existingData: RawSheetRow[] = [];
  try {
    const res = await fetch(sheetUrl, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.status === 'success' && Array.isArray(json.data)) {
      existingData = json.data;
    } else {
      console.warn('⚠️ Tidak ada baris data atau format data bukan array.');
    }
  } catch (fetchErr) {
    console.error('❌ Gagal mengambil data lama dari Google Sheets:', fetchErr);
    process.exit(1);
  }

  console.log(`📦 Ditemukan ${existingData.length} baris data prospek yang tersimpan.\n`);

  let franchiseCount = 0;
  let corporateCount = 0;
  let highPriorityCount = 0;
  let qualifiedCount = 0;
  let contactedCount = 0;

  const cleanedLeads: LeadEntity[] = [];

  for (let i = 0; i < existingData.length; i++) {
    const row = existingData[i];
    const name = (row.business_name || row.name || `Prospek ${i + 1}`).trim();
    const rawPhone = (row.phone_number || row.phone || row.nomor_wa || '').toString().trim();
    const normalizedPhone = normalizeWhatsAppNumber(rawPhone);

    if (!normalizedPhone) {
      continue;
    }

    const category = (row.category || row.kategori || 'general').trim();
    const mapsUrl = (row.maps_url || row.address || row.alamat || '').trim();
    const rating = Number(row.rating || 0);
    const reviewCount = Number(row.review_count || 0);
    const existingStatus = (row.lead_status || row.status_chat || row.status || 'NEW').trim().toUpperCase();

    const qual = evaluateLeadQualification({
      name,
      website: null,
      rating,
      reviewCount,
    });

    let finalStatus: LeadStatus = 'QUALIFIED';
    let finalRejection = row.rejection_reason || null;
    let finalPriority = qual.priorityScore;

    if (qual.isFranchise) {
      finalStatus = 'LOST_FRANCHISE';
      finalRejection = 'Franchise';
      finalPriority = 'DISQUALIFIED';
      franchiseCount++;
    } else if (qual.isCorporate) {
      finalStatus = 'UNQUALIFIED_CORPORATE';
      finalRejection = 'Corporate';
      finalPriority = 'DISQUALIFIED';
      corporateCount++;
    } else if (
      existingStatus === 'CONTACTED' ||
      existingStatus === 'SUDAH DI-CHAT' ||
      existingStatus === 'SUDAH'
    ) {
      finalStatus = 'CONTACTED';
      contactedCount++;
    } else if (existingStatus === 'INTERESTED' || existingStatus === 'FOLLOWUP' || existingStatus === 'PERLU FOLLOW-UP') {
      finalStatus = 'INTERESTED';
    } else if (existingStatus === 'CLOSED' || existingStatus === 'DEAL / SELESAI' || existingStatus === 'DEAL') {
      finalStatus = 'CLOSED';
    } else {
      finalStatus = 'QUALIFIED';
      qualifiedCount++;
    }

    if (finalPriority === 'HIGH') {
      highPriorityCount++;
    }

    const pitch =
      row.generated_pitch ||
      generateOutreachMessage({
        businessName: name,
        category,
        rating,
        userRatingCount: reviewCount,
        address: mapsUrl,
      });

    const lastSync = new Date().toISOString();

    cleanedLeads.push({
      id: `resync-${normalizedPhone}`,
      business_name: name,
      category,
      phone_number: rawPhone || normalizedPhone,
      normalized_phone: normalizedPhone,
      maps_url: mapsUrl,
      rating,
      review_count: reviewCount,
      website: null,
      priority_score: finalPriority,
      lead_status: finalStatus,
      rejection_reason: finalRejection as any,
      generated_pitch: pitch,
      last_sync_at: lastSync,
      qualification_notes: qual.qualificationNotes,
      is_ideal_target: qual.isIdealTarget,
    });
  }

  console.log('📊 HASIL AUDIT & FILTERING DATA:');
  console.log(`----------------------------------------------------`);
  console.log(`- Total data valid diproses: ${cleanedLeads.length}`);
  console.log(`- 🚫 Teridentifikasi Jaringan Franchise (LOST_FRANCHISE): ${franchiseCount}`);
  console.log(`- 🏢 Teridentifikasi Korporat (UNQUALIFIED_CORPORATE): ${corporateCount}`);
  console.log(`- 🎯 Target Prioritas Tinggi (10-100 review / no web): ${highPriorityCount}`);
  console.log(`- 💬 Riwayat Sudah Dikontak: ${contactedCount}`);
  console.log(`- ⭐ Siap Prospek (QUALIFIED): ${qualifiedCount}`);
  console.log(`----------------------------------------------------\n`);

  console.log('🔄 Memulai Two-Way Sync ke Google Sheets dengan skema 11 kolom baru...');

  try {
    const syncRes = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bulk_resync',
        leads: cleanedLeads,
      }),
    });

    if (syncRes.ok) {
      console.log('✅ BERHASIL: Seluruh data telah dibersihkan dan disinkronkan ke Google Sheets!');
    } else {
      console.warn(`⚠️ Google Sheets merespons dengan status ${syncRes.status}`);
    }
  } catch (syncErr) {
    console.error('❌ Gagal menyinkronkan data ke Google Sheets:', syncErr);
  }

  console.log('\n✨ RESYNC SELESAI.');
}

if (require.main === module) {
  runResyncAndClean().catch((err) => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
}

export { runResyncAndClean };
