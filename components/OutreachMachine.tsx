'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  Send,
  ShieldCheck,
  MapPin,
  Star,
  Copy,
  Terminal as TerminalIcon,
  Trash2,
  Layers,
  Check,
  Loader2,
  ExternalLink,
  ChevronRight,
  Filter,
  Zap,
  Coffee,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  OutreachLead,
  BatchLogEntry,
  NICHE_CATEGORIES,
  DEFAULT_CITIES,
  ALL_38_JAWA_TIMUR,
  KORIDOR_UTAMA_JAWA,
  ALL_AVAILABLE_CITIES,
} from '@/types/outreach';
import { formatPhoneDisplay } from '@/lib/defensive-client';
import { getDynamicFallbackPitch } from '@/lib/gemini-pitch';

interface Props {
  blacklist: Set<string>;
  onContactSentSuccess: (phone: string, lead: OutreachLead) => void;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
  onSyncSuccess?: () => void;
}

const QUEUE_KEY = 'leads_queue_v5';
const LOG_KEY = 'leads_logs_v5';

// Jeda aman dinamis 25 hingga 45 detik antar nomor
function randomJitterSeconds(min = 25, max = 45) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Jeda cooldown periodik 3 hingga 5 menit (180s - 300s) setiap 15 pesan
function randomCooldownSeconds(min = 180, max = 300) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function OutreachMachine({
  blacklist,
  onContactSentSuccess,
  showToast,
  onSyncSuccess,
}: Props) {
  // ── Filter State ─────────────────────────────────────────────────────────────
  const [selectedCities, setSelectedCities] = useState<string[]>(DEFAULT_CITIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    NICHE_CATEGORIES[0].label,
  ]);
  const [customQuery, setCustomQuery] = useState('');
  const [noWebsite, setNoWebsite] = useState(true);
  const [noFranchise, setNoFranchise] = useState(true);
  const [validWA, setValidWA] = useState(true);
  const [strictA1, setStrictA1] = useState(true);

  // ── Queue & Logs State ───────────────────────────────────────────────────────
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncingWa, setIsSyncingWa] = useState(false);
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [logs, setLogs] = useState<BatchLogEntry[]>([]);
  const [queueSearch, setQueueSearch] = useState('');

  // ── Runner State Machine ─────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState<string>('Jeda');
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

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Restore persisted queue & logs
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
    } catch {
      /* ignore storage error */
    }
  }, []);

  const saveQueue = useCallback((next: OutreachLead[]) => {
    setLeads(next);
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const addLog = useCallback(
    (
      type: BatchLogEntry['type'],
      message: string,
      phone?: string,
      businessName?: string
    ) => {
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
        const updated = [entry, ...prev].slice(0, 300);
        try {
          localStorage.setItem(LOG_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });
    },
    []
  );

  // Auto-scroll log to top on new entry
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const toggleCategory = (catLabel: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catLabel)
        ? prev.filter((c) => c !== catLabel)
        : [...prev, catLabel]
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories(NICHE_CATEGORIES.map((c) => c.label));
  };

  const resetCategories = () => {
    setSelectedCategories([NICHE_CATEGORIES[0].label]);
  };

  // ── Sync WA History Handler ─────────────────────────────────────────────────
  const handleSyncWaHistory = async () => {
    if (isSyncingWa) return;
    setIsSyncingWa(true);
    addLog('info', '[SYNC WA] Memulai sinkronisasi riwayat pesan WhatsApp dari Fonnte…');
    showToast('warn', 'Menghubungkan ke Fonnte & memeriksa riwayat WhatsApp...');

    try {
      const res = await fetch('/api/sync-wa-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal sinkronisasi riwayat WhatsApp.');
      }

      if (data.newImported > 0) {
        addLog(
          'success',
          `[SYNC WA] Berhasil mengimpor ${data.newImported} nomor riwayat WhatsApp lama ke Google Sheets!`
        );
        showToast(
          'success',
          `Berhasil mengimpor ${data.newImported} nomor riwayat WhatsApp ke Google Sheets!`
        );
        if (onSyncSuccess) {
          onSyncSuccess();
        }
      } else if (data.totalFonnte > 0) {
        addLog(
          'info',
          `[SYNC WA] Selesai: Semua nomor riwayat WhatsApp (${data.totalFonnte} nomor) sudah terdaftar di Google Sheets.`
        );
        showToast(
          'warn',
          `Semua ${data.totalFonnte} nomor riwayat WA sudah terproteksi di Google Sheets (0 baru).`
        );
      } else {
        addLog(
          'info',
          `[SYNC WA] Selesai: 0 nomor baru dari Fonnte (${data.fonnteResponseStatus || 'OK'}). Database anti-duplikasi aman.`
        );
        showToast('warn', 'Pemeriksaan riwayat pesan WA selesai.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan.';
      addLog('error', `[SYNC WA] Gagal: ${msg}`);
      showToast('error', msg);
    } finally {
      setIsSyncingWa(false);
    }
  };

  // ── Cancel Search Handler ───────────────────────────────────────────────────
  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSearching(false);
    addLog('info', '[INFO] Pencarian prospek dibatalkan oleh operator.');
    showToast('warn', 'Pencarian prospek dibatalkan oleh operator.');
  };

  // ── 1. Search Leads (Discovery Engine) ───────────────────────────────────────
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSearching) return;
    if (selectedCities.length === 0) {
      showToast('error', 'Pilih minimal satu kota target.');
      return;
    }
    if (selectedCategories.length === 0) {
      showToast('error', 'Pilih minimal satu kategori niche.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSearching(true);

    addLog(
      'info',
      `[DISCOVERY] Memulai pencarian ${selectedCategories.length} kategori di ${selectedCities.length} wilayah target…`
    );

    let collectedLeads: OutreachLead[] = [];
    let totalSkipped = 0;

    try {
      for (let i = 0; i < selectedCategories.length; i++) {
        if (controller.signal.aborted) break;

        const currentCat = selectedCategories[i];

        const res = await fetch('/api/discovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            cities: selectedCities,
            categories: [currentCat],
            category: currentCat,
            customQuery,
            onlyWithoutWebsite: noWebsite,
            excludeFranchise: noFranchise,
            onlyValidWhatsApp: validWA,
            strictA1,
            blacklist: [
              ...Array.from(blacklist),
              ...collectedLeads.map((l) => l.phone),
            ],
          }),
        });

        if (controller.signal.aborted) break;

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Pencarian gagal.');

        const fetched: OutreachLead[] = data.leads || [];
        const skipped: Array<{ phone: string; businessName: string; reason: string }> =
          data.skippedLogs || [];
        totalSkipped += skipped.length;

        // Log telemetry discovery results
        fetched.forEach((lead) => {
          addLog(
            'info',
            `[DISCOVERY] Menemukan ${lead.businessName} di ${lead.city} (Status: A1 Valid)`,
            lead.phone,
            lead.businessName
          );
        });

        skipped.forEach((s) =>
          addLog('skip', `[DUPLICATE-CHECK] ${s.phone} ${s.reason} → SKIPPED`, s.phone, s.businessName)
        );

        if (fetched.length > 0) {
          const existingPhones = new Set(collectedLeads.map((l) => l.phone));
          const newItems = fetched.filter((l) => !existingPhones.has(l.phone));
          if (newItems.length > 0) {
            collectedLeads = [...collectedLeads, ...newItems].slice(0, 100);
            // Simpan prospek yang sudah sempat terjaring sebelum dibatalkan ke antrean
            saveQueue(collectedLeads);
          }
        }
      }

      if (controller.signal.aborted) {
        return;
      }

      if (collectedLeads.length === 0) {
        showToast(
          'warn',
          'Tidak ada lead baru — semua nomor sudah ada di Sheets atau tidak lolos kualifikasi A1.'
        );
        addLog('warn', '[DISCOVERY] Selesai: 0 prospek baru memenuhi syarat Tier A1.');
      } else {
        showToast('success', `${collectedLeads.length} prospek Tier A1 siap — anti-duplikasi aktif.`);
        addLog(
          'success',
          `[DISCOVERY] Berhasil mengumpulkan ${collectedLeads.length} prospek A1 (${totalSkipped} dilewati).`
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        // Abaikan error pembatalan normal
        return;
      }
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan.';
      showToast('error', msg);
      addLog('error', `[ERROR] Pencarian gagal: ${msg}`);
    } finally {
      setIsSearching(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // ── Pause helper ─────────────────────────────────────────────────────────────
  const waitWhilePaused = async () => {
    while (pausedRef.current && !abortRef.current) {
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  // ── 2. Run Auto-Send Batch with Jitter & Cooldown ─────────────────────────────
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
    showToast('success', `Memulai safe dispatch untuk ${pending.length} prospek (Jeda 25–45s).`);
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

      // Cek blacklist live sebelum dispatch
      if (blacklist.has(lead.phone)) {
        addLog(
          'skip',
          `[DUPLICATE-CHECK] ${lead.phone} sudah ada di Google Sheets → SKIPPED`,
          lead.phone,
          lead.businessName
        );
        const u = [...leadsRef.current];
        u[idx] = { ...lead, status: 'skipped', error: 'Sudah ada di Google Sheets' };
        saveQueue(u);
        continue;
      }

      // Step A: Dynamic Gemini Copywriting dari nol
      const qG = [...leadsRef.current];
      qG[idx] = { ...lead, status: 'generating' };
      saveQueue(qG);

      let finalMessage = lead.pitchMessage;
      if (!finalMessage) {
        addLog(
          'info',
          `[AI GENERATING] Merancang pesan unik via Gemini untuk ${lead.businessName}...`,
          lead.phone,
          lead.businessName
        );
        try {
          const gr = await fetch('/api/outreach/generate-pitch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead }),
          });
          const gd = await gr.json();
          if (gr.ok && gd.success && gd.message) {
            finalMessage = gd.message;
            addLog(
              'info',
              `[GEMINI-AI] Pitch unik (Angle ${gd.angleUsed || 'Dynamic'}) siap untuk ${lead.businessName}.`,
              lead.phone,
              lead.businessName
            );
          }
        } catch {
          /* fallback to dynamic pitch */
        }
      }

      if (!finalMessage) {
        finalMessage = getDynamicFallbackPitch({
          businessName: lead.businessName,
          category: lead.category,
          city: lead.city,
          address: lead.address,
          rating: lead.rating,
          reviewsCount: lead.reviewsCount,
        });
      }

      const qS = [...leadsRef.current];
      qS[idx] = { ...lead, status: 'sending', pitchMessage: finalMessage };
      saveQueue(qS);

      await waitWhilePaused();
      if (abortRef.current) break;

      // Step B: Fonnte Outreach Dispatch & Sheets Record
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

          addLog(
            'success',
            `[FONNTE OUTREACH] Mengirim ke +${lead.phone}... Sukses.`,
            lead.phone,
            lead.businessName
          );
          addLog(
            'success',
            `[SHEETS RECORD] Menyimpan riwayat ke Google Spreadsheet.`,
            lead.phone,
            lead.businessName
          );
        } else {
          const errMsg = sd.error || 'Gagal pengiriman WhatsApp Fonnte.';
          const qF = [...leadsRef.current];
          qF[idx] = { ...lead, status: 'failed', error: errMsg };
          saveQueue(qF);
          addLog('error', `[FAILED] ${lead.businessName}: ${errMsg}`, lead.phone, lead.businessName);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Kesalahan jaringan';
        const qF = [...leadsRef.current];
        qF[idx] = { ...lead, status: 'failed', error: errMsg };
        saveQueue(qF);
        addLog('error', `[ERROR] ${lead.phone}: ${errMsg}`, lead.phone);
      }

      // Step C: Periodic Cooldown (setiap 15 pesan, jeda 3-5 menit)
      const isLast = p === pending.length - 1;
      if (!isLast && !abortRef.current) {
        if (sentInCurrentChunk >= 15) {
          sentInCurrentChunk = 0;
          const cooldownSec = randomCooldownSeconds(180, 300);
          setIsCooldown(true);
          setCountdownLabel('Cooldown 15 Pesan');
          addLog(
            'warn',
            `[COOLDOWN] Istirahat berkala aman ${Math.round(cooldownSec / 60)} menit (${cooldownSec}s) setelah 15 pesan terkirim.`
          );

          for (let s = cooldownSec; s > 0; s--) {
            if (abortRef.current) break;
            await waitWhilePaused();
            if (abortRef.current) break;
            setCountdown(s);
            await new Promise((r) => setTimeout(r, 1000));
          }
          setIsCooldown(false);
          setCountdown(0);
          addLog('info', `[COOLDOWN SELESAI] Melanjutkan antrean batch berikutnya.`);
        } else {
          // Random Jitter Delay (25 - 45 detik)
          const jitterDelay = randomJitterSeconds(25, 45);
          setIsCooldown(false);
          setCountdownLabel('Jeda Aman');
          addLog('info', `[WAIT] Jeda acak ${jitterDelay} detik sebelum nomor berikutnya…`);

          for (let s = jitterDelay; s > 0; s--) {
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
    showToast('success', 'Batch pengiriman selesai diproses.');
    addLog('info', '[DONE] Seluruh antrean batch telah diproses dengan aman.');
  };

  const handlePause = () => {
    pausedRef.current = true;
    setIsPaused(true);
    addLog('warn', '[PAUSE] Batch dijeda oleh operator.');
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
    addLog('warn', '[STOP] Batch dihentikan paksa oleh operator.');
    showToast('warn', 'Batch berhasil dihentikan.');
  };

  const handleReset = () => {
    if (isRunning) return;
    saveQueue([]);
    setLogs([]);
    try {
      localStorage.removeItem(QUEUE_KEY);
      localStorage.removeItem(LOG_KEY);
    } catch {
      /* ignore */
    }
    showToast('success', 'Antrean dan live log berhasil di-reset.');
  };

  // ── Metrics Calculation ──────────────────────────────────────────────────────
  const totalLeads = leads.length;
  const sentCount = leads.filter((l) => l.status === 'sent').length;
  const failedCount = leads.filter((l) => l.status === 'failed').length;
  const skipCount = leads.filter((l) => l.status === 'skipped').length;
  const readyCount = leads.filter(
    (l) => l.status === 'ready' || l.status === 'in_queue' || l.status === 'pending'
  ).length;
  const processedCount = sentCount + failedCount + skipCount;
  const progressPct = totalLeads > 0 ? Math.round((processedCount / totalLeads) * 100) : 0;

  // Filter queue for table
  const filteredLeads = leads.filter((l) => {
    if (!queueSearch.trim()) return true;
    const q = queueSearch.toLowerCase();
    return (
      l.businessName.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.phone.includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6">

      {/* ═════════════════════════════════════════════════════════════
          SECTION A: PARAMETER & FILTER PROSPEK (Grid 3 Kolom)
      ═════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs shrink-0">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Kolom 1 — Kota Target & Preset Jawa Timur 38 Wilayah */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Wilayah Target
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-900">{selectedCities.length}</span> terpilih
                  </span>
                </div>

                {/* Quick Presets Bar */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCities(Array.from(ALL_38_JAWA_TIMUR))}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition cursor-pointer flex items-center gap-1"
                    title="Pilih seluruh 38 Kota & Kabupaten di Jawa Timur"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>⚡ Seluruh Jawa Timur (38)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCities(Array.from(KORIDOR_UTAMA_JAWA))}
                    className="px-2 py-1 rounded-md text-[11px] font-medium border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                  >
                    Koridor Jawa
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCities(DEFAULT_CITIES)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                  >
                    Default Jatim
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCities([])}
                    className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer ml-auto"
                  >
                    Reset
                  </button>
                </div>

                {/* Cities Pill Selector */}
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                  {ALL_AVAILABLE_CITIES.map((city) => {
                    const active = selectedCities.includes(city);
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => toggleCity(city)}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border transition-all cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {city}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Kolom 2 — Kategori Niche (7 Kategori High-Value & Perusahaan) */}
            <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 pt-4 lg:pt-0">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Kategori High-Value &amp; B2B
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      ({selectedCategories.length} terpilih / {NICHE_CATEGORIES.length})
                    </span>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={selectAllCategories}
                      className="text-slate-700 hover:text-slate-900 font-semibold transition cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={resetCategories}
                      className="text-slate-400 hover:text-rose-600 font-medium transition cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
                  {NICHE_CATEGORIES.map((cat) => {
                    const active = selectedCategories.includes(cat.label);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.label)}
                        className={`text-left px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              active
                                ? 'bg-white border-white text-slate-900'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {active && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="font-semibold truncate">{cat.label}</span>
                        </div>
                        <span
                          className={`text-[10px] ml-2 shrink-0 ${
                            active ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {cat.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom search keyword */}
              <div className="mt-2.5">
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="Kueri spesifik (contoh: Klinik Estetika Malang)"
                  className="w-full h-8 px-3 text-xs rounded-md bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Kolom 3 — Kualifikasi Ketat Tier A1 & Tombol Aksi */}
            <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 pt-4 lg:pt-0">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <label className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Kualifikasi Ketat Prospek Tier A1
                  </label>
                </div>

                <div className="space-y-1.5 mb-3.5">
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-medium cursor-pointer hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={strictA1}
                      onChange={(e) => setStrictA1(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-900">
                      Tier A1 Mutlak (Tanpa Web Resmi + Review &ge;3)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={validWA}
                      onChange={(e) => setValidWA(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span>WhatsApp Valid (628/08, Drop Telepon Kabel)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={noFranchise}
                      onChange={(e) => setNoFranchise(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span>Tolak Franchise / Waralaba Multinasional</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={noWebsite}
                      onChange={(e) => setNoWebsite(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span>Hanya Bisnis Tanpa Website Mandiri</span>
                  </label>
                </div>
              </div>

              {/* Main Action Button / Cancel Button Group */}
              {!isSearching ? (
                <button
                  type="submit"
                  className="w-full h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.99] cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>🔍 Cari Prospek Bersih Tier A1</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    disabled
                    className="flex-1 h-10 px-3 rounded-lg bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed opacity-90 shadow-xs"
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-slate-300 shrink-0" />
                    <span className="truncate">⏳ Mengecek Serper &amp; Memfilter A1...</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSearch}
                    className="h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 shadow-xs active:scale-[0.98] cursor-pointer"
                    title="Batalkan proses pencarian"
                  >
                    <X className="w-4 h-4" />
                    <span>✕ Batal</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </form>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          SECTION B: STATUS BATCH & METRIK (4 KPI Card + Safe Dispatch)
      ═════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs shrink-0 flex flex-col gap-4">
        {/* 4 Balanced KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1. Antrean Siap Kirim (Netral / Slate) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Antrean Siap Kirim
              </span>
              <div className="w-7 h-7 rounded-lg bg-slate-200/70 text-slate-700 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{readyCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">dari {totalLeads} total prospek</div>
            </div>
          </div>

          {/* 2. Sukses Terkirim (Hijau / Emerald) */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Sukses Terkirim
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">{sentCount}</div>
              <div className="text-[11px] text-emerald-600/80 mt-0.5">Tersimpan ke Sheets</div>
            </div>
          </div>

          {/* 3. Dilewati / Duplikat (Abu-abu / Slate) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-100/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Dilewati / Duplikat
              </span>
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-700">{skipCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Terproteksi anti-duplikasi</div>
            </div>
          </div>

          {/* 4. Gagal / Timeout (Merah / Rose) */}
          <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                Gagal / Timeout
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-700">{failedCount}</div>
              <div className="text-[11px] text-rose-600/80 mt-0.5">Memerlukan retry</div>
            </div>
          </div>

        </div>

        {/* Progress Bar & Safe Dispatch Jitter Status */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          {/* Left: Progress info & Live Countdown Visual */}
          <div className="flex-1 max-w-xl">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 font-medium">
                Kemajuan Batch:{' '}
                <span className="text-slate-900 font-semibold">
                  {processedCount} / {totalLeads} ({progressPct}%)
                </span>
              </span>

              {/* Countdown Visualizer */}
              {countdown > 0 && isRunning && (
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded-md flex items-center gap-1.5 font-bold shadow-2xs ${
                    isCooldown
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {isCooldown ? <Coffee className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>
                    {countdownLabel}: {countdown}s
                  </span>
                </span>
              )}
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  isCooldown ? 'bg-amber-500' : 'bg-slate-900'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncWaHistory}
              disabled={isSyncingWa}
              className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Sinkronkan riwayat pesan WhatsApp Fonnte ke Google Sheets untuk proteksi anti-duplikasi"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWa ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>{isSyncingWa ? 'Sinkron WA…' : 'Sinkron Riwayat WA'}</span>
            </button>

            {!isRunning ? (
              <button
                type="button"
                onClick={runBatch}
                disabled={readyCount === 0}
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition active:scale-[0.99] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>🚀 Jalankan Batch Auto-Send (Jeda 25–45s)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lanjutkan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="h-9 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Jeda</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStop}
                  className="h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Hentikan</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              disabled={isRunning || (leads.length === 0 && logs.length === 0)}
              className="h-9 px-3.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Reset antrean dan terminal log"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↺ Reset Antrean</span>
            </button>
          </div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          SECTION C: REALTIME CONSOLE & ANTREAN AKTIF (Full Height)
      ═════════════════════════════════════════════════════════════ */}
      <section className="flex-1 min-h-[380px] grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">

        {/* Panel Kiri: Tabel Antrean Batch (Col 7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Tabel Antrean Batch Tier A1
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-700">
                {leads.length} Target
              </span>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Cari dalam antrean…"
                className="w-full h-7 pl-8 pr-2.5 text-xs rounded-md bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {filteredLeads.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Layers className="w-8 h-8 stroke-1 text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Antrean prospek masih kosong</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                  Gunakan parameter filter di atas dan klik &ldquo;Cari Prospek Bersih Tier A1&rdquo; untuk mengisi antrean batch.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider z-10">
                  <tr>
                    <th className="px-4 py-2.5">Nama Bisnis</th>
                    <th className="px-3 py-2.5">Kota</th>
                    <th className="px-3 py-2.5">Kategori</th>
                    <th className="px-3 py-2.5">Nomor WA</th>
                    <th className="px-3 py-2.5">Rating</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((item) => {
                    const isActive = activeLead?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isActive
                            ? 'bg-blue-50/60 font-medium'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 1. Nama Bisnis */}
                        <td className="px-4 py-2.5 max-w-[180px]">
                          <div className="truncate font-medium text-slate-900" title={item.businessName}>
                            {item.businessName}
                          </div>
                          {item.hasWebsite ? (
                            <span className="text-[10px] text-slate-400">Website Mandiri</span>
                          ) : item.website ? (
                            <span className="text-[10px] text-amber-600 font-medium truncate block" title={item.website}>
                              Medsos/Linktree ★
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-medium">Tanpa Website ★</span>
                          )}
                        </td>

                        {/* 2. Kota */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                          {item.city}
                        </td>

                        {/* 3. Kategori */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {item.category}
                          </span>
                        </td>

                        {/* 4. Nomor WA */}
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-800">
                          {formatPhoneDisplay(item.phone)}
                        </td>

                        {/* 5. Rating */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {item.rating > 0 ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{item.rating}</span>
                              <span className="text-slate-400 text-[10px]">({item.reviewsCount})</span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* 6. Status Pill */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          {item.status === 'sent' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Terkirim
                            </span>
                          )}
                          {item.status === 'sending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                              <Send className="w-3 h-3" />
                              Mengirim WA…
                            </span>
                          )}
                          {item.status === 'generating' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <Sparkles className="w-3 h-3 animate-spin" />
                              Gemini AI…
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                              title={item.error}
                            >
                              <XCircle className="w-3 h-3" />
                              Gagal
                            </span>
                          )}
                          {item.status === 'skipped' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              Dilewati
                            </span>
                          )}
                          {(item.status === 'ready' ||
                            item.status === 'in_queue' ||
                            item.status === 'pending') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                              Siap Kirim
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel Kanan: Terminal Live Log (Col 5) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl shadow-inner flex flex-col h-full overflow-hidden text-slate-300 font-mono text-xs">
          {/* Terminal Window Bar */}
          <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            {/* macOS 3 dots */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <TerminalIcon className="w-3 h-3 text-slate-400" />
                Live Telemetry &amp; Logs
              </span>
            </div>

            {/* Active pulse */}
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${
                    isRunning
                      ? isCooldown
                        ? 'bg-amber-400 animate-ping opacity-75'
                        : 'bg-emerald-400 animate-ping opacity-75'
                      : 'bg-slate-600'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isRunning
                      ? isCooldown
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      : 'bg-slate-500'
                  }`}
                />
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                {isRunning
                  ? isPaused
                    ? 'Paused'
                    : isCooldown
                    ? 'Cooldown'
                    : 'Dispatching'
                  : 'Idle'}
              </span>
            </div>
          </div>

          {/* Terminal Logs Stream */}
          <div
            ref={logEndRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5 terminal-scroll"
          >
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 py-12">
                <TerminalIcon className="w-6 h-6 stroke-1 mb-2 text-slate-700" />
                <p className="text-[11px] text-slate-500">Terminal siap menerima event stream.</p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Log kualifikasi A1, AI generation, anti-duplikasi, dan status pengiriman Fonnte akan tampil di sini.
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const isDiscovery = log.message.includes('DISCOVERY');
                const isDup = log.message.includes('DUPLICATE-CHECK') || log.type === 'skip';
                const isAiGen = log.message.includes('AI GENERATING') || log.message.includes('GEMINI-AI');
                const isFonnte = log.message.includes('FONNTE OUTREACH') || log.message.includes('FONNTE-SUCCESS');
                const isSheets = log.message.includes('SHEETS RECORD');
                const isCooldownLog = log.message.includes('COOLDOWN');
                const isErr = log.type === 'error' || log.message.includes('ERROR');
                const isWarn = log.type === 'warn' || log.message.includes('WARN');

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-[11px] leading-relaxed break-words hover:bg-slate-900/50 px-1 py-0.5 rounded transition"
                  >
                    <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>

                    {/* Tag badge */}
                    {isDiscovery ? (
                      <span className="text-cyan-400 font-semibold shrink-0">[DISCOVERY]</span>
                    ) : isAiGen ? (
                      <span className="text-purple-400 font-semibold shrink-0">[AI GENERATING]</span>
                    ) : isFonnte ? (
                      <span className="text-emerald-400 font-semibold shrink-0">[FONNTE OUTREACH]</span>
                    ) : isSheets ? (
                      <span className="text-blue-400 font-semibold shrink-0">[SHEETS RECORD]</span>
                    ) : isCooldownLog ? (
                      <span className="text-amber-400 font-semibold shrink-0">[COOLDOWN]</span>
                    ) : isDup ? (
                      <span className="text-amber-300 font-semibold shrink-0">[DUPLICATE-CHECK]</span>
                    ) : isErr ? (
                      <span className="text-rose-400 font-semibold shrink-0">[ERROR]</span>
                    ) : isWarn ? (
                      <span className="text-amber-300 font-semibold shrink-0">[WARN]</span>
                    ) : (
                      <span className="text-slate-400 font-semibold shrink-0">[INFO]</span>
                    )}

                    <span
                      className={
                        isErr
                          ? 'text-rose-300'
                          : isDup
                          ? 'text-amber-200'
                          : isFonnte || isSheets
                          ? 'text-emerald-300'
                          : isAiGen
                          ? 'text-purple-200'
                          : isDiscovery
                          ? 'text-cyan-200'
                          : isCooldownLog
                          ? 'text-amber-200'
                          : 'text-slate-300'
                      }
                    >
                      {log.message.replace(
                        /^\[(DISCOVERY|AI GENERATING|GEMINI-AI|FONNTE OUTREACH|FONNTE-SUCCESS|SHEETS RECORD|COOLDOWN|COOLDOWN SELESAI|DUPLICATE-CHECK|ERROR|WARN|INFO|START|WAIT|DONE)\]\s*/,
                        ''
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Terminal Footer Info */}
          <div className="px-4 py-2 border-t border-slate-900 bg-slate-950/80 flex items-center justify-between text-[10px] text-slate-500">
            <span>Log buffer: {logs.length} entri</span>
            <button
              type="button"
              onClick={() => {
                const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join('\n');
                navigator.clipboard.writeText(text);
                showToast('success', 'Log berhasil disalin ke clipboard.');
              }}
              className="hover:text-slate-300 transition cursor-pointer"
            >
              Salin Semua Log
            </button>
          </div>
        </div>

      </section>

    </div>
  );
}
