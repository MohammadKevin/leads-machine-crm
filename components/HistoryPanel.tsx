'use client';

import React, { useState } from 'react';
import {
  SheetLeadRecord,
  OutreachMetrics,
  SheetResponseStatus,
} from '@/types/outreach';
import { formatPhoneDisplay, normalizeIndonesianPhone } from '@/lib/defensive-client';

interface Props {
  records: SheetLeadRecord[];
  metrics: OutreachMetrics;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  onUpdateStatus: (phone: string, status: SheetResponseStatus) => Promise<boolean>;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
  onOpenPrototype?: (record: SheetLeadRecord) => void;
}

const TARGET_REVENUE = 25_000_000;
const TICKET_PRICE = 2_833_333;

function calculateDaysRemaining(): number {
  const targetDate = new Date('2027-03-16T00:00:00');
  const now = new Date();
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

export default function HistoryPanel({
  records,
  metrics,
  isSyncing,
  onSync,
  onUpdateStatus,
  showToast,
  onOpenPrototype,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [viewMessageRecord, setViewMessageRecord] = useState<SheetLeadRecord | null>(null);

  const [closerLead, setCloserLead] = useState<SheetLeadRecord | null>(null);
  const [closerTab, setCloserTab] = useState<'proposal' | 'objections' | 'voicenote' | 'invoice'>('proposal');
  const [selectedTier, setSelectedTier] = useState<'esensial' | 'bisnis' | 'vip'>('bisnis');

  const closedCount = records.filter((r) => r.status === 'CLOSED_DEAL').length;
  const currentRevenue = closedCount * 2_500_000;
  const progressPct = Math.min(100, Math.round((currentRevenue / TARGET_REVENUE) * 100));
  const daysRemaining = calculateDaysRemaining();

  const hotLeads = records.filter(
    (r) => r.status === 'INTERESTED' || r.status === 'IN_PROGRESS'
  );

  const filteredRecords = records.filter((r) => {
    if (statusFilter === 'HOT') {
      if (r.status !== 'INTERESTED' && r.status !== 'IN_PROGRESS') return false;
    } else if (statusFilter !== 'ALL' && r.status !== statusFilter) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.businessName.toLowerCase().includes(q) ||
        r.normalizedPhone.includes(q) ||
        r.phone.includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleStatusChange = async (
    rec: SheetLeadRecord,
    newStatus: SheetResponseStatus
  ) => {
    if (rec.status === newStatus || updatingPhone === rec.normalizedPhone) return;
    setUpdatingPhone(rec.normalizedPhone);
    const ok = await onUpdateStatus(rec.normalizedPhone, newStatus);
    setUpdatingPhone(null);
    if (ok) {
      if (newStatus === 'CLOSED_DEAL') {
        showToast('success', `Deal closing tercapai untuk ${rec.businessName}! Nilai masuk ke target.`);
      } else {
        showToast('success', `Status ${rec.businessName} diperbarui ke ${newStatus}`);
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    showToast('success', `${label} disalin ke clipboard.`);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const getEstimatedDeal = (rec: SheetLeadRecord): string => {
    const cat = (rec.category || '').toLowerCase();
    if (cat.includes('villa') || cat.includes('glamping')) return 'Rp 2.500.000 – Rp 3.500.000';
    if (cat.includes('kontraktor') || cat.includes('interior') || cat.includes('kusen')) return 'Rp 2.500.000 – Rp 4.000.000';
    if (cat.includes('klinik') || cat.includes('gigi') || cat.includes('dokter')) return 'Rp 2.000.000 – Rp 3.000.000';
    return 'Rp 2.500.000';
  };

  const generateProposalText = (lead: SheetLeadRecord, tier: 'esensial' | 'bisnis' | 'vip'): string => {
    const name = lead.businessName;
    const city = lead.city || 'Jatim';

    if (tier === 'esensial') {
      return `Selamat siang Bapak/Ibu pengelola *${name}*,

Melanjutkan obrolan kita terkait website resmi *${name}*, berikut rincian paket efisien yang siap langsung jalan:

🌟 *PAKET ESENSIAL (Rp 2.500.000)*
• 1 Halaman Web Modern Mobile-First (Super ngebut di HP)
• Tombol Direct Booking WhatsApp (Bebas komisi OTA)
• Integrasi Lokasi Google Maps Resmi & Ulasan Bintang 5
• Termasuk Domain Resmi (.com / .my.id) & Server Cloud 1 Tahun
• Pengerjaan kilat 3 hari kerja + Garansi revisi

Pembayaran aman: DP 50% di awal, pelunasan 50% setelah website live dan disetujui.

Boleh kami mulai daftarkan domain resminya hari ini Pak/Bu?`;
    }

    if (tier === 'bisnis') {
      return `Selamat siang Bapak/Ibu pengelola *${name}*,

Melanjutkan diskusi terkait konsep website *${name}* di ${city}, berikut paket rekomendasi terbaik untuk mendatangkan klien/tamu langsung:

🏆 *PAKET BISNIS JUARA (Rp 3.500.000) — Rekomendasi*
• Landing Page Premium Desain Khusus Brand *${name}*
• Tombol Direct Booking WhatsApp Admin (Tanpa potongan komisi)
• Katalog / Galeri Foto Resolusi Tinggi (Kompres Kilat tanpa lemot)
• Form Cek Ketersediaan / Estimasi Harga Otomatis
• Integrasi Google Maps, Rating & Ulasan Pelanggan
• Optimasi SEO Pencarian Google Lokal di ${city}
• Termasuk Domain Resmi (.com / .id) & Server Cloud 1 Tahun
• Bonus Desain QR Code Meja / Akrilik siap cetak

Skema aman: DP 50% (Rp 1.750.000), sisa 50% dilunasi setelah website live tuntas (3–4 hari kerja).

Boleh kami kirimkan draft pengerjaannya hari ini Pak/Bu?`;
    }

    return `Selamat siang Bapak/Ibu pengelola *${name}*,

Berikut rincian solusi digital lengkap untuk mendominasi pasar di ${city}:

👑 *PAKET VIP SULTAN (Rp 4.500.000)*
• Semua keunggulan Paket Bisnis Juara
• Setup WhatsApp Business Auto-Responder & Template Quick Replies
• 3 Halaman Tambahan / Banner Campaign Promo Musiman
• Prioritas Pengerjaan Ekspres (48 Jam Live)
• Free Maintenance & Pembaruan Konten / Foto selama 3 Bulan
• Garansi Prioritas VIP

Skema: DP 50%, pelunasan 50% setelah tuntas live.

Apakah kami jadwalkan untuk slot pengerjaan minggu ini Pak/Bu?`;
  };

  const generateVoiceNoteScript = (lead: SheetLeadRecord): string => {
    return `[Panduan Voice Note 20 Detik WA]:
"Halo selamat siang Pak/Bu pengelola ${lead.businessName}, salam kenal kulo Kevin.
Tadi kulo sampun siapkan contoh tampilan website modern khusus ${lead.businessName} agar calon pelanggan bisa langsung pesan via WhatsApp tanpa potongan biaya komisi pihak ketiga.
Monggo link demonya dicek santai di HP nggih Pak/Bu. Jika ada bagian fasilitas atau tarif yang mau disesuaikan, kulo bantu ubah langsung sekarang gratis. Matur nuwun Pak/Bu!"`;
  };

  const generateInvoiceText = (lead: SheetLeadRecord, tier: 'esensial' | 'bisnis' | 'vip'): string => {
    const prices = {
      esensial: { total: 'Rp 2.500.000', dp: 'Rp 1.250.000', name: 'Paket Esensial' },
      bisnis: { total: 'Rp 3.500.000', dp: 'Rp 1.750.000', name: 'Paket Bisnis Juara' },
      vip: { total: 'Rp 4.500.000', dp: 'Rp 2.250.000', name: 'Paket VIP Sultan' },
    };
    const p = prices[tier];

    return `Baik Bapak/Ibu pengelola *${lead.businessName}*, terima kasih atas kepercayaannya bermitra dengan kami!

Berikut rincian pengerjaan website:
• Bisnis: *${lead.businessName}* (${lead.city || 'Jatim'})
• Paket: *${p.name}*
• Total Investasi: *${p.total}* (Sekali bayar, tanpa biaya bulanan)
• Komitmen DP 50%: *${p.dp}*
• Pelunasan 50%: Setelah website live & disetujui (3-4 hari kerja)

Rekening Pembayaran Resmi:
🏦 *Bank BCA*
No. Rekening: *3151249912*
Atas Nama: *Mohammad Kevin*

Mohon kirimkan bukti transfer di sini agar tim langsung mengunci domain resmi dan server ${lead.businessName}. Matur nuwun!`;
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      <section className="w-full bg-[#0B0F14] border border-[#1F2937] rounded-[8px] p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
              Misi 16 Maret 2027
            </span>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-slate-300">
            <span className="font-medium text-emerald-400">{progressPct}% tercapai</span>
            <span className="w-[1px] h-3 bg-slate-700" />
            <span className="text-slate-300 font-mono">{closedCount} dari 10 deal</span>
            <span className="w-[1px] h-3 bg-slate-700" />
            <span className="text-slate-400 font-mono">{daysRemaining} hari tersisa</span>
          </div>
        </div>

        <div className="flex items-baseline flex-wrap">
          <span className="text-[36px] sm:text-[40px] leading-tight font-bold text-white tracking-tight font-mono">
            Rp {currentRevenue.toLocaleString('id-ID')}
          </span>
          <span className="text-[20px] sm:text-[24px] text-slate-400 font-normal ml-2 font-mono">
            / Rp {TARGET_REVENUE.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="w-full h-[6px] bg-slate-800 rounded-full overflow-hidden mt-4">
          <div
            className="bg-[#059669] h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="text-[12px] text-slate-400 mt-3">
          Target omzet bulanan web lokal Jawa Timur · Rata-rata deal Rp {TICKET_PRICE.toLocaleString('id-ID')}
        </p>
      </section>

      <section className="flex flex-col w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-slate-900">Prospek Hangat</h2>
            <span className="bg-amber-100 text-amber-800 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
              {hotLeads.length}
            </span>
            <span className="hidden md:inline text-[12px] text-slate-500 ml-2">
              Klien yang merespon WhatsApp atau dalam diskusi aktif
            </span>
          </div>
        </div>

        {hotLeads.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 text-center text-slate-500 text-[12px]">
            Belum ada prospek hangat saat ini. Jalankan radar di tab <strong className="text-slate-800">Radar Klien</strong> untuk mengirim pesan ke target A1.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hotLeads.map((hl) => {
              const phoneClean = normalizeIndonesianPhone(hl.normalizedPhone || hl.phone);
              const waUrl = `https://wa.me/${phoneClean}`;
              const isUpdating = updatingPhone === hl.normalizedPhone;

              return (
                <div
                  key={hl.id}
                  className="bg-white border border-[#E5E7EB] border-l-[3px] border-l-amber-500 rounded-[8px] p-4 flex flex-col justify-between transition-colors hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[14px] font-semibold text-slate-900 leading-snug">
                          {hl.businessName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {hl.city || 'Jatim'}
                          </span>
                          <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {hl.status === 'INTERESTED' ? 'Membalas / Tertarik' : 'Diskusi Berjalan'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="my-3 p-2.5 bg-slate-50 border border-slate-100 rounded text-slate-600 text-[12px] italic leading-relaxed">
                      {hl.messageSent
                        ? `"${hl.messageSent.slice(0, 100)}..."`
                        : '"Tertarik melihat prototype website langsung di HP."'}
                    </div>

                    <div className="font-mono text-[13px] font-semibold text-emerald-700 mb-3">
                      Est. {getEstimatedDeal(hl)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCloserLead(hl);
                        setCloserTab('proposal');
                      }}
                      className="w-full bg-[#059669] hover:bg-emerald-700 text-white text-[12px] font-medium py-1.5 px-3 rounded-[6px] text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">psychology</span>
                      <span>Amunisi Closing &amp; Proposal</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      {onOpenPrototype && (
                        <button
                          type="button"
                          onClick={() => onOpenPrototype(hl)}
                          className="w-full bg-[#0F172A] hover:bg-slate-800 text-white text-[11px] font-medium py-1.5 px-2 rounded-[6px] text-center transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">terminal</span>
                          <span>Prototype</span>
                        </button>
                      )}

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-medium py-1.5 px-2 rounded-[6px] text-center transition-colors flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px] text-emerald-600">send</span>
                        <span>Chat WA</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStatusChange(hl, 'CLOSED_DEAL')}
                      className="w-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-[11px] font-semibold py-1.5 px-3 rounded-[6px] text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>{isUpdating ? 'Memproses...' : 'Kunci Deal Closing (Rp 2,5jt+)'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col w-full pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-slate-900">Pipeline &amp; Kontak Riwayat</h2>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
              <span>tersinkron ke Sheets</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56 sm:w-64">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari bisnis, nomor, kota…"
                className="w-full h-8 pl-8 pr-3 text-[12px] rounded-[6px] bg-white border border-[#E5E7EB] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition"
              />
              <span className="material-symbols-outlined text-[15px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                search
              </span>
            </div>

            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="h-8 px-3 rounded-[6px] border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[15px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Sinkron…' : 'Sync'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-md text-[11px] font-medium mb-3 self-start">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-none'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua <span className="font-mono text-slate-400">{records.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('HOT')}
            className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
              statusFilter === 'HOT'
                ? 'bg-white text-slate-900 shadow-none'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hangat <span className="font-mono text-amber-600 font-semibold">{hotLeads.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('CLOSED_DEAL')}
            className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
              statusFilter === 'CLOSED_DEAL'
                ? 'bg-white text-slate-900 shadow-none'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Closed <span className="font-mono text-emerald-600 font-semibold">{closedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('CONTACTED')}
            className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer ${
              statusFilter === 'CONTACTED'
                ? 'bg-white text-slate-900 shadow-none'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Terkirim <span className="font-mono text-slate-400">{records.filter((r) => r.status === 'CONTACTED').length}</span>
          </button>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-[8px] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-slate-50/75 text-[11px] uppercase font-semibold text-slate-500 tracking-[0.04em]">
                <th className="py-2.5 px-4 font-semibold">Bisnis</th>
                <th className="py-2.5 px-4 font-semibold">Kota</th>
                <th className="py-2.5 px-4 font-semibold">WhatsApp</th>
                <th className="py-2.5 px-4 font-semibold">Estimasi Nilai</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-[12px]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada prospek yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isUpdating = updatingPhone === rec.normalizedPhone;
                  const phoneClean = normalizeIndonesianPhone(rec.normalizedPhone || rec.phone);
                  const waUrl = `https://wa.me/${phoneClean}`;

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div className="text-[13px] font-semibold text-slate-900">{rec.businessName}</div>
                        <div className="text-[11px] text-slate-500">{rec.category}</div>
                      </td>

                      <td className="py-2.5 px-4 text-slate-600">
                        {rec.city || '—'}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-700 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span>{formatPhoneDisplay(rec.normalizedPhone || rec.phone)}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(rec.normalizedPhone || rec.phone, 'Nomor')}
                            className="text-slate-400 hover:text-slate-700 transition"
                            title="Salin nomor"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {copiedPhone === (rec.normalizedPhone || rec.phone) ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[12px] font-medium text-slate-800">
                        {getEstimatedDeal(rec)}
                      </td>

                      <td className="py-2.5 px-4">
                        <select
                          aria-label="Status Negosiasi"
                          value={rec.status}
                          disabled={isUpdating}
                          onChange={(e) =>
                            handleStatusChange(rec, e.target.value as SheetResponseStatus)
                          }
                          className="text-[11px] font-medium py-1 px-2 rounded border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        >
                          <option value="CONTACTED">Terkirim (Contacted)</option>
                          <option value="INTERESTED">🔥 Interested (Hot)</option>
                          <option value="IN_PROGRESS">💬 In Progress</option>
                          <option value="CLOSED_DEAL">🏆 Closed Deal</option>
                          <option value="REJECTED">Ditolak</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setCloserLead(rec);
                              setCloserTab('proposal');
                            }}
                            className="border border-emerald-300 hover:bg-emerald-50 text-emerald-800 px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Buka Amunisi Closing & Proposal"
                          >
                            <span className="material-symbols-outlined text-[12px]">psychology</span>
                            <span>Closing</span>
                          </button>

                          {onOpenPrototype && (
                            <button
                              type="button"
                              onClick={() => onOpenPrototype(rec)}
                              className="border border-[#E5E7EB] hover:bg-slate-100 text-slate-700 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Buka di Prototype Studio"
                            >
                              <span>Prototype</span>
                              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            </button>
                          )}

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-[#E5E7EB] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                            title="Chat WhatsApp"
                          >
                            <span>WhatsApp</span>
                            <span className="material-symbols-outlined text-[12px]">send</span>
                          </a>

                          {rec.messageSent && (
                            <button
                              type="button"
                              onClick={() => setViewMessageRecord(rec)}
                              className="border border-[#E5E7EB] hover:bg-slate-100 text-slate-600 p-1 rounded text-[11px] inline-flex items-center transition-colors cursor-pointer"
                              title="Lihat pesan terkirim"
                            >
                              <span className="material-symbols-outlined text-[13px]">description</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {closerLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-[10px] max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">psychology</span>
                  <h3 className="text-[16px] font-bold text-slate-900">
                    Amunisi Closing Rp 25 Juta: {closerLead.businessName}
                  </h3>
                </div>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Target Closing: <strong className="text-emerald-700 font-mono">{getEstimatedDeal(closerLead)}</strong> · {closerLead.city || 'Jatim'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloserLead(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[6px] text-[12px] font-medium">
              <button
                type="button"
                onClick={() => setCloserTab('proposal')}
                className={`flex-1 py-1 px-2 rounded-[4px] transition-all cursor-pointer ${
                  closerTab === 'proposal'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Proposal WA
              </button>
              <button
                type="button"
                onClick={() => setCloserTab('objections')}
                className={`flex-1 py-1 px-2 rounded-[4px] transition-all cursor-pointer ${
                  closerTab === 'objections'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Tangkis Keberatan
              </button>
              <button
                type="button"
                onClick={() => setCloserTab('voicenote')}
                className={`flex-1 py-1 px-2 rounded-[4px] transition-all cursor-pointer ${
                  closerTab === 'voicenote'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Voice Note VN
              </button>
              <button
                type="button"
                onClick={() => setCloserTab('invoice')}
                className={`flex-1 py-1 px-2 rounded-[4px] transition-all cursor-pointer ${
                  closerTab === 'invoice'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                4. Kunci DP 50%
              </button>
            </div>

            <div className="overflow-y-auto max-h-[55vh] flex flex-col gap-3 pr-1 text-[12px]">
              {closerTab === 'proposal' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Pilih Tingkat Penawaran:</span>
                    <div className="inline-flex gap-1 bg-slate-100 p-0.5 rounded text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedTier('esensial')}
                        className={`px-2 py-0.5 rounded transition ${
                          selectedTier === 'esensial' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Esensial (2,5jt)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTier('bisnis')}
                        className={`px-2 py-0.5 rounded transition ${
                          selectedTier === 'bisnis' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Bisnis Juara (3,5jt) ★
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTier('vip')}
                        className={`px-2 py-0.5 rounded transition ${
                          selectedTier === 'vip' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        VIP Sultan (4,5jt)
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3.5 text-slate-800 font-sans whitespace-pre-wrap leading-relaxed select-text">
                    {generateProposalText(closerLead, selectedTier)}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(generateProposalText(closerLead, selectedTier), 'Format proposal')
                      }
                      className="h-8 px-3 rounded-[6px] border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span>Salin Proposal</span>
                    </button>
                    <a
                      href={`https://wa.me/${(closerLead.normalizedPhone || closerLead.phone).replace(/\D/g, '')}?text=${encodeURIComponent(
                        generateProposalText(closerLead, selectedTier)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-4 rounded-[6px] bg-[#059669] hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">send</span>
                      <span>Kirim ke WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}

              {closerTab === 'objections' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-[8px]">
                    <div className="font-bold text-slate-900 mb-1 flex items-center justify-between">
                      <span>1. &ldquo;Mahal mas, belum ada budget segitu.&rdquo;</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            `Sangat dipahami Pak. Sebagai pertimbangan bisnis: jika mengandalkan OTA (Traveloka/Agoda/Tiket), mereka potong komisi 15%–20% per booking. Cukup dapat 8 booking langsung lewat website resmi, biaya website Rp 2,5jt ini sudah BALIK MODAL seumur hidup. Selebihnya 100% laba bersih milik bapak. Kami juga support opsi DP 50% di awal agar ringan.`,
                            'Skrip tangkis harga'
                          )
                        }
                        className="text-[#059669] hover:underline text-[11px] font-semibold"
                      >
                        Salin Jawaban
                      </button>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      <strong>Strategi ROI Math:</strong> Jelaskan komisi OTA 15%–20% yang hilang tiap booking. Tunjukkan bahwa 8 booking langsung saja sudah balik modal lunas seumur hidup.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-[8px]">
                    <div className="font-bold text-slate-900 mb-1 flex items-center justify-between">
                      <span>2. &ldquo;Kita sudah ada Instagram aktif mas, rasanya sudah cukup.&rdquo;</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            `Instagram sangat bagus untuk posting foto Pak, namun kelemahannya: calon tamu luar kota yang butuh mendesak mencarinya di Google ('Villa privat Batu' atau 'Kontraktor interior Malang'), bukan di feed IG. Di Instagram mereka juga malas scroll pricelist. Website resmi memberi kepastian harga, ulasan Google terverifikasi, dan langsung tombol booking WA kilat.`,
                            'Skrip Instagram vs Web'
                          )
                        }
                        className="text-[#059669] hover:underline text-[11px] font-semibold"
                      >
                        Salin Jawaban
                      </button>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      <strong>Strategi Google Search Traffic:</strong> Tamu luar kota dengan daya beli tinggi mencari di Google Search &amp; Google Maps, bukan di algoritma Instagram yang tenggelam.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-[8px]">
                    <div className="font-bold text-slate-900 mb-1 flex items-center justify-between">
                      <span>3. &ldquo;Nanti dulu ya mas, saya rembukan dulu sama partner.&rdquo;</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            `Monggo silakan Pak, keputusan bersama tentu yang terbaik. Sekadar info santun, agar kualitas server terjaga prima, kami hanya buka kuota pengerjaan untuk 2 bisnis di wilayah ${closerLead.city || 'Jatim'} minggu ini. Konsep prototype ${closerLead.businessName} sudah kami amankan, jika disetujui minggu ini dalam 3–4 hari website sudah live aktif.`,
                            'Skrip urgensi santun'
                          )
                        }
                        className="text-[#059669] hover:underline text-[11px] font-semibold"
                      >
                        Salin Jawaban
                      </button>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      <strong>Strategi Urgensi Santun:</strong> Berikan batasan kuota pengerjaan mingguan agar owner merasa ada momentum yang jangan sampai terlewat.
                    </p>
                  </div>
                </div>
              )}

              {closerTab === 'voicenote' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[8px]">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold mb-1">
                      <span className="material-symbols-outlined text-[16px]">mic</span>
                      <span>Kekuatan Voice Note (VN) WA</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Merekam suara 15–25 detik dengan logat ramah santun khas Jawa Timur menaikkan konversi closing hingga <strong>3x lipat</strong> dibanding teks panjang biasa.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-800 font-sans whitespace-pre-wrap leading-relaxed select-text">
                    {generateVoiceNoteScript(closerLead)}
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(generateVoiceNoteScript(closerLead), 'Skrip Voice Note')}
                    className="self-end h-8 px-3 rounded-[6px] border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>Salin Skrip Suara</span>
                  </button>
                </div>
              )}

              {closerTab === 'invoice' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-[8px]">
                    <div className="flex items-center gap-2 text-purple-800 font-semibold mb-1">
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      <span>Kunci Komitmen DP 50%</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Jangan pernah mulai setup server dan beli domain sebelum DP 50% masuk. Ini menjamin klien serius dan cashflow proyek aman.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-[8px] p-3 text-slate-800 font-sans whitespace-pre-wrap leading-relaxed select-text">
                    {generateInvoiceText(closerLead, selectedTier)}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(generateInvoiceText(closerLead, selectedTier), 'Invoice pembayaran DP')
                      }
                      className="h-8 px-3 rounded-[6px] border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span>Salin Format Pembayaran</span>
                    </button>
                    <a
                      href={`https://wa.me/${(closerLead.normalizedPhone || closerLead.phone).replace(/\D/g, '')}?text=${encodeURIComponent(
                        generateInvoiceText(closerLead, selectedTier)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-4 rounded-[6px] bg-purple-700 hover:bg-purple-800 text-white font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">send</span>
                      <span>Kirim ke WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Gunakan taktik ini untuk mengunci deal minimal Rp 2.500.000 ke rekening Anda.
              </span>
              <button
                type="button"
                onClick={() => setCloserLead(null)}
                className="h-8 px-4 rounded-[6px] bg-[#0F172A] hover:bg-slate-800 text-white text-[12px] font-medium transition cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMessageRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] max-w-lg w-full p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-[14px] font-semibold text-slate-900">Riwayat Pesan Terkirim</h4>
                <p className="text-[12px] text-slate-500">
                  {viewMessageRecord.businessName} ({formatPhoneDisplay(viewMessageRecord.normalizedPhone || viewMessageRecord.phone)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMessageRecord(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-[6px] p-3 max-h-60 overflow-y-auto">
              <pre className="text-[12px] text-slate-800 font-sans whitespace-pre-wrap leading-relaxed">
                {viewMessageRecord.messageSent}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => copyToClipboard(viewMessageRecord.messageSent || '', 'Pesan')}
                className="h-8 px-3 rounded-[6px] border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 text-[12px] font-medium transition cursor-pointer"
              >
                Salin Pesan
              </button>
              <button
                type="button"
                onClick={() => setViewMessageRecord(null)}
                className="h-8 px-4 rounded-[6px] bg-[#0F172A] hover:bg-slate-800 text-white text-[12px] font-medium transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
