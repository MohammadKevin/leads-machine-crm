import { NextRequest, NextResponse } from 'next/server';
import { getLeads, saveLeads, addMessage, addLog, getSettings } from '@/lib/leads-store';
import { fetchWithRetry, normalizeIndonesianPhone, isValidIndonesianWhatsApp } from '@/lib/defensive-client';
import { LeadModel } from '@/types/outreach';

export const dynamic = 'force-dynamic';

export interface FollowUpItem {
  leadId: string;
  businessName: string;
  category: string;
  city: string;
  phone: string;
  tahap: 1 | 2;
  tahapLabel: 'H+2 (Pengingat Santai)' | 'H+4 (Urgensi Sopan)';
  hariSejakPesan: number;
  pesanTemplate: string;
  terakhirDikontak: string;
}

export function generateFollowUpMessage(lead: { businessName: string; city?: string; category?: string }, tahap: 1 | 2): string {
  const name = lead.businessName;
  const city = lead.city || 'Jawa Timur';

  if (tahap === 1) {
    return `Halo selamat siang Kak, izin menyambung pesan kami kemarin terkait konsep website resmi untuk *${name}*.

Kemarin sudah saya siapkan pratinjau kilat agar calon pelanggan di ${city} bisa langsung pesan dan reservasi via WhatsApp tanpa potongan komisi pihak ketiga.

Boleh saya kirimkan link pratinjaunya nggih Kak? Terima kasih banyak.`;
  }

  return `Halo Kak, menindaklanjuti pesan kami sebelumnya untuk *${name}*.

Jika pembuatan website saat ini belum menjadi prioritas untuk ${name}, tidak apa-apa Kak, mboten nopo-nopo. Saya izin simpan kontaknya untuk silaturahmi ke depan.

Sukses dan lancar selalu untuk usahanya nggih Kak! 🙏`;
}

export async function GET() {
  try {
    const leads = getLeads();
    const now = new Date();
    const followUpQueue: FollowUpItem[] = [];

    for (const lead of leads) {
      // Exclude if opted out or already warm / closed / rejected
      if (lead.jangan_hubungi || lead.status === 'Hangat' || lead.status === 'Closing' || lead.status === 'Ditolak') {
        continue;
      }

      // Check stage
      const tahap = lead.tahap_followup || 0;
      if (tahap >= 2) {
        // Stage 2 is the last stage
        continue;
      }

      const lastDateStr = lead.followup_terakhir_at || lead.pesan_pertama_at || lead.dibuat_at;
      if (!lastDateStr) continue;

      const lastDate = new Date(lastDateStr);
      const diffMs = now.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // H+2 eligible
      if (tahap === 0 && diffDays >= 2) {
        followUpQueue.push({
          leadId: lead.id,
          businessName: lead.nama_bisnis,
          category: lead.kategori,
          city: lead.kota,
          phone: lead.nomor_wa,
          tahap: 1,
          tahapLabel: 'H+2 (Pengingat Santai)',
          hariSejakPesan: diffDays,
          pesanTemplate: generateFollowUpMessage(
            { businessName: lead.nama_bisnis, city: lead.kota, category: lead.kategori },
            1
          ),
          terakhirDikontak: lastDateStr,
        });
      }
      // H+4 eligible (>= 2 days after stage 1)
      else if (tahap === 1 && diffDays >= 2) {
        followUpQueue.push({
          leadId: lead.id,
          businessName: lead.nama_bisnis,
          category: lead.kategori,
          city: lead.kota,
          phone: lead.nomor_wa,
          tahap: 2,
          tahapLabel: 'H+4 (Urgensi Sopan)',
          hariSejakPesan: diffDays,
          pesanTemplate: generateFollowUpMessage(
            { businessName: lead.nama_bisnis, city: lead.kota, category: lead.kategori },
            2
          ),
          terakhirDikontak: lastDateStr,
        });
      }
    }

    // Limit to max 20 per PRD rules
    const limitedQueue = followUpQueue.slice(0, 20);

    return NextResponse.json({
      success: true,
      queue: limitedQueue,
      totalEligible: followUpQueue.length,
      limit: 20,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat antrean follow-up.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { items, sendViaFonnte = true } = body as {
      items: Array<{ leadId: string; phone: string; message: string; tahap: 1 | 2 }>;
      sendViaFonnte?: boolean;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar follow-up kosong.' }, { status: 400 });
    }

    const token = process.env.FONNTE_API_TOKEN || process.env.FONNTE_TOKEN;
    const leads = getLeads();
    const results: Array<{ leadId: string; phone: string; success: boolean; error?: string }> = [];

    for (const item of items) {
      const cleanPhone = normalizeIndonesianPhone(item.phone);
      if (!cleanPhone || !isValidIndonesianWhatsApp(cleanPhone)) {
        results.push({ leadId: item.leadId, phone: item.phone, success: false, error: 'Nomor tidak valid' });
        continue;
      }

      const leadIdx = leads.findIndex((l) => l.id === item.leadId || l.nomor_wa === cleanPhone);
      const lead = leadIdx >= 0 ? leads[leadIdx] : null;

      // Abort if prospect replied in the meantime
      if (lead && (lead.status === 'Hangat' || lead.jangan_hubungi)) {
        results.push({ leadId: item.leadId, phone: item.phone, success: false, error: 'Dibatalkan (prospek sudah membalas/opt-out)' });
        continue;
      }

      let sentSuccess = false;
      let sendError: string | undefined;

      if (sendViaFonnte && token) {
        try {
          const formData = new FormData();
          formData.append('target', cleanPhone);
          formData.append('message', item.message);
          formData.append('countryCode', '62');

          const fonnteRes = await fetchWithRetry('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { Authorization: token },
            body: formData,
            timeoutMs: 15000,
            retries: 1,
          });

          const fonnteData = await fonnteRes.json().catch(() => null);
          if (fonnteRes.ok && (!fonnteData || fonnteData.status !== false)) {
            sentSuccess = true;
          } else {
            sendError = fonnteData?.reason || fonnteData?.message || 'Gagal kirim via Fonnte';
          }
        } catch (err: unknown) {
          sendError = err instanceof Error ? err.message : 'Kesalahan jaringan';
        }
      } else {
        // Simulation or direct manual approval
        sentSuccess = true;
      }

      if (sentSuccess) {
        const nowIso = new Date().toISOString();
        if (lead) {
          lead.tahap_followup = item.tahap;
          lead.followup_terakhir_at = nowIso;
          leads[leadIdx] = lead;
        }

        // Add message log
        addMessage({
          prospek_id: item.leadId,
          nomor_wa: cleanPhone,
          arah: 'keluar',
          isi: item.message,
          status: 'terkirim',
          tahap: item.tahap,
        });

        addLog({
          prospek_id: item.leadId,
          nomor_disamarkan: cleanPhone.slice(0, 4) + '****' + cleanPhone.slice(-3),
          arah: 'kirim',
          status: 'sukses',
          tahap: item.tahap,
        });

        results.push({ leadId: item.leadId, phone: cleanPhone, success: true });
      } else {
        addLog({
          prospek_id: item.leadId,
          nomor_disamarkan: cleanPhone.slice(0, 4) + '****' + cleanPhone.slice(-3),
          arah: 'kirim',
          status: 'gagal',
          alasan_gagal: sendError,
          tahap: item.tahap,
        });

        results.push({ leadId: item.leadId, phone: cleanPhone, success: false, error: sendError });
      }
    }

    // Save updated leads store
    saveLeads(leads);

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: items.length,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memproses pengiriman follow-up.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
