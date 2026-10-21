'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  OutreachLead,
  BatchLogEntry,
  NICHE_CATEGORIES,
} from '@/types/outreach';
import { getDynamicFallbackPitch } from '@/lib/gemini-pitch';

interface Props {
  blacklist: Set<string>;
  onContactSentSuccess: (phone: string, lead: OutreachLead) => void;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
  onSyncSuccess?: () => void;
  onOpenPrototype?: (lead: OutreachLead) => void;
}

const QUEUE_KEY = 'leads_queue_v5';
const LOG_KEY = 'leads_logs_v5';

const HIGH_TICKET_NICHES = [
  {
    id: 'villa',
    label: 'Villa & Glamping',
    fullName: 'Kos-kosan Eksklusif, Homestay & Villa',
    query: 'Villa Guesthouse Glamping Homestay Penginapan',
    dealRange: 'Rp 2,5jt–3,5jt',
    cities: 'Batu, Malang, Prigen',
    icon: 'villa',
  },
  {
    id: 'interior',
    label: 'Kontraktor & Interior',
    fullName: 'Kontraktor, Arsitek & Interior',
    query: 'Kontraktor Bangunan Arsitek Desain Interior Konstruksi',
    dealRange: 'Rp 2,5jt–4jt',
    cities: 'Malang, Surabaya, Sidoarjo',
    icon: 'construction',
  },
  {
    id: 'clinic',
    label: 'Klinik Gigi & Estetika',
    fullName: 'Klinik & Apotek',
    query: 'Klinik Gigi Dokter Gigi Klinik Kecantikan Estetika',
    dealRange: 'Rp 2jt–3jt',
    cities: 'Malang, Surabaya',
    icon: 'dentistry',
  },
];

const CITY_PRESETS = [
  {
    id: 'malang_batu',
    label: 'Malang Raya & Batu',
    cities: ['Malang', 'Batu', 'Kabupaten Malang'],
  },
  {
    id: 'surabaya_sidoarjo',
    label: 'Surabaya & Sidoarjo',
    cities: ['Surabaya', 'Sidoarjo', 'Gresik'],
  },
  {
    id: 'koridor_jatim',
    label: 'Koridor Jatim',
    cities: ['Malang', 'Batu', 'Surabaya', 'Sidoarjo', 'Kediri'],
  },
];

