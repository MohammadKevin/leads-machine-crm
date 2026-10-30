'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  OutreachLead,
  BatchLogEntry,
} from '@/types/outreach';
import { getDynamicFallbackPitch } from '@/lib/gemini-pitch';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { StatBar } from '@/components/ui/StatBar';

interface Props {
  blacklist: Set<string>;
  todayChatsCount?: number;
  onContactSentSuccess: (phone: string, lead: OutreachLead) => void;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
  onSyncSuccess?: () => void;
  onOpenPrototype?: (lead: OutreachLead) => void;
  onViewHistoryToday?: () => void;
}

const QUEUE_KEY = 'leads_queue_v5';

const HIGH_TICKET_NICHES = [
  {
    id: 'villa',
    label: 'Villa & Glamping',
    fullName: 'Kos-kosan Eksklusif, Homestay & Villa',
    query: 'Villa Guesthouse Glamping Homestay Penginapan',
    dealRange: 'Rp 2,5jt–3,5jt',
    cities: 'Batu, Malang, Prigen',
  },
  {
    id: 'interior',
    label: 'Kontraktor & Interior',
    fullName: 'Kontraktor, Arsitek & Interior',
    query: 'Kontraktor Bangunan Arsitek Desain Interior Konstruksi',
    dealRange: 'Rp 2,5jt–4jt',
    cities: 'Malang, Surabaya, Sidoarjo',
  },
  {
    id: 'clinic',
    label: 'Klinik Gigi',
    fullName: 'Klinik & Apotek',
    query: 'Klinik Gigi Dokter Gigi Klinik Kecantikan Estetika',
    dealRange: 'Rp 2jt–3jt',
    cities: 'Malang, Surabaya',
  },
];

const CITY_PRESETS = [
  {
    id: 'malang_batu',
    label: 'Malang & Batu',
    cities: ['Malang', 'Batu', 'Kabupaten Malang'],
  },
  {
    id: 'surabaya',
    label: 'Surabaya',
    cities: ['Surabaya', 'Sidoarjo', 'Gresik'],
  },
  {
    id: 'koridor_jatim',
    label: 'Koridor Jatim',
    cities: ['Malang', 'Batu', 'Surabaya', 'Sidoarjo', 'Kediri'],
  },
];

function humanizeErrorReason(errorMsg?: string): string {
  if (!errorMsg) return 'Gagal kirim';
  const low = errorMsg.toLowerCase();
  if (low.includes('disconnected device') || low.includes('device disconnected')) {
    return 'WA terputus';
  }
  if (low.includes('invalid') || low.includes('tidak valid')) {
    return 'Nomor tidak valid';
  }
  if (low.includes('timeout')) {
    return 'Koneksi timeout';
  }
  return errorMsg.slice(0, 20);
}

const INITIAL_SEED_LEADS: OutreachLead[] = [
  {
    id: 'seed-1',
    businessName: 'Apotek Sayang Ibu',
    category: 'Apotek & Praktik Dokter',
    city: 'Kediri',
    phone: '081334455891',
    rawPhone: '081334455891',
    address: 'Jl. Dhoho No. 45, Kediri',
    rating: 5.0,
    reviewsCount: 2,
    hasWebsite: false,
    website: null,
    status: 'failed',
    error: 'request invalid on disconnected device',
  },
  {
    id: 'seed-2',
    businessName: 'Klinik Lavida Kediri',
    category: 'Klinik Kecantikan & Estetika',
    city: 'Kediri',
    phone: '081252859295',
    rawPhone: '081252859295',
    address: 'Jl. Hayam Wuruk No. 12, Kediri',
    rating: 4.7,
    reviewsCount: 139,
    hasWebsite: false,
    website: null,
    status: 'sending',
  },
  {
    id: 'seed-3',
    businessName: 'Klinik Pratama Medika Keluarga',
    category: 'Klinik Pratama & Umum',
    city: 'Kediri',
    phone: '081336915939',
    rawPhone: '081336915939',
    address: 'Jl. Panglima Polim No. 8, Kediri',
    rating: 4.7,
    reviewsCount: 339,
    hasWebsite: false,
    website: null,
    status: 'ready',
  },
];

