'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faSearch,
  faPaperPlane,
  faPlay,
  faPause,
  faStop,
  faRotateLeft,
  faCheckCircle,
  faTimesCircle,
  faShieldAlt,
  faSpinner,
  faClock,
  faCopy,
  faFilter,
  faMapMarkerAlt,
  faExclamationTriangle,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import {
  OutreachLead,
  BatchLogEntry,
  NICHE_CATEGORIES,
  DEFAULT_CITIES,
  ALL_AVAILABLE_CITIES,
} from '@/types/outreach';
import { formatPhoneDisplay } from '@/lib/defensive-client';

interface MesinOutreachTabProps {
  blacklist: Set<string>;
  onContactSentSuccess: (phone: string, lead: OutreachLead) => void;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

const STORAGE_QUEUE_KEY = 'leads_outreach_queue_v4';
const STORAGE_LOGS_KEY = 'leads_outreach_logs_v4';

function getRandomDelaySeconds(min = 15, max = 30): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function MesinOutreachTab({
  blacklist,
  onContactSentSuccess,
  showToast,
}: MesinOutreachTabProps) {
  // Filter States
  const [selectedCities, setSelectedCities] = useState<string[]>(DEFAULT_CITIES);
  const [selectedCategory, setSelectedCategory] = useState<string>(NICHE_CATEGORIES[0].label);
  const [customQuery, setCustomQuery] = useState<string>('');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState<boolean>(true);
  const [excludeFranchise, setExcludeFranchise] = useState<boolean>(true);
  const [onlyValidWhatsApp, setOnlyValidWhatsApp] = useState<boolean>(true);

  // Search & Batch States
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [logs, setLogs] = useState<BatchLogEntry[]>([]);

  // Queue Runner State Machine
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(0);
  const [activeLead, setActiveLead] = useState<OutreachLead | null>(null);

  // Refs for stable loop control
  const runningRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  const abortRef = useRef<boolean>(false);
  const leadsRef = useRef<OutreachLead[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  // Load persisted queue & logs on mount
  useEffect(() => {
    try {
      const savedQueue = localStorage.getItem(STORAGE_QUEUE_KEY);
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLeads(parsed);
        }
      }
      const savedLogs = localStorage.getItem(STORAGE_LOGS_KEY);
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        if (Array.isArray(parsedLogs)) {
          setLogs(parsedLogs);
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }, []);

  // Persist queue updates
  const saveQueue = useCallback((updatedLeads: OutreachLead[]) => {
    setLeads(updatedLeads);
    try {
      localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(updatedLeads));
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
        const updated = [entry, ...prev].slice(0, 150); // Simpan maks 150 entri terakhir
        try {
          localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    []
  );

  // Helper toggle kota
  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  // 1. Eksekusi Pencarian dengan Anti-Duplikasi
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedCities.length === 0) {
      showToast('error', 'Pilih minimal satu kota target.');
      return;
    }

    setIsSearching(true);
    addLog(
      'info',
      `Memulai pencarian ${selectedCategory} di ${selectedCities.join(', ')}...`
    );

    try {
      const res = await fetch('/api/outreach/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cities: selectedCities,
          category: selectedCategory,
          customQuery,
          onlyWithoutWebsite,
          excludeFranchise,
          onlyValidWhatsApp,
          blacklist: Array.from(blacklist),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal mencari prospek.');
      }

      const fetchedLeads: OutreachLead[] = data.leads || [];
      const skippedLogs = data.skippedLogs || [];

      // Catat log skip duplikat
      if (Array.isArray(skippedLogs) && skippedLogs.length > 0) {
        for (const item of skippedLogs) {
          addLog('skip', item.reason, item.phone, item.businessName);
        }
      }

      if (fetchedLeads.length === 0) {
        showToast('warn', 'Tidak ada lead baru yang lolos filter (semua sudah ada di Sheets atau tanpa WA).');
        addLog('warn', 'Pencarian selesai: 0 lead baru ditemukan setelah filter anti-duplikasi.');
      } else {
        // Batasi antrean ke 50 - 75 lead baru
        const batchCut = fetchedLeads.slice(0, 75);
        saveQueue(batchCut);
        showToast('success', `Berhasil memuat ${batchCut.length} prospek baru (anti-duplikasi aktif).`);
        addLog(
          'success',
          `Antrean batch diperbarui: ${batchCut.length} prospek siap dikirim (${skippedLogs.length} dilewati).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan saat mencari prospek.';
      showToast('error', msg);
      addLog('error', `Pencarian gagal: ${msg}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper wait while paused
  const waitWhilePaused = async () => {
    while (pausedRef.current && !abortRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  // 2. Eksekusi Batch Runner (Fonnte + Gemini + Sheets)
  const runBatchEngine = async () => {
    if (runningRef.current) return;
    const currentQueue = leadsRef.current;
    const pendingIndices = currentQueue
      .map((l, i) => (l.status === 'ready' || l.status === 'failed' ? i : -1))
      .filter((i) => i !== -1);

    if (pendingIndices.length === 0) {
      showToast('warn', 'Semua prospek dalam antrean sudah terkirim atau dilewati.');
      return;
    }

    runningRef.current = true;
    pausedRef.current = false;
    abortRef.current = false;

    setIsRunning(true);
    setIsPaused(false);
    showToast('success', `Mesin Outreach dimulai. Mengirim ke ${pendingIndices.length} target...`);
    addLog('info', `[START BATCH] Memulai pengiriman otomatis untuk ${pendingIndices.length} prospek.`);

    for (let p = 0; p < pendingIndices.length; p++) {
      if (abortRef.current) break;
      await waitWhilePaused();
      if (abortRef.current) break;

      const idx = pendingIndices[p];
      const targetLead = leadsRef.current[idx];
      if (!targetLead) continue;

      setCurrentIndex(idx);
      setActiveLead(targetLead);

      // Cek ulang blacklist live
      if (blacklist.has(targetLead.phone)) {
        addLog('skip', `[SKIP DUPLIKAT TERAKHIR] ${targetLead.phone} terdeteksi sudah ada di Sheets.`);
        const updated = [...leadsRef.current];
        updated[idx] = { ...targetLead, status: 'skipped', error: 'Sudah ada di Google Sheets' };
        saveQueue(updated);
        continue;
      }

      // Step A: Buat Pitch Pesan Personal via Gemini AI
      const updatedQueueGen = [...leadsRef.current];
      updatedQueueGen[idx] = { ...targetLead, status: 'generating' };
      saveQueue(updatedQueueGen);

      let finalMessage = targetLead.pitchMessage;

      if (!finalMessage) {
        addLog('info', `[GEMINI AI] Menyesuaikan draft pesan personal untuk "${targetLead.businessName}"...`);
        try {
          const genRes = await fetch('/api/outreach/generate-pitch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead: targetLead }),
          });
          const genData = await genRes.json();
          if (genRes.ok && genData.success && genData.message) {
            finalMessage = genData.message;
            addLog(
              'info',
              `[GEMINI AI] Draft pesan personal (${genData.source}) selesai untuk ${targetLead.businessName}.`
            );
          }
        } catch {
          // Fallback static pitch will be generated server-side if needed
        }
      }

      if (!finalMessage) {
        finalMessage = `Halo Kak, salam kenal! Saya melihat profil ${targetLead.businessName} di Google Maps. Kami menyediakan solusi website profil kilat, katalog interaktif WhatsApp, dan sistem admin ringkas. Boleh kami kirimkan demo preview gratisnya Kak?`;
      }

      const updatedWithMsg = [...leadsRef.current];
      updatedWithMsg[idx] = { ...targetLead, status: 'sending', pitchMessage: finalMessage };
      saveQueue(updatedWithMsg);

      await waitWhilePaused();
      if (abortRef.current) break;

      // Step B: Kirim via Fonnte Gateway + Auto Insert ke Google Sheets
      try {
        const sendRes = await fetch('/api/outreach/send-single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: targetLead,
            message: finalMessage,
          }),
        });

        const sendData = await sendRes.json();

        if (sendRes.ok && sendData.success) {
          const finishedLead: OutreachLead = {
            ...targetLead,
            status: 'sent',
            sentAt: new Date().toISOString(),
            pitchMessage: finalMessage,
          };
          const updatedSuccess = [...leadsRef.current];
          updatedSuccess[idx] = finishedLead;
          saveQueue(updatedSuccess);

          // Daftarkan ke blacklist global aplikasi
          onContactSentSuccess(targetLead.phone, finishedLead);

          addLog(
            'success',
            `[KIRIM BERHASIL] Pesan terkirim ke ${targetLead.phone} (${targetLead.businessName}).`
          );

          if (sendData.sheetsSynced) {
            addLog('info', `[SHEETS SYNC] Data tersimpan otomatis di Google Sheets untuk ${targetLead.phone}.`);
          } else {
            addLog('warn', `[CRITICAL WARNING] Pesan terkirim tapi Sheets gagal: ${sendData.sheetsError || 'Tertunda'}`);
          }
        } else {
          const errMsg = sendData.error || 'Gagal mengirim pesan melalui Fonnte.';
          const updatedFail = [...leadsRef.current];
          updatedFail[idx] = { ...targetLead, status: 'failed', error: errMsg };
          saveQueue(updatedFail);

          addLog('error', `[KIRIM GAGAL] ${targetLead.businessName} (${targetLead.phone}): ${errMsg}`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Kesalahan jaringan';
        const updatedFail = [...leadsRef.current];
        updatedFail[idx] = { ...targetLead, status: 'failed', error: errMsg };
        saveQueue(updatedFail);
        addLog('error', `[KIRIM ERROR] ${targetLead.phone}: ${errMsg}`);
      }

      // Step C: Jeda Acak 15–30 Detik (Anti-Spam) jika masih ada target berikutnya
      const isLastTarget = p === pendingIndices.length - 1;
      if (!isLastTarget && !abortRef.current) {
        const delaySeconds = getRandomDelaySeconds(15, 30);
        addLog('info', `[JEDA KEAMANAN] Menunggu ${delaySeconds} detik sebelum prospek berikutnya...`);

        for (let s = delaySeconds; s > 0; s--) {
          if (abortRef.current) break;
          await waitWhilePaused();
          if (abortRef.current) break;
          setCountdown(s);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setCountdown(0);
      }
    }

    runningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setActiveLead(null);
    setCountdown(0);

    showToast('success', 'Batch pengiriman selesai.');
    addLog('info', '[SELESAI] Seluruh antrean batch telah diproses.');
  };

  const handlePause = () => {
    pausedRef.current = true;
    setIsPaused(true);
    addLog('warn', '[PAUSE] Pengiriman batch dijeda oleh operator.');
    showToast('warn', 'Pengiriman dijeda.');
  };

  const handleResume = () => {
    pausedRef.current = false;
    setIsPaused(false);
    addLog('info', '[RESUME] Melanjutkan pengiriman batch.');
    showToast('success', 'Melanjutkan pengiriman.');
  };

  const handleStop = () => {
    abortRef.current = true;
    pausedRef.current = false;
    runningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    setActiveLead(null);
    setCountdown(0);
    addLog('warn', '[STOP] Pengiriman batch dihentikan oleh operator.');
    showToast('warn', 'Batch dihentikan.');
  };

  const handleResetQueue = () => {
    if (isRunning) return;
    saveQueue([]);
    setLogs([]);
    try {
      localStorage.removeItem(STORAGE_QUEUE_KEY);
      localStorage.removeItem(STORAGE_LOGS_KEY);
    } catch {}
    showToast('success', 'Antrean dan log berhasil di-reset.');
  };

  // Perhitungan statistik
  const totalLeads = leads.length;
  const sentCount = leads.filter((l) => l.status === 'sent').length;
  const failedCount = leads.filter((l) => l.status === 'failed').length;
  const skippedCount = leads.filter((l) => l.status === 'skipped').length;
  const readyCount = leads.filter((l) => l.status === 'ready' || l.status === 'in_queue').length;
  const progressPct = totalLeads > 0 ? Math.round((sentCount / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. PANEL KONTROL PROSPEK */}
      <div className="bg-cream-50 border border-olive-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-olive-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-olive-500 text-cream-50 flex items-center justify-center font-bold shadow-sm">
              <FontAwesomeIcon icon={faFilter} className="h-4 w-4 text-mint-200" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-olive-900 tracking-tight">
                Panel Filter & Discovery Prospek
              </h2>
              <p className="text-[11px] text-olive-600">
                Pencarian lokal Serper API dengan proteksi 100% anti-duplikasi
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-olive-100 border border-olive-200 text-olive-800 text-xs font-semibold">
            <FontAwesomeIcon icon={faShieldAlt} className="h-3.5 w-3.5 text-olive-600" />
            <span>Blacklist Sheets: {blacklist.size} Nomor</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          {/* Pilihan Kota */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-olive-800 uppercase tracking-wider">
                Pilihan Kota Target (Default: Malang, Surabaya, Kediri)
              </label>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedCities(DEFAULT_CITIES)}
                  className="text-olive-600 hover:text-olive-900 font-semibold cursor-pointer"
                >
                  Reset Default
                </button>
                <span className="text-olive-400">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedCities(ALL_AVAILABLE_CITIES)}
                  className="text-olive-600 hover:text-olive-900 font-semibold cursor-pointer"
                >
                  Pilih Semua
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_AVAILABLE_CITIES.map((city: string) => {
                const isSelected = selectedCities.includes(city);
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-olive-500 text-cream-50 shadow-sm'
                        : 'bg-cream-100 text-olive-700 hover:bg-cream-200 border border-olive-200'
                    }`}
                  >
                    <span>{city}</span>
                    {isSelected && <span className="text-[10px] text-mint-200">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pilihan Kategori Niche High-Value */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-olive-800 uppercase tracking-wider block">
              Kategori Niche High-Value
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {NICHE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.label)}
                    className={`p-2.5 rounded-xl text-left transition cursor-pointer border ${
                      isSelected
                        ? 'bg-olive-500 text-cream-50 border-olive-600 shadow-sm'
                        : 'bg-cream-100 text-olive-800 hover:bg-cream-200 border-olive-200'
                    }`}
                  >
                    <p className="text-xs font-bold leading-tight truncate">{cat.label}</p>
                    <p className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-mint-200' : 'text-olive-500'}`}>
                      {cat.id.toUpperCase()}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Kata Kunci Tambahan (Opsional) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8">
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Kata kunci pencarian spesifik (opsional, misal: Dokter Gigi Anak)"
                className="w-full text-xs font-medium py-2.5 px-3.5 rounded-xl border border-olive-200 bg-cream-50 text-olive-900 placeholder:text-olive-400 focus:outline-none focus:border-olive-500"
              />
            </div>
            <div className="md:col-span-4">
              <button
                type="submit"
                disabled={isSearching}
                className="w-full py-2.5 px-4 rounded-xl bg-olive-500 hover:bg-olive-600 disabled:opacity-50 text-cream-50 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <FontAwesomeIcon icon={isSearching ? faSpinner : faSearch} className={`h-3.5 w-3.5 ${isSearching ? 'animate-spin' : ''}`} />
                <span>{isSearching ? 'Mencari & Memfilter...' : 'Temukan Prospek Bersih'}</span>
              </button>
            </div>
          </div>

          {/* Filter Cepat (Default Aktif) */}
          <div className="flex flex-wrap items-center gap-5 pt-3 border-t border-olive-200 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyWithoutWebsite}
                onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                className="rounded border-olive-300 text-olive-500 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-olive-800">Hanya tanpa website</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeFranchise}
                onChange={(e) => setExcludeFranchise(e.target.checked)}
                className="rounded border-olive-300 text-olive-500 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-olive-800">Bukan franchise/waralaba besar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyValidWhatsApp}
                onChange={(e) => setOnlyValidWhatsApp(e.target.checked)}
                className="rounded border-olive-300 text-olive-500 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-olive-800">Hanya nomor WhatsApp valid (628xx)</span>
            </label>
          </div>
        </form>
      </div>

      {/* 2. PANEL EKSEKUSI BATCH (FONNTE & STATE MACHINE) */}
      <div className="bg-cream-50 border border-olive-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-olive-500 text-cream-50 flex items-center justify-center font-bold shadow-sm">
              <FontAwesomeIcon icon={faBolt} className="h-4 w-4 text-mint-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-olive-900 tracking-tight">
                Batch Automated Outreach Engine
              </h3>
              <p className="text-[11px] text-olive-600">
                Pengiriman Fonnte dengan jeda acak manusiawi 15–30 detik per nomor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                isRunning
                  ? isPaused
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-cream-200 text-olive-700 border-olive-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning && !isPaused ? 'bg-emerald-600 animate-pulse' : 'bg-olive-400'
                }`}
              />
              {isRunning
                ? isPaused
                  ? 'Pengiriman Dijeda'
                  : 'Engine Berjalan Otomatis'
                : 'Engine Siaga'}
            </span>
          </div>
        </div>

        {/* Metrik Antrean */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-cream-100 rounded-xl text-center border border-olive-100">
            <span className="text-[10px] font-bold text-olive-600 uppercase">Total Target Batch</span>
            <p className="text-2xl font-mono font-bold text-olive-900 mt-0.5">{totalLeads}</p>
            <span className="text-[10px] text-olive-500">{readyCount} siap kirim</span>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-xl text-center border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Sukses Terkirim</span>
            <p className="text-2xl font-mono font-bold text-emerald-800 mt-0.5">{sentCount}</p>
            <span className="text-[10px] text-emerald-600">Tersinkron ke Sheets</span>
          </div>
          <div className="p-3.5 bg-rose-50 rounded-xl text-center border border-rose-100">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Gagal Kirim</span>
            <p className="text-2xl font-mono font-bold text-rose-700 mt-0.5">{failedCount}</p>
            <span className="text-[10px] text-rose-500">Perlu ditinjau</span>
          </div>
          <div className="p-3.5 bg-amber-50 rounded-xl text-center border border-amber-100">
            <span className="text-[10px] font-bold text-amber-800 uppercase">Dilewati / Duplikat</span>
            <p className="text-2xl font-mono font-bold text-amber-900 mt-0.5">{skippedCount}</p>
            <span className="text-[10px] text-amber-600">Anti-Duplikasi</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-olive-800">Progress Pengiriman Batch</span>
            <span className="font-mono font-bold text-olive-700">
              {sentCount} / {totalLeads} ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-olive-400 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Live Countdown & Active Target Monitor */}
        {isRunning && (
          <div className="bg-olive-800 text-cream-50 rounded-xl p-4 space-y-2 border border-olive-700 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faSpinner} className="h-3.5 w-3.5 animate-spin text-mint-200" />
                <span className="font-semibold">
                  Sedang diproses: <span className="text-mint-100">{activeLead?.businessName || '-'}</span>
                </span>
              </div>
              <span className="font-mono text-mint-200 font-bold">{activeLead?.phone || '-'}</span>
            </div>
            {countdown > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-olive-700 text-xs">
                <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-mint-200" />
                <span>
                  Jeda keamanan acak:{' '}
                  <span className="font-mono text-xl font-bold text-cream-50 align-middle">
                    {countdown}
                  </span>{' '}
                  detik sebelum target berikutnya
                </span>
              </div>
            )}
          </div>
        )}

        {/* Kontrol Engine */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!isRunning ? (
            <button
              onClick={runBatchEngine}
              disabled={totalLeads === 0 || readyCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-olive-500 hover:bg-olive-600 disabled:opacity-40 disabled:cursor-not-allowed text-cream-50 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <FontAwesomeIcon icon={faPaperPlane} className="h-3.5 w-3.5 text-mint-200" />
              <span>Mulai Auto-Send Batch ({readyCount} Prospek)</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={handleResume}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPlay} className="h-3.5 w-3.5" />
                  <span>Lanjutkan Pengiriman</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  <FontAwesomeIcon icon={faPause} className="h-3.5 w-3.5" />
                  <span>Jeda Sementara</span>
                </button>
              )}
              <button
                onClick={handleStop}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                <FontAwesomeIcon icon={faStop} className="h-3.5 w-3.5" />
                <span>Hentikan Batch</span>
              </button>
            </>
          )}

          <button
            onClick={handleResetQueue}
            disabled={isRunning || totalLeads === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-olive-200 bg-cream-50 hover:bg-cream-200 text-olive-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ml-auto"
          >
            <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
            <span>Reset Antrean</span>
          </button>
        </div>
      </div>

      {/* 3. LIVE REALTIME LOGS */}
      <div className="bg-cream-50 border border-olive-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-olive-200 bg-olive-100/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-olive-600 animate-pulse" />
            <h4 className="text-xs font-bold text-olive-900 uppercase tracking-wider">
              Live Realtime Engine Logs
            </h4>
          </div>
          <button
            onClick={() => setLogs([])}
            disabled={logs.length === 0}
            className="text-[10px] font-semibold text-olive-600 hover:text-rose-600 cursor-pointer disabled:opacity-30"
          >
            <FontAwesomeIcon icon={faTrash} className="h-2.5 w-2.5 mr-1" />
            Bersihkan Log
          </button>
        </div>
        <div
          ref={logContainerRef}
          className="p-4 max-h-52 overflow-y-auto font-mono text-[11px] space-y-1.5 bg-cream-100/40"
        >
          {logs.length === 0 ? (
            <p className="text-olive-400 italic text-center py-4">Belum ada aktivitas batch log.</p>
          ) : (
            logs.map((log) => {
              const colorClass =
                log.type === 'error'
                  ? 'text-rose-700 font-semibold'
                  : log.type === 'skip'
                  ? 'text-amber-800'
                  : log.type === 'success'
                  ? 'text-emerald-700 font-semibold'
                  : log.type === 'warn'
                  ? 'text-amber-700'
                  : 'text-olive-700';

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-olive-400 shrink-0">[{log.timestamp}]</span>
                  <span className={colorClass}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. DAFTAR ANTREAN TARGET LEAD (BATCH 50 - 75) */}
      {leads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-olive-900 uppercase tracking-wider">
              Daftar Prospek Siap Kirim ({leads.length} Target)
            </h4>
            <span className="text-[11px] text-olive-600">
              Format baku: 628xxxxxxxxxx • Terlindungi anti-duplikasi
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leads.map((lead, idx) => {
              const statusBadge =
                lead.status === 'sent'
                  ? { label: 'Terkirim', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
                  : lead.status === 'sending'
                  ? { label: 'Mengirim...', bg: 'bg-blue-100 text-blue-800 border-blue-300' }
                  : lead.status === 'generating'
                  ? { label: 'Draft Gemini...', bg: 'bg-purple-100 text-purple-800 border-purple-300' }
                  : lead.status === 'failed'
                  ? { label: 'Gagal', bg: 'bg-rose-100 text-rose-800 border-rose-300' }
                  : lead.status === 'skipped'
                  ? { label: 'Dilewati', bg: 'bg-amber-100 text-amber-800 border-amber-300' }
                  : { label: 'Siap Kirim', bg: 'bg-cream-200 text-olive-700 border-olive-300' };

              return (
                <div
                  key={lead.id}
                  className={`bg-cream-50 border rounded-2xl p-4 shadow-sm flex flex-col justify-between transition ${
                    lead.status === 'sent'
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : lead.status === 'sending'
                      ? 'border-olive-500 ring-1 ring-mint-200'
                      : 'border-olive-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-olive-500">#{idx + 1}</span>
                          <h4 className="font-bold text-xs text-olive-900 truncate" title={lead.businessName}>
                            {lead.businessName}
                          </h4>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-olive-100 text-olive-700">
                            {lead.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-olive-600 truncate mt-0.5" title={lead.address}>
                          <FontAwesomeIcon icon={faMapMarkerAlt} className="h-2.5 w-2.5 mr-1 text-olive-400" />
                          {lead.city} • {lead.address}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${statusBadge.bg}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-olive-200 text-[11px]">
                      <div>
                        <span className="block text-[9px] font-bold text-olive-600 uppercase">WhatsApp</span>
                        <span className="font-mono font-medium text-olive-900 truncate block">
                          {formatPhoneDisplay(lead.phone)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-olive-600 uppercase">Website</span>
                        <span className="text-olive-700">
                          {lead.hasWebsite ? 'Ada' : 'Tanpa Web'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-olive-600 uppercase">Rating Maps</span>
                        <span className="font-mono font-medium text-olive-900">
                          {lead.rating > 0 ? `${lead.rating}★ (${lead.reviewsCount})` : '-'}
                        </span>
                      </div>
                    </div>

                    {lead.pitchMessage && (
                      <div className="p-2.5 rounded-xl bg-olive-50 border border-olive-200 text-[11px] text-olive-800 line-clamp-3 leading-relaxed">
                        &quot;{lead.pitchMessage}&quot;
                      </div>
                    )}

                    {lead.error && (
                      <p className="text-[10px] text-rose-600 font-semibold">
                        Error: {lead.error}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 flex items-center justify-between text-[11px]">
                    <a
                      href={`https://wa.me/${lead.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-olive-600 hover:text-olive-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Buka WA</span>
                    </a>
                    {lead.pitchMessage && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(lead.pitchMessage || '');
                          showToast('success', 'Pesan disalin!');
                        }}
                        className="text-olive-600 hover:text-olive-900 font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faCopy} className="h-3 w-3" />
                        <span>Salin Pesan</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