function randomJitterSeconds(min = 25, max = 45) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCooldownSeconds(min = 180, max = 300) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function OutreachMachine({
  blacklist,
  onContactSentSuccess,
  showToast,
  onSyncSuccess,
  onOpenPrototype,
}: Props) {
  const [activeNicheId, setActiveNicheId] = useState<string>('villa');
  const [selectedCities, setSelectedCities] = useState<string[]>(CITY_PRESETS[0].cities);
  const [activeCityPresetId, setActiveCityPresetId] = useState<string>('malang_batu');
  const [targetMode, setTargetMode] = useState<'admin_gatekeeper' | 'owner_direct'>('admin_gatekeeper');

  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [logs, setLogs] = useState<BatchLogEntry[]>([]);
  const [tableFilter, setTableFilter] = useState<'ALL' | 'READY' | 'SENT' | 'REPLIED' | 'HIGH_REVIEWS'>('ALL');
  const [copiedPitchId, setCopiedPitchId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState<string>('Kirim berikutnya');
  const [activeLead, setActiveLead] = useState<OutreachLead | null>(null);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const leadsRef = useRef<OutreachLead[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    try {
      const q = localStorage.getItem(QUEUE_KEY);
      if (q) {
        const p = JSON.parse(q);
        if (Array.isArray(p) && p.length > 0) setLeads(p);
      }
      const l = localStorage.getItem(LOG_KEY);
      if (l) {
        const p = JSON.parse(l);
        if (Array.isArray(p)) setLogs(p);
      }
    } catch {}
  }, []);

  const saveQueue = useCallback((next: OutreachLead[]) => {
    setLeads(next);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const addLog = useCallback(
    (type: BatchLogEntry['type'], message: string, phone?: string, businessName?: string) => {
      const entry: BatchLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        type,
        message,
        phone,
        businessName,
      };
      setLogs((prev) => {
        const next = [entry, ...prev].slice(0, 300);
        try {
          localStorage.setItem(LOG_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const handleNicheSelect = (id: string) => {
    setActiveNicheId(id);
  };

  const handleCityPresetSelect = (preset: typeof CITY_PRESETS[0]) => {
    setActiveCityPresetId(preset.id);
    setSelectedCities(preset.cities);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
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
    let totalSkipped = 0;

    addLog('info', `[RADAR] Memulai pencarian ${currentNiche.label} di ${selectedCities.join(', ')}…`);

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
                ...collectedLeads.map((l) => l.phone),
              ],
            }),
          });

          if (controller.signal.aborted) break;

          const rawText = await res.text().catch(() => '');
          let data: {
            success?: boolean;
            leads?: OutreachLead[];
            skippedLogs?: Array<{ phone: string; businessName: string; reason: string }>;
            error?: string;
          } | null = null;
          try {
            data = JSON.parse(rawText);
          } catch {
            data = null;
          }

          if (!res.ok || !data?.success) {
            continue;
          }

          const fetched: OutreachLead[] = Array.isArray(data.leads) ? data.leads : [];
          const skipped: Array<{ phone: string; businessName: string; reason: string }> =
            Array.isArray(data.skippedLogs) ? data.skippedLogs : [];
          totalSkipped += skipped.length;

          fetched.forEach((lead) => {
            addLog(
              'info',
              `[RADAR] Menemukan ${lead.businessName} (${lead.city}) — Lolos A1`,
              lead.phone,
              lead.businessName
            );
          });

          if (fetched.length > 0) {
            const existingPhones = new Set(collectedLeads.map((l) => l.phone));
            const newItems = fetched.filter((l) => !existingPhones.has(l.phone));
            if (newItems.length > 0) {
              newlyFoundCount += newItems.length;
              collectedLeads = [...collectedLeads, ...newItems].slice(0, 150);
              saveQueue(collectedLeads);
            }
          }
        } catch (cityErr: unknown) {
          const isAbort =
            controller.signal.aborted ||
            (cityErr instanceof DOMException && cityErr.name === 'AbortError') ||
            (cityErr as { name?: string })?.name === 'AbortError';
          if (isAbort) break;
        }
      }

      if (controller.signal.aborted) return;

      if (newlyFoundCount === 0) {
        showToast(
          'warn',
          'Tidak ada lead baru — semua nomor sudah ada di Sheets atau tidak lolos kualifikasi A1.'
        );
      } else {
        showToast('success', `${newlyFoundCount} prospek Tier A1 berhasil ditambahkan ke antrean.`);
      }
    } catch (err: unknown) {
      const isAbort =
        controller.signal.aborted ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err as { name?: string })?.name === 'AbortError';
      if (isAbort) return;
      showToast('error', 'Gagal menghubungi server Serper.');
    } finally {
      setIsSearching(false);
      setSearchProgress('');
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSearching(false);
      setSearchProgress('');
      showToast('warn', 'Pencarian prospek dibatalkan.');
    }
  };

  const waitWhilePaused = async () => {
    while (pausedRef.current && !abortRef.current) {
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const runBatch = async () => {
    if (runningRef.current) return;
    const queue = leadsRef.current;
    const pending = queue
      .map((l, i) =>
        l.status === 'ready' || l.status === 'failed' || l.status === 'in_queue' ? i : -1
      )
      .filter((i) => i !== -1);

    if (pending.length === 0) {
      showToast('warn', 'Tidak ada prospek dalam antrean siap kirim.');
      return;
    }

    runningRef.current = true;
    pausedRef.current = false;
    abortRef.current = false;
    setIsRunning(true);
    setIsPaused(false);
    setIsCooldown(false);
    showToast('success', `Memulai safe dispatch untuk ${pending.length} prospek.`);
    addLog('info', `[START] Batch safe outreach dimulai untuk ${pending.length} prospek.`);

    let sentInCurrentChunk = 0;

    for (let p = 0; p < pending.length; p++) {
      if (abortRef.current) break;
      await waitWhilePaused();
      if (abortRef.current) break;

      const idx = pending[p];
      const lead = leadsRef.current[idx];
      if (!lead) continue;
      setActiveLead(lead);

      if (blacklist.has(lead.phone)) {
        addLog('skip', `[DUPLICAT] ${lead.phone} sudah ada di Sheets → SKIPPED`, lead.phone, lead.businessName);
        const u = [...leadsRef.current];
        u[idx] = { ...lead, status: 'skipped', error: 'Sudah ada di Google Sheets' };
        saveQueue(u);
        continue;
      }

      const qG = [...leadsRef.current];
      qG[idx] = { ...lead, status: 'generating' };
      saveQueue(qG);

      let finalMessage = lead.pitchMessage;
      if (!finalMessage) {
        try {
          const gr = await fetch('/api/outreach/generate-pitch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead, targetMode }),
          });
          const gd = await gr.json();
          if (gr.ok && gd.success && gd.message) {
            finalMessage = gd.message;
            if (typeof window !== 'undefined' && gd.tokensUsed) {
              window.dispatchEvent(new CustomEvent('gk-token-deducted', { detail: { tokens: gd.tokensUsed } }));
            }
          }
        } catch {}
      }

      if (!finalMessage) {
        finalMessage = getDynamicFallbackPitch({
          businessName: lead.businessName,
          category: lead.category,
          city: lead.city,
          address: lead.address,
          rating: lead.rating,
          reviewsCount: lead.reviewsCount,
          targetMode,
        });
      }

      const qS = [...leadsRef.current];
      qS[idx] = { ...lead, status: 'sending', pitchMessage: finalMessage };
      saveQueue(qS);

      await waitWhilePaused();
      if (abortRef.current) break;

      try {
        const sr = await fetch('/api/outreach/send-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead, message: finalMessage }),
        });
        const sd = await sr.json();

        if (sr.ok && sd.success) {
          const done: OutreachLead = {
            ...lead,
            status: 'sent',
            sentAt: new Date().toISOString(),
            pitchMessage: finalMessage,
          };
          const qDone = [...leadsRef.current];
          qDone[idx] = done;
          saveQueue(qDone);
          onContactSentSuccess(lead.phone, done);
          sentInCurrentChunk++;

          addLog('success', `[SUKSES] Pesan terkirim ke ${lead.businessName} (${lead.phone})`, lead.phone);
        } else {
          const errMsg = sd.error || 'Gagal pengiriman WhatsApp Fonnte.';
          const qF = [...leadsRef.current];
          qF[idx] = { ...lead, status: 'failed', error: errMsg };
          saveQueue(qF);
          addLog('error', `[GAGAL] ${lead.businessName}: ${errMsg}`, lead.phone);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Kesalahan jaringan';
        const qF = [...leadsRef.current];
        qF[idx] = { ...lead, status: 'failed', error: errMsg };
        saveQueue(qF);
        addLog('error', `[ERROR] ${lead.phone}: ${errMsg}`, lead.phone);
      }

      const isLast = p === pending.length - 1;
      if (!isLast && !abortRef.current) {
        if (sentInCurrentChunk >= 20) {
          sentInCurrentChunk = 0;
          const cooldownSec = randomCooldownSeconds(180, 300);
          setIsCooldown(true);
          setCountdownLabel('Jeda 20 pesan');

          for (let s = cooldownSec; s > 0; s--) {
            if (abortRef.current) break;
            await waitWhilePaused();
            if (abortRef.current) break;
            setCountdown(s);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setIsCooldown(false);
          setCountdown(0);
        } else {
          const jitter = randomJitterSeconds(25, 45);
          setCountdownLabel('Kirim berikutnya');
          for (let s = jitter; s > 0; s--) {
            if (abortRef.current) break;
            await waitWhilePaused();
            if (abortRef.current) break;
            setCountdown(s);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setCountdown(0);
        }
      }
    }

    runningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setIsCooldown(false);
    setActiveLead(null);
    setCountdown(0);
    showToast('success', 'Batch safe dispatch selesai!');
    if (onSyncSuccess) onSyncSuccess();
  };

  const handlePause = () => {
    pausedRef.current = true;
    setIsPaused(true);
    addLog('warn', '[PAUSE] Batch dijeda.');
  };

  const handleResume = () => {
    pausedRef.current = false;
    setIsPaused(false);
    addLog('info', '[RESUME] Batch dilanjutkan.');
  };

  const handleStop = () => {
    abortRef.current = true;
    pausedRef.current = false;
    runningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setIsCooldown(false);
    setActiveLead(null);
    setCountdown(0);
    showToast('warn', 'Batch berhasil dihentikan.');
  };

  const handleReset = () => {
    if (isRunning) return;
    saveQueue([]);
    setLogs([]);
    try {
      localStorage.removeItem(QUEUE_KEY);
      localStorage.removeItem(LOG_KEY);
    } catch {}
    showToast('success', 'Antrean prospek berhasil di-reset.');
  };

  const handleExportCsv = () => {
    if (leads.length === 0) return;
    const header = 'Nama Bisnis,WhatsApp,Kota,Kategori,Rating,Ulasan,Status\n';
    const rows = leads
      .map(
        (l) =>
          `"${(l.businessName || '').replace(/"/g, '""')}","${l.phone}","${l.city || ''}","${l.category || ''}",${l.rating || 0},${l.reviewsCount || 0},"${l.status}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_${activeNicheId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `${leads.length} data prospek berhasil diekspor ke CSV.`);
  };

  const handleManualWhatsApp = async (item: OutreachLead) => {
    const rawClean = item.phone.replace(/\D/g, '');
    let normalized = rawClean;
    if (normalized.startsWith('0')) normalized = '62' + normalized.slice(1);
    else if (normalized.startsWith('8')) normalized = '62' + normalized;

    let pitch = item.pitchMessage;
    if (!pitch) {
      pitch = getDynamicFallbackPitch({
        businessName: item.businessName,
        category: item.category,
        city: item.city,
        address: item.address,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        targetMode,
      });
    }

    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(pitch)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    const updatedLead: OutreachLead = { ...item, status: 'sent', pitchMessage: pitch };
    const nextLeads = leadsRef.current.map((l) => (l.id === item.id ? updatedLead : l));
    saveQueue(nextLeads);
    onContactSentSuccess(normalized, updatedLead);

    try {
      await fetch('/api/sheets/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalized,
          status: 'CONTACTED',
          businessName: item.businessName,
        }),
      });
      showToast('success', `WA ${item.businessName} dibuka & otomatis dicatat ke Sheets!`);
    } catch {
      showToast('warn', 'WA dibuka, namun gagal mencatat ke Google Sheets.');
    }

    if (onSyncSuccess) onSyncSuccess();
  };

  const totalLeads = leads.length;
  const sentCount = leads.filter((l) => l.status === 'sent').length;
  const failedCount = leads.filter((l) => l.status === 'failed').length;
  const skipCount = leads.filter((l) => l.status === 'skipped').length;
  const readyCount = leads.filter(
    (l) => l.status === 'ready' || l.status === 'in_queue' || l.status === 'pending'
  ).length;
  const processedCount = sentCount + failedCount + skipCount;
  const progressPct = totalLeads > 0 ? Math.round((processedCount / totalLeads) * 100) : 0;
  const estimatedQueueValue = readyCount * 2500000;
  const sultanCount = leads.filter((l) => (l.reviewsCount || 0) >= 25).length;

  const filteredLeads = leads.filter((l) => {
    if (tableFilter === 'READY') {
      return l.status === 'ready' || l.status === 'in_queue' || l.status === 'pending';
    }
    if (tableFilter === 'SENT') {
      return l.status === 'sent';
    }
    if (tableFilter === 'HIGH_REVIEWS') {
      return (l.reviewsCount || 0) >= 25;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      <section className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 mb-3">
          1 · PILIH NICHE
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5" id="niche-selector">
          {HIGH_TICKET_NICHES.map((niche) => {
            const active = activeNicheId === niche.id;
            return (
              <div
                key={niche.id}
                onClick={() => handleNicheSelect(niche.id)}
                className={`niche-card relative border p-4 rounded-[8px] cursor-pointer transition-colors ${
                  active
                    ? 'border-[#059669] bg-emerald-50/20'
                    : 'border-[#E5E7EB] bg-white hover:border-slate-300'
                }`}
              >
                {active && (
                  <span className="material-symbols-outlined absolute top-3 right-3 text-[#059669] text-[18px]">
                    check_circle
                  </span>
                )}
                <div
                  className={`w-8 h-8 rounded-[6px] flex items-center justify-center mb-3 ${
                    active ? 'bg-emerald-100/60 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{niche.icon}</span>
                </div>
                <div className="text-[14px] font-semibold text-slate-900 leading-snug">{niche.label}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">{niche.cities}</div>
                <div
                  className={`font-mono text-[13px] font-medium mt-2 tracking-tight ${
                    active ? 'text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {niche.dealRange}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 mb-2">
              2 · PILIH WILAYAH
            </div>
            <div className="bg-slate-100 p-1 rounded-md inline-flex border border-slate-200 text-xs font-medium">
              {CITY_PRESETS.map((preset) => {
                const active = activeCityPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleCityPresetSelect(preset)}
                    className={`px-3 py-1 rounded-[4px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 border border-slate-200/80 shadow-none font-medium'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[12px] text-slate-500 mb-1 lg:text-right">Gaya pesan</div>
            <div className="bg-slate-100 p-1 rounded-md inline-flex border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTargetMode('admin_gatekeeper')}
                className={`px-3 py-1 rounded-[4px] transition-colors cursor-pointer ${
                  targetMode === 'admin_gatekeeper'
                    ? 'bg-white text-slate-900 border border-slate-200/80 shadow-none font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lewat admin (disarankan)
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('owner_direct')}
                className={`px-3 py-1 rounded-[4px] transition-colors cursor-pointer ${
                  targetMode === 'owner_direct'
                    ? 'bg-white text-slate-900 border border-slate-200/80 shadow-none font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Langsung ke owner
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[12px] text-slate-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-slate-400">verified_user</span>
            <span>Kualifikasi A1 otomatis: bukan franchise · belum punya web · WhatsApp seluler valid</span>
          </div>

          {!isSearching ? (
            <button
              onClick={handleSearch}
              className="bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-[6px] transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">radar</span>
              <span>Tarik prospek A1</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-[6px] opacity-90 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
                <span>Menyelidiki {searchProgress}…</span>
              </button>
              <button
                type="button"
                onClick={handleCancelSearch}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium px-3 py-2 rounded-[6px] cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-[8px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
              ANTREAN SIAP KIRIM
            </div>
            <div className="font-mono text-[28px] font-semibold text-slate-900 mt-1 leading-none">
              {readyCount}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] p-4 rounded-[8px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">TERKIRIM</div>
            <div className="font-mono text-[28px] font-semibold text-slate-900 mt-1 leading-none">
              {sentCount}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] p-4 rounded-[8px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
              DILEWATI / DUPLIKAT
            </div>
            <div className="font-mono text-[28px] font-semibold text-slate-400 mt-1 leading-none">
              {skipCount}
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] p-4 rounded-[8px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
              ESTIMASI PIPELINE
            </div>
            <div className="font-mono text-[28px] font-semibold text-emerald-700 mt-1 leading-none">
              Rp {estimatedQueueValue.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] px-4 py-2.5 rounded-[8px] mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono font-medium text-slate-700">
              {countdown > 0
                ? `${countdownLabel} dalam 00:${String(countdown).padStart(2, '0')}`
                : isRunning
                ? 'Sedang mengirim pesan…'
                : 'Siap dispatch aman'}
            </span>
            <div className="w-36 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCooldown ? 'bg-amber-500' : 'bg-[#059669]'
                }`}
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-500">Jeda otomatis setiap 20 pesan</span>
            <div className="flex items-center gap-1.5">
              {!isRunning ? (
                <button
                  type="button"
                  onClick={runBatch}
                  disabled={readyCount === 0}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer"
                >
                  Mulai Auto-Send
                </button>
              ) : (
                <>
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={handleResume}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Lanjut
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePause}
                      className="border border-slate-300 hover:bg-slate-50 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                    >
                      Jeda
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStop}
                    className="border border-rose-300 text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Hentikan
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={leads.length === 0}
                className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
                title="Ekspor daftar prospek ke file CSV"
              >
                <span className="material-symbols-outlined text-[12px]">download</span>
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isRunning || leads.length === 0}
                className="border border-slate-200 hover:bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#E5E7EB] rounded-[8px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
          <div className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
            <span>Prospek Hasil Radar</span>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-slate-500 font-normal text-[12px]">({filteredLeads.length} Terverifikasi A1)</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-md text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setTableFilter('ALL')}
              className={`px-2.5 py-1 rounded-[4px] cursor-pointer ${
                tableFilter === 'ALL'
                  ? 'bg-white text-slate-900 border border-slate-200/60 shadow-none'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('READY')}
              className={`px-2.5 py-1 rounded-[4px] cursor-pointer ${
                tableFilter === 'READY'
                  ? 'bg-white text-slate-900 border border-slate-200/60 shadow-none'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Antre <span className="font-mono text-slate-400">{readyCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('SENT')}
              className={`px-2.5 py-1 rounded-[4px] cursor-pointer ${
                tableFilter === 'SENT'
                  ? 'bg-white text-slate-900 border border-slate-200/60 shadow-none'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terkirim <span className="font-mono text-slate-400">{sentCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('HIGH_REVIEWS')}
              className={`px-2.5 py-1 rounded-[4px] cursor-pointer flex items-center gap-1 ${
                tableFilter === 'HIGH_REVIEWS'
                  ? 'bg-white text-slate-900 border border-slate-200/60 shadow-none font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan hanya bisnis dengan ulasan Maps >= 25 (potensi deal 3,5jt+)"
            >
              <span className="material-symbols-outlined text-[13px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                star
              </span>
              <span>Sultan (25+ ulasan)</span>
              <span className="font-mono text-emerald-600 font-semibold">{sultanCount}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada data prospek. Pilih Niche &amp; Wilayah di atas lalu klik &ldquo;Tarik prospek A1&rdquo;.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-slate-50/30 text-[11px] uppercase font-semibold text-slate-500 tracking-[0.04em]">
                  <th className="py-2.5 px-4 font-semibold">Nama Bisnis</th>
                  <th className="py-2.5 px-4 font-semibold">Kota</th>
                  <th className="py-2.5 px-4 font-semibold">WhatsApp</th>
                  <th className="py-2.5 px-4 font-semibold">Rating Maps</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px]">
                {filteredLeads.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-900">{item.businessName}</span>
                        {(item.reviewsCount || 0) >= 25 && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold">
                            A1+ SULTAN
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {(item.reviewsCount || 0) >= 25 ? 'Est. Rp 3.500.000' : 'Est. Rp 2.500.000'}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{item.city}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">{item.phone}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {item.rating > 0 ? (
                        <div className="flex items-center gap-1">
                          <span
                            className="material-symbols-outlined text-[14px] text-amber-500"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            star
                          </span>
                          <span>
                            {item.rating} · {item.reviewsCount} ulasan
                          </span>
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {item.status === 'sent' && (
                        <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2 py-0.5 rounded">
                          Terkirim
                        </span>
                      )}
                      {item.status === 'sending' && (
                        <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 text-[11px] px-2 py-0.5 rounded animate-pulse">
                          Mengirim…
                        </span>
                      )}
                      {item.status === 'generating' && (
                        <span className="inline-flex items-center bg-purple-50 text-purple-700 border border-purple-200 text-[11px] px-2 py-0.5 rounded">
                          Claude AI…
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="inline-flex items-center bg-rose-50 text-rose-700 border border-rose-200 text-[11px] px-2 py-0.5 rounded">
                          Gagal
                        </span>
                      )}
                      {item.status === 'skipped' && (
                        <span className="inline-flex items-center bg-slate-100 text-slate-500 border border-slate-200 text-[11px] px-2 py-0.5 rounded">
                          Dilewati
                        </span>
                      )}
                      {(item.status === 'ready' || item.status === 'in_queue' || item.status === 'pending') && (
                        <span className="inline-flex items-center bg-slate-100 text-slate-600 border border-slate-200 text-[11px] px-2 py-0.5 rounded">
                          Antre
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {item.pitchMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.pitchMessage || '');
                              setCopiedPitchId(item.id);
                              showToast('success', 'Draf pitch disalin.');
                              setTimeout(() => setCopiedPitchId(null), 2000);
                            }}
                            className="border border-[#E5E7EB] hover:bg-slate-100 text-slate-600 p-1 rounded text-[11px] inline-flex items-center transition-colors cursor-pointer"
                            title="Salin Draft Pitch"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {copiedPitchId === item.id ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        )}
                        {onOpenPrototype && (
                          <button
                            onClick={() => onOpenPrototype(item)}
                            className="border border-[#E5E7EB] hover:bg-slate-100 text-slate-700 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                            type="button"
                          >
                            <span>Prototype</span>
                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleManualWhatsApp(item)}
                          className="border border-[#E5E7EB] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 px-2 py-1 rounded text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Buka WhatsApp dengan draft pitch terisi & otomatis catat ke Sheets"
                        >
                          <span>WhatsApp</span>
                          <span className="material-symbols-outlined text-[12px] text-emerald-600">send</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <footer
        onClick={() => setShowTerminal(!showTerminal)}
        className="bg-white border border-[#E5E7EB] px-4 py-2 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[14px] text-slate-400">
            {showTerminal ? 'expand_more' : 'expand_less'}
          </span>
          <span className="font-medium text-slate-700 flex-shrink-0">Log telemetri</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-[11px] text-slate-500 truncate">
            {logs.length > 0 ? logs[0].message : 'Fonnte API connected · Claude 3.5 Sonnet ready'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-[#059669]"></span>
          <span className="text-slate-600 font-medium text-[11px]">Status: Operasional normal</span>
        </div>
      </footer>

      {showTerminal && (
        <div className="mt-2 bg-[#0B0F14] border border-[#1F2937] rounded-lg p-3 max-h-52 overflow-y-auto font-mono text-[11px] text-slate-300 flex flex-col gap-1">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-2 leading-tight">
              <span className="text-slate-500 text-[10px]">{l.timestamp}</span>
              <span
                className={`uppercase text-[9px] px-1 rounded ${
                  l.type === 'success'
                    ? 'text-emerald-400 bg-emerald-950'
                    : l.type === 'error'
                    ? 'text-rose-400 bg-rose-950'
                    : 'text-slate-400 bg-slate-800'
                }`}
              >
                {l.type}
              </span>
              <span>{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