export default function OutreachMachine({
  blacklist,
  todayChatsCount = 0,
  onContactSentSuccess,
  showToast,
  onSyncSuccess,
  onOpenPrototype,
}: Props) {
  const [activeNicheId, setActiveNicheId] = useState<string>('villa');
  const [activeCityPresetId, setActiveCityPresetId] = useState<string>('malang_batu');
  const [selectedCities, setSelectedCities] = useState<string[]>(CITY_PRESETS[0].cities);
  const [targetMode, setTargetMode] = useState<'admin_gatekeeper' | 'owner_direct'>('admin_gatekeeper');

  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [leads, setLeads] = useState<OutreachLead[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(QUEUE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return INITIAL_SEED_LEADS;
  });

  const [tableFilter, setTableFilter] = useState<'ALL' | 'READY' | 'SULTAN'>('ALL');
  const [activeMenuLeadId, setActiveMenuLeadId] = useState<string | null>(null);

  // Modal chat / pitch
  const [previewPitchLead, setPreviewPitchLead] = useState<OutreachLead | null>(null);
  const [previewPitchText, setPreviewPitchText] = useState<string>('');
  const [isGeneratingPitchId, setIsGeneratingPitchId] = useState<string | null>(null);

  // Auto-send execution state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const leadsRef = useRef<OutreachLead[]>(leads);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const saveQueue = useCallback((next: OutreachLead[]) => {
    const clean = Array.isArray(next)
      ? next.filter((item): item is OutreachLead => Boolean(item && typeof item === 'object' && item.id))
      : [];
    setLeads(clean);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(clean));
    } catch {}
  }, []);

  const handleNicheSelect = (id: string) => {
    setActiveNicheId(id);
  };

  const handleCityPresetSelect = (preset: typeof CITY_PRESETS[0]) => {
    setActiveCityPresetId(preset.id);
    setSelectedCities(preset.cities);
  };

  const handleSearch = async () => {
    if (isSearching) return;

    const currentNiche = HIGH_TICKET_NICHES.find((n) => n.id === activeNicheId) || HIGH_TICKET_NICHES[0];
    const categories = [currentNiche.fullName];

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSearching(true);
    setSearchProgress('Memulai…');

    const totalCities = selectedCities.length;
    let processedIndex = 0;
    let collectedLeads: OutreachLead[] = [...leadsRef.current];
    let newlyFoundCount = 0;

    try {
      for (const city of selectedCities) {
        if (controller.signal.aborted) break;
        processedIndex++;
        setSearchProgress(`${city} (${processedIndex}/${totalCities})`);

        try {
          const res = await fetch('/api/discovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              cities: [city],
              categories,
              category: categories[0],
              customQuery: '',
              onlyWithoutWebsite: true,
              excludeFranchise: true,
              onlyValidWhatsApp: true,
              strictA1: true,
              blacklist: [
                ...Array.from(blacklist),
                ...collectedLeads.map((l) => l.phone).filter(Boolean),
              ],
            }),
          });

          if (controller.signal.aborted) break;
          const data = await res.json().catch(() => null);

          if (!res.ok || !data?.success || !Array.isArray(data.leads)) continue;

          const fetched: OutreachLead[] = data.leads;
          if (fetched.length > 0) {
            const existingPhones = new Set(collectedLeads.map((l) => l.phone).filter(Boolean));
            const newItems = fetched.filter((l) => l.phone && !existingPhones.has(l.phone));
            if (newItems.length > 0) {
              newlyFoundCount += newItems.length;
              collectedLeads = [...collectedLeads, ...newItems].slice(0, 150);
              saveQueue(collectedLeads);
            }
          }
        } catch {
          if (controller.signal.aborted) break;
        }
      }

      if (controller.signal.aborted) return;

      if (newlyFoundCount === 0) {
        showToast('warn', 'Tidak ada lead baru — semua nomor sudah ada atau tidak lolos kualifikasi A1.');
      } else {
        showToast('success', `${newlyFoundCount} prospek Tier A1 berhasil ditambahkan ke antrean.`);
      }
    } catch {
      showToast('error', 'Gagal mencari prospek.');
    } finally {
      setIsSearching(false);
      setSearchProgress('');
      abortControllerRef.current = null;
    }
  };

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSearching(false);
      setSearchProgress('');
      showToast('warn', 'Pencarian dibatalkan.');
    }
  };

  // Dispatch a single lead
  const handleSendSingleLead = async (item: OutreachLead) => {
    setIsGeneratingPitchId(item.id);

    // 1. Generate or retrieve pitch message
    let finalMessage = item.pitchMessage;
    if (!finalMessage) {
      try {
        const gr = await fetch('/api/outreach/generate-pitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead: item, targetMode }),
        });
        const gd = await gr.json();
        if (gr.ok && gd.success && gd.message) {
          finalMessage = gd.message;
        }
      } catch {}
    }

    if (!finalMessage) {
      finalMessage = getDynamicFallbackPitch({
        businessName: item.businessName,
        category: item.category,
        city: item.city,
        address: item.address,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        targetMode,
      });
    }

    // Set sending status
    const currentList = [...leadsRef.current];
    const itemIndex = currentList.findIndex((l) => l.id === item.id);
    if (itemIndex !== -1) {
      currentList[itemIndex] = { ...item, status: 'sending', pitchMessage: finalMessage };
      saveQueue(currentList);
    }

    try {
      const res = await fetch('/api/outreach/send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: item, message: finalMessage }),
      });
      const data = await res.json().catch(() => ({}));

      const nextList = [...leadsRef.current];
      const nextIndex = nextList.findIndex((l) => l.id === item.id);

      if (res.ok && data?.success) {
        const done: OutreachLead = {
          ...item,
          status: 'sent',
          sentAt: new Date().toISOString(),
          pitchMessage: finalMessage,
          error: undefined,
        };
        if (nextIndex !== -1) {
          nextList[nextIndex] = done;
          saveQueue(nextList);
        }
        onContactSentSuccess(item.phone, done);
        showToast('success', `Pesan terkirim ke ${item.businessName}!`);
      } else {
        const errMsg = data?.error || 'Gagal pengiriman WhatsApp Fonnte.';
        if (nextIndex !== -1) {
          nextList[nextIndex] = { ...item, status: 'failed', error: errMsg };
          saveQueue(nextList);
        }
        showToast('error', `Gagal kirim ke ${item.businessName}: ${humanizeErrorReason(errMsg)}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Kesalahan jaringan';
      const nextList = [...leadsRef.current];
      const nextIndex = nextList.findIndex((l) => l.id === item.id);
      if (nextIndex !== -1) {
        nextList[nextIndex] = { ...item, status: 'failed', error: errMsg };
        saveQueue(nextList);
      }
      showToast('error', `Gagal kirim: ${errMsg}`);
    } finally {
      setIsGeneratingPitchId(null);
    }
  };

  // Auto-send batch loop
  const runBatch = async () => {
    if (runningRef.current) return;
    const queue = leadsRef.current.filter((l) => Boolean(l && l.phone));
    const pendingIndices = queue
      .map((l, i) => (l.status === 'ready' || l.status === 'in_queue' || l.status === 'failed' ? i : -1))
      .filter((i) => i !== -1);

    if (pendingIndices.length === 0) {
      showToast('warn', 'Tidak ada prospek yang siap dikirim.');
      return;
    }

    runningRef.current = true;
    pausedRef.current = false;
    abortRef.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setIsCooldown(false);
    showToast('success', `Memulai pengiriman untuk ${pendingIndices.length} prospek.`);

    for (let p = 0; p < pendingIndices.length; p++) {
      if (abortRef.current) break;
      while (pausedRef.current && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 300));
      }
      if (abortRef.current) break;

      const idx = pendingIndices[p];
      const lead = leadsRef.current[idx];
      if (!lead) continue;

      await handleSendSingleLead(lead);

      const isLast = p === pendingIndices.length - 1;
      if (!isLast && !abortRef.current) {
        // Safe dispatch delay
        for (let s = 15; s > 0; s--) {
          if (abortRef.current) break;
          setCountdown(s);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setCountdown(0);
      }
    }

    runningRef.current = false;
    setIsRunning(false);
    setCountdown(0);
  };

  const handleStopAutoSend = () => {
    abortRef.current = true;
    runningRef.current = false;
    setIsRunning(false);
    showToast('warn', 'Auto-send dihentikan.');
  };

  // Open Chat / Pitch Preview Modal
  const handleOpenPitchModal = (lead: OutreachLead) => {
    const pitch = lead.pitchMessage || getDynamicFallbackPitch({
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      address: lead.address,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      targetMode,
    });
    setPreviewPitchLead(lead);
    setPreviewPitchText(pitch);
  };

  const handleSaveAndSendPitch = () => {
    if (!previewPitchLead) return;
    const updated: OutreachLead = {
      ...previewPitchLead,
      pitchMessage: previewPitchText,
    };
    const nextList = leadsRef.current.map((l) => (l.id === updated.id ? updated : l));
    saveQueue(nextList);
    setPreviewPitchLead(null);
    handleSendSingleLead(updated);
  };

  // Export CSV
  const handleExportCsv = () => {
    if (leads.length === 0) return;
    const headers = ['Nama Bisnis', 'Kategori', 'Kota', 'WhatsApp', 'Rating', 'Ulasan', 'Status', 'Alamat'];
    const rows = leads.map((l) => [
      `"${(l.businessName || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      l.rating || '',
      l.reviewsCount || '',
      l.status || '',
      `"${(l.address || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-radar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'File CSV berhasil diunduh.');
  };

  // Counts
  const validLeads = leads.filter((l) => Boolean(l && l.phone));
  const antreCount = validLeads.filter((l) => l.status === 'ready' || l.status === 'in_queue' || l.status === 'pending').length;
  const sentCount = validLeads.filter((l) => l.status === 'sent').length;
  const duplikatCount = validLeads.filter((l) => l.status === 'skipped').length;
  const sultanCount = validLeads.filter((l) => (l.reviewsCount || 0) >= 25).length;

  const filteredLeads = validLeads.filter((l) => {
    if (tableFilter === 'READY') {
      return l.status === 'ready' || l.status === 'in_queue' || l.status === 'pending';
    }
    if (tableFilter === 'SULTAN') {
      return (l.reviewsCount || 0) >= 25;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full gap-5 pb-8">
      {/* 1. Panel Atas (Single Card) */}
      <Card className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Niche Chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[#6B6A63] font-normal">Niche</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {HIGH_TICKET_NICHES.map((n) => (
                <Chip
                  key={n.id}
                  active={activeNicheId === n.id}
                  onClick={() => handleNicheSelect(n.id)}
                >
                  {n.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Wilayah Chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[#6B6A63] font-normal">Wilayah</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CITY_PRESETS.map((p) => (
                <Chip
                  key={p.id}
                  active={activeCityPresetId === p.id}
                  onClick={() => handleCityPresetSelect(p)}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Gaya Pesan */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[#6B6A63] font-normal">Gaya pesan</span>
            <div className="relative">
              <select
                value={targetMode}
                onChange={(e) => setTargetMode(e.target.value as any)}
                className="h-8 px-3 pr-8 rounded-full bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] font-medium appearance-none cursor-pointer focus:outline-2 focus:outline-[#0B7A55]"
              >
                <option value="admin_gatekeeper">Lewat admin</option>
                <option value="owner_direct">Langsung ke owner</option>
              </select>
              <span className="material-symbols-outlined text-[16px] text-[#6B6A63] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Action Button: Tarik prospek A1 */}
        <div className="self-end lg:self-auto shrink-0">
          {!isSearching ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSearch}
            >
              Tarik prospek A1
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="primary" size="md" disabled>
                <span>Menyelidiki {searchProgress}…</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleCancelSearch}
              >
                Batal
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 2. Stat Bar Tipis */}
      <StatBar
        stats={[
          { label: 'Chat hari ini', value: todayChatsCount, target: 50 },
          { label: 'Antre', value: antreCount },
          { label: 'Terkirim', value: sentCount },
          { label: 'Duplikat', value: duplikatCount },
        ]}
        statusText={
          countdown > 0
            ? `Jeda ${countdown} detik…`
            : isRunning
            ? 'Sedang mengirim pesan…'
            : 'Jeda 20 pesan · siap dikirim'
        }
        isAutoSending={isRunning}
        onToggleAutoSend={isRunning ? handleStopAutoSend : runBatch}
        onExportCsv={handleExportCsv}
        canAutoSend={antreCount > 0}
      />

      {/* 3. Tabel Hasil Radar */}
      <Card className="flex flex-col overflow-hidden">
        {/* Table Header with Filter Chips */}
        <div className="px-5 py-4 border-b border-[#F0EEE7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-[#1B1B18]">
              Hasil radar
            </h3>
            <span className="text-[13px] text-[#6B6A63]">
              {filteredLeads.length} terverifikasi A1
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Chip
              active={tableFilter === 'ALL'}
              count={validLeads.length}
              onClick={() => setTableFilter('ALL')}
            >
              Semua
            </Chip>
            <Chip
              active={tableFilter === 'READY'}
              count={antreCount}
              onClick={() => setTableFilter('READY')}
            >
              Antre
            </Chip>
            <Chip
              active={tableFilter === 'SULTAN'}
              count={sultanCount}
              onClick={() => setTableFilter('SULTAN')}
            >
              Sultan
            </Chip>
          </div>
        </div>

        {/* Table Rows */}
        <div className="overflow-x-auto">
          {filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-[#6B6A63] text-[13px]">
              Belum ada data prospek. Klik &ldquo;Tarik prospek A1&rdquo; untuk memulai pencarian Google Maps.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0EEE7] text-[12px] font-normal text-[#6B6A63]">
                  <th className="py-3 px-5 font-normal">Nama bisnis</th>
                  <th className="py-3 px-5 font-normal">Kota</th>
                  <th className="py-3 px-5 font-normal">Rating</th>
                  <th className="py-3 px-5 font-normal">Status</th>
                  <th className="py-3 px-5 font-normal text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE7] text-[13px]">
                {filteredLeads.map((item) => {
                  const isSultan = (item.reviewsCount || 0) >= 25;
                  const estimatedValue = isSultan ? 'Est. Rp 3.500.000' : 'Est. Rp 2.500.000';
                  const isMenuOpen = activeMenuLeadId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F7F6F2]/50 transition-colors"
                    >
                      {/* Nama Bisnis */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#1B1B18] text-[14px]">
                            {item.businessName}
                          </span>
                          {isSultan && (
                            <Badge variant="sultan">Sultan</Badge>
                          )}
                        </div>
                        <div className="text-[12px] text-[#6B6A63] mt-0.5">
                          {estimatedValue}
                        </div>
                      </td>

                      {/* Kota */}
                      <td className="py-3.5 px-5 text-[#1B1B18]">{item.city}</td>

                      {/* Rating */}
                      <td className="py-3.5 px-5 text-[#1B1B18]">
                        {item.rating > 0 ? (
                          <span>
                            {item.rating % 1 === 0
                              ? `${item.rating},0`
                              : item.rating.toString().replace('.', ',')}{' '}
                            · {item.reviewsCount} ulasan
                          </span>
                        ) : (
                          <span className="text-[#6B6A63]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col items-start gap-0.5">
                          {item.status === 'failed' ? (
                            <>
                              <Badge variant="gagal">Gagal</Badge>
                              <span className="text-[11px] text-[#B3261E]">
                                {humanizeErrorReason(item.error)}
                              </span>
                            </>
                          ) : item.status === 'sending' ? (
                            <Badge variant="mengirim">Mengirim…</Badge>
                          ) : item.status === 'sent' ? (
                            <Badge variant="antre">Terkirim</Badge>
                          ) : (
                            <Badge variant="antre">Antre</Badge>
                          )}
                        </div>
                      </td>

                      {/* Aksi (Tiap baris hanya SATU aksi utama + ···) */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2 justify-end relative">
                          {/* Satu Aksi Utama */}
                          {item.status === 'failed' ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={isGeneratingPitchId === item.id}
                              onClick={() => handleSendSingleLead(item)}
                            >
                              {isGeneratingPitchId === item.id ? 'Mengirim…' : 'Coba lagi'}
                            </Button>
                          ) : item.status === 'sending' || item.status === 'sent' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenPitchModal(item)}
                            >
                              Lihat chat
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={isGeneratingPitchId === item.id}
                              onClick={() => handleSendSingleLead(item)}
                            >
                              {isGeneratingPitchId === item.id ? 'Mengirim…' : 'Kirim pesan'}
                            </Button>
                          )}

                          {/* Tombol Sekunder "···" */}
                          <div className="relative">
                            <button
                              type="button"
                              aria-label="Aksi sekunder"
                              onClick={() => setActiveMenuLeadId(isMenuOpen ? null : item.id)}
                              className="w-8 h-8 rounded-[8px] border border-[#DAD7CC] hover:bg-[#F7F6F2] flex items-center justify-center text-[#1B1B18] transition cursor-pointer"
                            >
                              <span className="leading-none text-[16px] font-bold">···</span>
                            </button>

                            {/* Menu Dropdown Sekunder */}
                            {isMenuOpen && (
                              <div
                                className="absolute right-0 top-full mt-1 w-44 bg-white rounded-[8px] ring-1 ring-[#ECEAE2] shadow-lg py-1 z-40 text-left text-[13px]"
                                onMouseLeave={() => setActiveMenuLeadId(null)}
                              >
                                {onOpenPrototype && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuLeadId(null);
                                      onOpenPrototype(item);
                                    }}
                                    className="w-full px-3 py-2 hover:bg-[#F7F6F2] text-[#1B1B18] flex items-center gap-2 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-[#6B6A63]">
                                      terminal
                                    </span>
                                    <span>Buka Prototype</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuLeadId(null);
                                    const clean = item.phone.replace(/\D/g, '');
                                    window.open(`https://wa.me/${clean}`, '_blank');
                                  }}
                                  className="w-full px-3 py-2 hover:bg-[#F7F6F2] text-[#1B1B18] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#0B7A55]">
                                    chat
                                  </span>
                                  <span>Buka WhatsApp</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuLeadId(null);
                                    navigator.clipboard.writeText(item.phone);
                                    showToast('success', `Nomor ${item.phone} disalin.`);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-[#F7F6F2] text-[#1B1B18] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#6B6A63]">
                                    content_copy
                                  </span>
                                  <span>Salin nomor</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuLeadId(null);
                                    handleOpenPitchModal(item);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-[#F7F6F2] text-[#1B1B18] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#6B6A63]">
                                    edit
                                  </span>
                                  <span>Edit pesan</span>
                                </button>

                                <div className="h-px bg-[#F0EEE7] my-1" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuLeadId(null);
                                    const remaining = leads.filter((l) => l.id !== item.id);
                                    saveQueue(remaining);
                                    showToast('warn', `${item.businessName} dihapus dari antrean.`);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-[#FCE4E1] text-[#B3261E] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-[#B3261E]">
                                    delete
                                  </span>
                                  <span>Hapus antrean</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal Edit / Pratinjau Pesan Outreach */}
      {previewPitchLead && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-lg p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1B18]">
                  Pesan Outreach: {previewPitchLead.businessName}
                </h3>
                <p className="text-[13px] text-[#6B6A63] mt-0.5">
                  Target: {targetMode === 'admin_gatekeeper' ? 'Lewat Admin' : 'Langsung ke Owner'} · {previewPitchLead.city}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPitchLead(null)}
                aria-label="Tutup modal"
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <textarea
              rows={8}
              value={previewPitchText}
              onChange={(e) => setPreviewPitchText(e.target.value)}
              className="w-full p-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] leading-relaxed focus:outline-2 focus:outline-[#0B7A55] resize-none"
            />

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F0EEE7]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(previewPitchText);
                  showToast('success', 'Pesan disalin ke clipboard.');
                }}
              >
                Salin teks
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPreviewPitchLead(null)}
                >
                  Tutup
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSaveAndSendPitch}
                >
                  Simpan &amp; Kirim WA
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
