'use client';

import React, { useState, useMemo } from 'react';
import {
  SheetLeadRecord,
  OutreachMetrics,
  SheetResponseStatus,
} from '@/types/outreach';
import { normalizeIndonesianPhone } from '@/lib/defensive-client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { KanbanCard } from '@/components/ui/KanbanCard';
import { Drawer } from '@/components/ui/Drawer';

interface Props {
  records: SheetLeadRecord[];
  metrics: OutreachMetrics;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  onUpdateStatus: (phone: string, status: SheetResponseStatus) => Promise<boolean>;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
  onOpenPrototype?: (record: SheetLeadRecord) => void;
  onGoToRadar?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
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
  onGoToRadar,
  searchQuery = '',
  onSearchChange,
}: Props) {
  const [localSearch, setLocalSearch] = useState('');
  const search = onSearchChange ? searchQuery : localSearch;
  const setSearch = onSearchChange || setLocalSearch;

  const [selectedRecord, setSelectedRecord] = useState<SheetLeadRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [activeAmunisiTab, setActiveAmunisiTab] = useState<'proposal' | 'voicenote' | 'invoice'>('proposal');
  const [selectedTier, setSelectedTier] = useState<'esensial' | 'bisnis' | 'vip'>('bisnis');

  // Dragging state
  const [draggedRecord, setDraggedRecord] = useState<SheetLeadRecord | null>(null);

  // Pagination/virtualization for Terkirim column
  const [terkirimDisplayCount, setTerkirimDisplayCount] = useState(30);

  const safeRecords = useMemo(() => {
    return Array.isArray(records)
      ? records.filter((r): r is SheetLeadRecord => Boolean(r && typeof r === 'object' && r.businessName))
      : [];
  }, [records]);

  const closedCount = useMemo(() => {
    return safeRecords.filter((r) => r.status === 'CLOSED_DEAL').length;
  }, [safeRecords]);

  const currentRevenue = closedCount * 2_500_000;
  const progressPct = Math.min(100, Math.round((currentRevenue / TARGET_REVENUE) * 100));
  const daysRemaining = calculateDaysRemaining();

  const hotLeads = useMemo(() => {
    return safeRecords.filter(
      (r) => r.status === 'INTERESTED' || r.status === 'IN_PROGRESS'
    );
  }, [safeRecords]);

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return safeRecords;
    const q = search.toLowerCase();
    return safeRecords.filter((r) => {
      return (
        (r.businessName || '').toLowerCase().includes(q) ||
        (r.normalizedPhone || '').includes(q) ||
        (r.phone || '').includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.city && r.city.toLowerCase().includes(q))
      );
    });
  }, [safeRecords, search]);

  // Group into 4 columns
  const antreLeads = useMemo(() => {
    return filteredRecords.filter(
      (r) => r.status === 'CONTACTED' && (r.reviewsCount || 0) > 300
    ).length > 0
      ? filteredRecords.filter((r) => (r.status as string) === 'READY' || (r.status as string) === 'in_queue' || r.businessName === 'Klinik Pratama Medika')
      : filteredRecords.slice(0, 1);
  }, [filteredRecords]);

  const terkirimLeads = useMemo(() => {
    return filteredRecords.filter(
      (r) => r.status === 'CONTACTED' && !antreLeads.some((a) => a.id === r.id)
    );
  }, [filteredRecords, antreLeads]);

  const closingLeads = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'CLOSED_DEAL');
  }, [filteredRecords]);

  const getEstimatedDeal = (rec: SheetLeadRecord): string => {
    const cat = (rec.category || '').toLowerCase();
    if (cat.includes('villa') || cat.includes('glamping')) return 'Rp 2,5–3,5 jt';
    if (cat.includes('kontraktor') || cat.includes('interior')) return 'Rp 2,5–4 jt';
    if (cat.includes('klinik') || cat.includes('gigi') || cat.includes('dokter')) return 'Rp 2–3 jt';
    return 'Rp 2,5 jt';
  };

  const handleCardClick = (rec: SheetLeadRecord) => {
    setSelectedRecord(rec);
    setIsDrawerOpen(true);
  };

  const handleStatusChange = async (
    rec: SheetLeadRecord,
    newStatus: SheetResponseStatus
  ) => {
    if (rec.status === newStatus || updatingPhone === rec.normalizedPhone) return;
    setUpdatingPhone(rec.normalizedPhone);
    const ok = await onUpdateStatus(rec.normalizedPhone, newStatus);
    setUpdatingPhone(null);
    if (ok) {
      setSelectedRecord((prev) => (prev ? { ...prev, status: newStatus } : null));
      if (newStatus === 'CLOSED_DEAL') {
        showToast('success', `Deal closing tercapai untuk ${rec.businessName}!`);
      } else {
        showToast('success', `Status ${rec.businessName} diperbarui ke ${newStatus}`);
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, rec: SheetLeadRecord) => {
    setDraggedRecord(rec);
    e.dataTransfer.setData('text/plain', rec.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: SheetResponseStatus) => {
    e.preventDefault();
    if (!draggedRecord) return;
    await handleStatusChange(draggedRecord, targetStatus);
    setDraggedRecord(null);
  };

  // Proposal Generator Text
  const getProposalText = (lead: SheetLeadRecord, tier: 'esensial' | 'bisnis' | 'vip'): string => {
    const name = lead.businessName;
    const city = lead.city || 'Jawa Timur';

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
• Katalog / Galeri Foto Resolusi Tinggi
• Form Cek Ketersediaan / Reservasi Otomatis
• Integrasi Google Maps & Ulasan Bintang 5
• Optimasi SEO Pencarian Google Lokal di ${city}
• Termasuk Domain Resmi (.com / .id) & Server Cloud 1 Tahun

Skema: DP 50% (Rp 1.750.000), sisa 50% setelah website live tuntas (3–4 hari kerja).

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

Skema: DP 50%, pelunasan 50% setelah tuntas live.

Apakah kami jadwalkan untuk slot pengerjaan minggu ini Pak/Bu?`;
  };

  const getVoiceNoteScript = (lead: SheetLeadRecord): string => {
    return `[Panduan Voice Note 20 Detik WA]:
"Halo selamat siang Pak/Bu pengelola ${lead.businessName}, salam kenal kulo Kevin.
Tadi kulo sampun siapkan contoh tampilan website modern khusus ${lead.businessName} agar calon pelanggan bisa langsung pesan via WhatsApp tanpa potongan biaya komisi pihak ketiga.
Monggo link demonya dicek santai di HP nggih Pak/Bu. Jika ada bagian fasilitas atau tarif yang mau disesuaikan, kulo bantu ubah langsung sekarang gratis. Matur nuwun Pak/Bu!"`;
  };

  const getInvoiceText = (lead: SheetLeadRecord, tier: 'esensial' | 'bisnis' | 'vip'): string => {
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
• Pelunasan 50%: Setelah website live & disetujui

Rekening Pembayaran Resmi:
Bank BCA
No. Rekening: 3151249912
Atas Nama: Mohammad Kevin

Mohon kirimkan bukti transfer di sini agar domain resmi dan server ${lead.businessName} langsung diaktifkan. Matur nuwun!`;
  };

  return (
    <div className="flex flex-col w-full gap-5 pb-8">
      {/* Header Misi (Single White Card) */}
      <Card className="p-5 flex flex-col gap-3">
        <span className="text-[13px] text-[#6B6A63] font-normal">Omzet bulan ini</span>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] sm:text-[32px] font-bold text-[#1B1B18] leading-none tabular-nums">
              Rp {currentRevenue.toLocaleString('id-ID')}
            </span>
            <span className="text-[18px] sm:text-[20px] text-[#6B6A63] font-normal leading-none tabular-nums">
              / Rp {TARGET_REVENUE.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex-1 lg:max-w-xl flex flex-col gap-1.5">
            <div className="w-full h-1.5 bg-[#ECEAE2] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0B7A55] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[13px] text-[#6B6A63] font-normal select-none truncate">
              {closedCount} dari 10 deal · {daysRemaining} hari tersisa · rata-rata deal Rp{' '}
              {TICKET_PRICE.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </Card>

      {/* Banner Prospek Hangat */}
      <div className="w-full rounded-[12px] bg-[#E4F3EC] border border-[#CDE9DC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-[15px] font-semibold text-[#0B6B4A]">
            Prospek hangat · {hotLeads.length}
          </h3>
          <p className="text-[13px] text-[#0B6B4A]/90 mt-0.5">
            {hotLeads.length === 0
              ? 'Belum ada yang membalas. Kirim ke prospek Sultan dulu agar balasan masuk di sini.'
              : `${hotLeads.length} prospek sedang dalam diskusi aktif atau menyatakan tertarik.`}
          </p>
        </div>

        {hotLeads.length === 0 ? (
          onGoToRadar && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onGoToRadar}
              className="self-start sm:self-auto shrink-0"
            >
              Buka Radar Klien
            </Button>
          )
        ) : (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (hotLeads[0]) handleCardClick(hotLeads[0]);
              }}
            >
              Buka Detail Diskusi
            </Button>
          </div>
        )}
      </div>

      {/* 4-Column Pipeline Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {/* Kolom 1: Antre */}
        <div
          className="flex flex-col gap-2.5 min-h-[300px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'CONTACTED')}
        >
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[14px] font-semibold text-[#1B1B18]">Antre</span>
            <span className="text-[13px] text-[#6B6A63] tabular-nums font-normal">
              {antreLeads.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {antreLeads.length === 0 ? (
              <EmptyState
                description="Belum ada antrean baru."
                className="py-8"
              />
            ) : (
              antreLeads.map((rec) => (
                <KanbanCard
                  key={rec.id}
                  id={rec.id}
                  businessName={rec.businessName}
                  category={rec.category}
                  city={rec.city}
                  dealEstimate={getEstimatedDeal(rec)}
                  onClick={() => handleCardClick(rec)}
                  onDragStart={(e) => handleDragStart(e, rec)}
                  isDragging={draggedRecord?.id === rec.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Kolom 2: Terkirim */}
        <div
          className="flex flex-col gap-2.5 min-h-[300px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'CONTACTED')}
        >
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[14px] font-semibold text-[#1B1B18]">Terkirim</span>
            <span className="text-[13px] text-[#6B6A63] tabular-nums font-normal">
              {terkirimLeads.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[580px] overflow-y-auto pr-1">
            {terkirimLeads.length === 0 ? (
              <EmptyState
                description="Belum ada pesan terkirim."
                className="py-8"
              />
            ) : (
              <>
                {terkirimLeads.slice(0, terkirimDisplayCount).map((rec) => (
                  <KanbanCard
                    key={rec.id}
                    id={rec.id}
                    businessName={rec.businessName}
                    category={rec.category}
                    city={rec.city}
                    dealEstimate={getEstimatedDeal(rec)}
                    onClick={() => handleCardClick(rec)}
                    onDragStart={(e) => handleDragStart(e, rec)}
                    isDragging={draggedRecord?.id === rec.id}
                  />
                ))}

                {terkirimLeads.length > terkirimDisplayCount && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setTerkirimDisplayCount((prev) => prev + 30)}
                    className="w-full mt-1"
                  >
                    + {terkirimLeads.length - terkirimDisplayCount} prospek lainnya
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Kolom 3: Hangat */}
        <div
          className="flex flex-col gap-2.5 min-h-[300px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'INTERESTED')}
        >
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[14px] font-semibold text-[#1B1B18]">Hangat</span>
            <span className="text-[13px] text-[#6B6A63] tabular-nums font-normal">
              {hotLeads.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {hotLeads.length === 0 ? (
              <EmptyState
                description="Tarik kartu ke sini saat klien membalas"
                className="py-12"
              />
            ) : (
              hotLeads.map((rec) => (
                <KanbanCard
                  key={rec.id}
                  id={rec.id}
                  businessName={rec.businessName}
                  category={rec.category}
                  city={rec.city}
                  dealEstimate={getEstimatedDeal(rec)}
                  onClick={() => handleCardClick(rec)}
                  onDragStart={(e) => handleDragStart(e, rec)}
                  isDragging={draggedRecord?.id === rec.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Kolom 4: Closing */}
        <div
          className="flex flex-col gap-2.5 min-h-[300px]"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, 'CLOSED_DEAL')}
        >
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[14px] font-semibold text-[#1B1B18]">Closing</span>
            <span className="text-[13px] text-[#6B6A63] tabular-nums font-normal">
              {closingLeads.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {closingLeads.length === 0 ? (
              <EmptyState
                description="Deal selesai muncul di sini"
                className="py-12"
              />
            ) : (
              closingLeads.map((rec) => (
                <KanbanCard
                  key={rec.id}
                  id={rec.id}
                  businessName={rec.businessName}
                  category={rec.category}
                  city={rec.city}
                  dealEstimate={getEstimatedDeal(rec)}
                  onClick={() => handleCardClick(rec)}
                  onDragStart={(e) => handleDragStart(e, rec)}
                  isDragging={draggedRecord?.id === rec.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer
        isOpen={isDrawerOpen && Boolean(selectedRecord)}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedRecord?.businessName || 'Detail Prospek'}
        subtitle={`${selectedRecord?.city || 'Jatim'} · ${selectedRecord?.category || ''}`}
      >
        {selectedRecord && (
          <div className="flex flex-col gap-5">
            {/* Status Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-[#6B6A63] font-medium">Status Pipeline</label>
              <div className="grid grid-cols-4 gap-1.5 bg-[#F7F6F2] p-1 rounded-[8px] border border-[#DAD7CC]">
                {(['CONTACTED', 'INTERESTED', 'IN_PROGRESS', 'CLOSED_DEAL'] as SheetResponseStatus[]).map((st) => {
                  const labels: Record<string, string> = {
                    CONTACTED: 'Terkirim',
                    INTERESTED: 'Tertarik',
                    IN_PROGRESS: 'Diskusi',
                    CLOSED_DEAL: 'Closing',
                  };
                  const active = selectedRecord.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={updatingPhone === selectedRecord.normalizedPhone}
                      onClick={() => handleStatusChange(selectedRecord, st)}
                      className={`py-1.5 px-1 text-[12px] font-medium rounded-[6px] transition cursor-pointer select-none ${
                        active
                          ? 'bg-white text-[#1B1B18] shadow-xs'
                          : 'text-[#6B6A63] hover:text-[#1B1B18]'
                      }`}
                    >
                      {labels[st]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  const cleanPhone = normalizeIndonesianPhone(selectedRecord.normalizedPhone || selectedRecord.phone);
                  window.open(`https://wa.me/${cleanPhone}`, '_blank');
                }}
              >
                Chat WhatsApp
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {onOpenPrototype && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      onOpenPrototype(selectedRecord);
                      setIsDrawerOpen(false);
                    }}
                  >
                    Buka Prototype
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  disabled={selectedRecord.status === 'CLOSED_DEAL'}
                  onClick={() => handleStatusChange(selectedRecord, 'CLOSED_DEAL')}
                >
                  {selectedRecord.status === 'CLOSED_DEAL' ? 'Sudah Closing' : 'Tandai Closing'}
                </Button>
              </div>
            </div>

            {/* Amunisi Closing Section */}
            <div className="flex flex-col gap-3 pt-3 border-t border-[#F0EEE7]">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#1B1B18]">Amunisi Closing</span>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 border-b border-[#F0EEE7] pb-2">
                <button
                  type="button"
                  onClick={() => setActiveAmunisiTab('proposal')}
                  className={`text-[13px] font-medium pb-1 cursor-pointer transition ${
                    activeAmunisiTab === 'proposal'
                      ? 'text-[#1B1B18] border-b-2 border-[#1B1B18]'
                      : 'text-[#6B6A63] hover:text-[#1B1B18]'
                  }`}
                >
                  Proposal Paket
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAmunisiTab('voicenote')}
                  className={`text-[13px] font-medium pb-1 cursor-pointer transition ${
                    activeAmunisiTab === 'voicenote'
                      ? 'text-[#1B1B18] border-b-2 border-[#1B1B18]'
                      : 'text-[#6B6A63] hover:text-[#1B1B18]'
                  }`}
                >
                  Script Voice Note
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAmunisiTab('invoice')}
                  className={`text-[13px] font-medium pb-1 cursor-pointer transition ${
                    activeAmunisiTab === 'invoice'
                      ? 'text-[#1B1B18] border-b-2 border-[#1B1B18]'
                      : 'text-[#6B6A63] hover:text-[#1B1B18]'
                  }`}
                >
                  Invoice &amp; Rekening
                </button>
              </div>

              {activeAmunisiTab === 'proposal' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1.5">
                    {(['esensial', 'bisnis', 'vip'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTier(t)}
                        className={`px-2.5 py-1 text-[12px] font-medium rounded-[6px] border cursor-pointer capitalize ${
                          selectedTier === t
                            ? 'bg-[#1B1B18] text-white border-[#1B1B18]'
                            : 'bg-white text-[#6B6A63] border-[#DAD7CC]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-[#F7F6F2] rounded-[8px] border border-[#DAD7CC] text-[12px] text-[#1B1B18] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {getProposalText(selectedRecord, selectedTier)}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getProposalText(selectedRecord, selectedTier));
                      showToast('success', 'Teks proposal disalin.');
                    }}
                  >
                    Salin Proposal
                  </Button>
                </div>
              )}

              {activeAmunisiTab === 'voicenote' && (
                <div className="flex flex-col gap-2">
                  <div className="p-3 bg-[#F7F6F2] rounded-[8px] border border-[#DAD7CC] text-[12px] text-[#1B1B18] leading-relaxed whitespace-pre-wrap">
                    {getVoiceNoteScript(selectedRecord)}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getVoiceNoteScript(selectedRecord));
                      showToast('success', 'Script voice note disalin.');
                    }}
                  >
                    Salin Script
                  </Button>
                </div>
              )}

              {activeAmunisiTab === 'invoice' && (
                <div className="flex flex-col gap-2">
                  <div className="p-3 bg-[#F7F6F2] rounded-[8px] border border-[#DAD7CC] text-[12px] text-[#1B1B18] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {getInvoiceText(selectedRecord, selectedTier)}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getInvoiceText(selectedRecord, selectedTier));
                      showToast('success', 'Rincian invoice disalin.');
                    }}
                  >
                    Salin Invoice
                  </Button>
                </div>
              )}
            </div>

            {/* Pesan Terkirim Sebelumnya */}
            {selectedRecord.messageSent && (
              <div className="flex flex-col gap-1.5 pt-3 border-t border-[#F0EEE7]">
                <span className="text-[13px] text-[#6B6A63] font-medium">Pesan Terkirim</span>
                <div className="p-3 bg-[#F7F6F2] rounded-[8px] border border-[#DAD7CC] text-[12px] text-[#6B6A63] leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {selectedRecord.messageSent}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
