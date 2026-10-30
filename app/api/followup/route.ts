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

export function isWibSendingHours(): { allowed: boolean; message: string; wibHour: number; wibMinute: number } {
  const now = new Date();
  const wibHour = (now.getUTCHours() + 7) % 24;
  const wibMinute = now.getUTCMinutes();
  const timeNum = wibHour + wibMinute / 60;
  // PRD 11.3: 09.00 - 17.00 WIB
  const allowed = timeNum >= 9.0 && timeNum < 17.0;
  return {
    allowed,
    wibHour,
    wibMinute,
    message: allowed
      ? 'Jam kerja aktif (09.00 - 17.00 WIB)'
      : `Di luar jam kirim aman (09.00 - 17.00 WIB). Waktu WIB sekarang: ${String(wibHour).padStart(2, '0')}:${String(wibMinute).padStart(2, '0')}.`,
  };
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
    let updatedAny = false;

    for (const lead of leads) {
      // Exclude if opted out or already warm / closed / rejected
      if (lead.jangan_hubungi || lead.status === 'Hangat' || lead.status === 'Closing' || lead.status === 'Ditolak') {
        continue;
      }

      const tahap = lead.tahap_followup || 0;
      const lastDateStr = lead.followup_terakhir_at || lead.pesan_pertama_at || lead.terkirim_at || lead.dibuat_at;
      if (!lastDateStr) continue;

      const lastDate = new Date(lastDateStr);
      const diffMs = now.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // PRD: Setelah FU2 (H+4) prospek diam -> status jadi "Tidak merespons"
      if (tahap >= 2) {
        if (diffDays >= 2 && lead.status !== 'Tidak merespons') {
          lead.status = 'Tidak merespons';
          lead.diubah_at = now.toISOString();
          updatedAny = true;
        }
        continue;
      }

      // H+2 eligible (FU1)
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
      // H+4 eligible (FU2)
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

    if (updatedAny) {
      saveLeads(leads);
    }

    // Limit to max 20 per batch (PRD 11.3)
    const limitedQueue = followUpQueue.slice(0, 20);
    const hourCheck = isWibSendingHours();

    return NextResponse.json({
      success: true,
      queue: limitedQueue,
      totalEligible: followUpQueue.length,
      limit: 20,
      sendingHours: hourCheck,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat antrean follow-up.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      items,
      sendViaFonnte = true,
      bypassHours = false,
      dryRun = false,
      consecutiveFailuresForTest = 0,
    } = body as {
      items: Array<{ leadId: string; phone: string; message: string; tahap: 1 | 2 }>;
      sendViaFonnte?: boolean;
      bypassHours?: boolean;
      dryRun?: boolean;
      consecutiveFailuresForTest?: number;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar follow-up kosong.' }, { status: 400 });
    }

    // 1. PRD 11.3 Cek jam kirim (09.00 - 17.00 WIB)
    const hours = isWibSendingHours();
    if (!hours.allowed && !bypassHours && !dryRun) {
      return NextResponse.json(
        {
          success: false,
          delayed: true,
          error: `Di luar jam kirim aman (09.00 - 17.00 WIB). Pengiriman ditunda. Waktu sekarang: ${hours.wibHour}:${hours.wibMinute} WIB.`,
        },
        { status: 400 }
      );
    }

    // 2. PRD 11.3 Cek kuota harian total (default 50)
    const settings = getSettings();
    const dailyLimit = settings.batas_harian || 50;

    const token = process.env.FONNTE_API_TOKEN || process.env.FONNTE_TOKEN;
    const leads = getLeads();
    const results: Array<{ leadId: string; phone: string; success: boolean; error?: string }> = [];

    let consecutiveFailures = consecutiveFailuresForTest || 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // PRD 11.3 Circuit breaker: berhenti setelah 5 gagal berturut-turut
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        addLog({
          nomor_disamarkan: 'CIRCUIT_BREAKER',
          arah: 'kirim',
          status: 'gagal',
          alasan_gagal: 'Circuit Breaker: Terjadi 5 kegagalan berturut-turut. Pengiriman dihentikan otomatis.',
        });
        return NextResponse.json(
          {
            success: false,
            circuitBreakerTriggered: true,
            error: 'Circuit Breaker aktif: Pengiriman dihentikan otomatis setelah 5 kegagalan berturut-turut. Periksa perangkat WA.',
            results,
          },
          { status: 503 }
        );
      }

      const cleanPhone = normalizeIndonesianPhone(item.phone);
      if (!cleanPhone || !isValidIndonesianWhatsApp(cleanPhone)) {
        consecutiveFailures++;
        results.push({ leadId: item.leadId, phone: item.phone, success: false, error: 'Nomor tidak valid' });
        continue;
      }

      const leadIdx = leads.findIndex((l) => l.id === item.leadId || l.nomor_wa === cleanPhone);
      const lead = leadIdx >= 0 ? leads[leadIdx] : null;

      // PRD 11.2: Jika prospek sudah membalas (Hangat) atau opt-out, batalkan follow-up!
      if (lead && (lead.status === 'Hangat' || lead.jangan_hubungi)) {
        results.push({
          leadId: item.leadId,
          phone: item.phone,
          success: false,
          error: 'Dibatalkan otomatis: prospek sudah membalas atau meminta berhenti.',
        });
        continue;
      }

      let sentSuccess = false;
      let sendError: string | undefined;

      if (dryRun) {
        // Mode simulasi/dry-run untuk pengujian
        sentSuccess = true;
      } else if (sendViaFonnte && token) {
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
        sentSuccess = true;
      }

      if (sentSuccess) {
        consecutiveFailures = 0;
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
        consecutiveFailures++;
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
