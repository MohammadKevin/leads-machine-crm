'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperPlane,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faPause,
  faPlay,
  faStop,
  faExternalLinkSquare,
  faSync,
  faExclamationTriangle,
  faSquare,
  faCheckSquare,
  faMinusSquare,
  faBullseye,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { normalizeWhatsAppNumber, isValidWhatsApp } from '@/lib/phone-utils';
import type { LeadEntity } from '@/lib/lead-qualification';

interface SendProspect {
  id: string;
  businessName: string;
  phone: string;
  normalizedPhone: string;
  pitch: string;
  status: string;
  city?: string;
  category?: string;
}

interface QueueState {
  isRunning: boolean;
  isPaused: boolean;
  currentIndex: number;
  totalSelected: number;
  countdownSeconds: number;
  currentProspectName: string;
}

export default function SendPage() {
  const [allLeads, setAllLeads] = useState<SendProspect[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sentTodayCount, setSentTodayCount] = useState(0);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [optOutIds, setOptOutIds] = useState<Set<string>>(new Set());

  const [queue, setQueue] = useState<QueueState>({
    isRunning: false,
    isPaused: false,
    currentIndex: 0,
    totalSelected: 0,
    countdownSeconds: 0,
    currentProspectName: '',
  });

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const allLeadsRef = useRef(allLeads);
  allLeadsRef.current = allLeads;
  const abortRef = useRef(false);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/sheets');
      const data = await res.json();
      if (data.success && Array.isArray(data.remoteRecords)) {
        const prospects: SendProspect[] = data.remoteRecords
          .map((r: LeadEntity) => ({
            id: r.id,
            businessName: r.business_name,
            phone: r.phone_number,
            normalizedPhone: r.normalized_phone,
            pitch: r.generated_pitch || '',
            status: r.lead_status,
          }))
          .filter(
            (p: SendProspect) =>
              p.normalizedPhone &&
              p.pitch.trim().length > 0 &&
              p.status !== 'UNQUALIFIED_FRANCHISE' &&
              p.status !== 'UNQUALIFIED_CORPORATE'
          );

        setAllLeads(prospects);

        const contacted = data.contactedNumbers || [];
        setSentIds(new Set(contacted));

        const today = new Date().toISOString().slice(0, 10);
        let sentCount = 0;
        if (Array.isArray(data.remoteRecords)) {
          for (const r of data.remoteRecords) {
            if (
              r.lead_status === 'CONTACTED' &&
              r.last_sync_at &&
              r.last_sync_at.startsWith(today)
            ) {
              sentCount++;
            }
          }
        }
        setSentTodayCount(sentCount);
      } else {
        setSyncError(data.error || 'Gagal memuat data dari Google Sheets.');
      }
    } catch {
      setSyncError('Gagal menghubungkan ke Google Sheets.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSelectAll = () => {
    if (selectedIds.size === allLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allLeads.map((l) => l.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenWhatsApp = (prospect: SendProspect) => {
    const encodedText = encodeURIComponent(prospect.pitch);
    window.open(
      `https://wa.me/${prospect.normalizedPhone}?text=${encodedText}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleMarkSent = async (prospect: SendProspect) => {
    setSentIds((prev) => {
      const next = new Set(prev);
      next.add(prospect.normalizedPhone);
      return next;
    });
    setSentTodayCount((c) => c + 1);

    try {
      await fetch('/api/dispatch?markOnly=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: prospect.normalizedPhone,
          message: prospect.pitch,
          businessName: prospect.businessName,
        }),
      });
    } catch {
      // silent
    }

    setAllLeads((prev) =>
      prev.map((l) =>
        l.id === prospect.id ? { ...l, status: 'CONTACTED' } : l
      )
    );

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(prospect.id);
      return next;
    });
  };

  const handleMarkOptOut = async (prospect: SendProspect) => {
    setOptOutIds((prev) => {
      const next = new Set(prev);
      next.add(prospect.id);
      return next;
    });

    try {
      const targetUrl =
        (process.env as Record<string, string>).NEXT_PUBLIC_LEADS_SHEET_API ||
        '';
      if (targetUrl) {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_name: prospect.businessName,
            phone_number: prospect.phone,
            normalized_phone: prospect.normalizedPhone,
            lead_status: 'LOST_REJECTED',
            rejection_reason: 'No Response',
            last_sync_at: new Date().toISOString(),
          }),
        });
      }
    } catch {
      // silent
    }

    setAllLeads((prev) => prev.filter((l) => l.id !== prospect.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(prospect.id);
      return next;
    });
  };

  const dispatchOne = async (prospect: SendProspect): Promise<boolean> => {
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: prospect.id,
          phone: prospect.normalizedPhone,
          message: prospect.pitch,
          businessName: prospect.businessName,
        }),
      });
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  };

  const startAutoSend = async () => {
    const currentSelected = [...selectedIdsRef.current];
    if (currentSelected.length === 0) return;

    abortRef.current = false;

    const targets = currentSelected
      .map((id) => allLeadsRef.current.find((l) => l.id === id))
      .filter(Boolean) as SendProspect[];

    const filtered = targets.filter(
      (t) => !sentIds.has(t.normalizedPhone) && !optOutIds.has(t.id)
    );

    if (filtered.length === 0) return;

    setQueue({
      isRunning: true,
      isPaused: false,
      currentIndex: 0,
      totalSelected: filtered.length,
      countdownSeconds: 0,
      currentProspectName: '',
    });

    for (let i = 0; i < filtered.length; i++) {
      if (abortRef.current) break;

      const prospect = filtered[i];

      setQueue((prev) => ({
        ...prev,
        currentIndex: i,
        currentProspectName: prospect.businessName,
      }));

      const success = await dispatchOne(prospect);

      if (success) {
        setSentIds((prev) => {
          const next = new Set(prev);
          next.add(prospect.normalizedPhone);
          return next;
        });
        setSentTodayCount((c) => c + 1);

        setAllLeads((prev) =>
          prev.map((l) =>
            l.id === prospect.id ? { ...l, status: 'CONTACTED' } : l
          )
        );
      }

      if (i < filtered.length - 1 && !abortRef.current) {
        const jitterMs =
          Math.floor(Math.random() * (70 - 35 + 1) + 35) * 1000;
        const totalSeconds = Math.ceil(jitterMs / 1000);

        for (let s = totalSeconds; s >= 0; s--) {
          if (abortRef.current) break;

          const paused = queueRef.current.isPaused;
          if (paused) {
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (!queueRef.current.isPaused || abortRef.current) {
                  clearInterval(check);
                  resolve();
                }
              }, 500);
            });
            if (abortRef.current) break;
          }

          setQueue((prev) => ({
            ...prev,
            countdownSeconds: s,
            currentProspectName: prospect.businessName,
          }));
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    setQueue({
      isRunning: false,
      isPaused: false,
      currentIndex: 0,
      totalSelected: 0,
      countdownSeconds: 0,
      currentProspectName: '',
    });
  };

  const handlePause = () => {
    setQueue((prev) => ({ ...prev, isPaused: true }));
  };

  const handleResume = () => {
    setQueue((prev) => ({ ...prev, isPaused: false }));
  };

  const handleStop = () => {
    abortRef.current = true;
    setQueue({
      isRunning: false,
      isPaused: false,
      currentIndex: 0,
      totalSelected: 0,
      countdownSeconds: 0,
      currentProspectName: '',
    });
  };

  const availableLeads = allLeads.filter(
    (l) => !sentIds.has(l.normalizedPhone) && !optOutIds.has(l.id)
  );

  const allSelected = selectedIds.size === availableLeads.length && availableLeads.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="min-h-screen bg-cream-100 text-olive-900 antialiased font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-olive-900">
              Kirim Pesan Manual & Auto Dispatch
            </h1>
            <p className="text-xs text-olive-600 mt-0.5">
              Pilih prospek dan kirim pesan via Foonte atau manual WhatsApp Web
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchLeads}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cream-50 border border-olive-200 text-olive-700 hover:bg-olive-100 transition cursor-pointer disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faSync} className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-olive-500 text-cream-50 text-xs font-semibold shadow-sm">
              <FontAwesomeIcon icon={faBullseye} className="h-3 w-3 text-mint-200" />
              Terkirim Hari Ini: {sentTodayCount}
            </div>
          </div>
        </div>

        {/* Sync Error */}
        {syncError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <FontAwesomeIcon icon={faExclamationTriangle} className="h-3.5 w-3.5 shrink-0" />
            {syncError}
          </div>
        )}

        {/* Queue Controller */}
        {queue.isRunning && (
          <div className="p-4 rounded-xl border border-olive-200 bg-cream-50 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-olive-500 animate-pulse" />
                <span className="text-xs font-semibold text-olive-800">
                  Antrean Berjalan: {queue.currentIndex + 1} / {queue.totalSelected}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {queue.countdownSeconds > 0 && (
                  <span className="text-xs font-mono text-olive-600 bg-olive-100 px-2 py-1 rounded-md">
                    Menunggu {queue.countdownSeconds}s sebelum kirim ke <strong>{queue.currentProspectName || '...'}</strong>
                  </span>
                )}
                {!queue.isPaused ? (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPause} className="h-3 w-3" />
                    Pause
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-mint-100 border border-mint-200 text-olive-800 hover:bg-mint-200 transition cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
                    Resume
                  </button>
                )}
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 transition cursor-pointer"
                >
                  <FontAwesomeIcon icon={faStop} className="h-3 w-3" />
                  Stop Antrean
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-olive-700">
            <span className="font-medium">
              {availableLeads.length} prospek tersedia
            </span>
            {selectedIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-olive-500 text-cream-50 font-semibold">
                {selectedIds.size} dipilih
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startAutoSend}
              disabled={selectedIds.size === 0 || queue.isRunning}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-olive-500 text-cream-50 shadow-sm hover:bg-olive-600 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon
                icon={queue.isRunning ? faSpinner : faPaperPlane}
                className={`h-3.5 w-3.5 ${queue.isRunning ? 'animate-spin' : ''}`}
              />
              Mulai Kirim Otomatis via Foonte
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-olive-600">
              <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Memuat data dari Google Sheets...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && availableLeads.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-full bg-cream-200 flex items-center justify-center mb-4">
              <FontAwesomeIcon icon={faPaperPlane} className="h-6 w-6 text-olive-400" />
            </div>
            <p className="text-sm font-medium text-olive-600">Tidak ada prospek yang siap dikirim.</p>
            <p className="text-xs text-olive-500 mt-1">
              Semua prospek sudah dikontak atau belum memiliki pitch.
            </p>
          </div>
        )}

        {/* Prospect Table */}
        {!isLoading && availableLeads.length > 0 && (
          <div className="rounded-xl border border-olive-200 bg-cream-50 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-olive-200 bg-olive-50">
                    <th className="w-10 px-3 py-2.5 text-left">
                      <button
                        onClick={handleSelectAll}
                        className="cursor-pointer text-olive-500 hover:text-olive-800"
                      >
                        <FontAwesomeIcon
                          icon={
                            allSelected
                              ? faCheckSquare
                              : someSelected
                              ? faMinusSquare
                              : faSquare
                          }
                          className="h-4 w-4"
                        />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-olive-700">
                      Nama Bisnis
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-olive-700 hidden sm:table-cell">
                      Nomor WA
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-olive-700 hidden md:table-cell">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-center font-semibold text-olive-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive-100">
                  {availableLeads.map((prospect) => {
                    const isSelected = selectedIds.has(prospect.id);
                    const isSent = sentIds.has(prospect.normalizedPhone);
                    return (
                      <tr
                        key={prospect.id}
                        className={`transition ${
                          isSelected
                            ? 'bg-mint-50'
                            : isSent
                            ? 'bg-cream-200 opacity-60'
                            : 'hover:bg-cream-100'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => handleToggleSelect(prospect.id)}
                            disabled={queue.isRunning}
                            className="cursor-pointer text-olive-500 hover:text-olive-800 disabled:opacity-40"
                          >
                            <FontAwesomeIcon
                              icon={isSelected ? faCheckSquare : faSquare}
                              className="h-4 w-4"
                            />
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-olive-900">
                            {prospect.businessName}
                          </div>
                          <div className="text-[11px] text-olive-600 sm:hidden mt-0.5">
                            +62 {prospect.normalizedPhone.slice(2)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <span className="font-mono text-olive-700">
                            +62 {prospect.normalizedPhone.slice(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              isSent
                                ? 'bg-mint-100 text-olive-700'
                                : prospect.status === 'CONTACTED'
                                ? 'bg-olive-100 text-olive-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {isSent ? 'TERKIRIM' : prospect.status === 'CONTACTED' ? 'CONTACTED' : 'SIAP KIRIM'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Manual WA Button */}
                            <button
                              onClick={() => handleOpenWhatsApp(prospect)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-mint-100 text-olive-700 border border-mint-200 hover:bg-mint-200 transition cursor-pointer"
                              title="Buka WhatsApp Web"
                            >
                              <FontAwesomeIcon
                                icon={faExternalLinkSquare}
                                className="h-3 w-3"
                              />
                              <span className="hidden sm:inline">Buka WA</span>
                            </button>

                            {/* Mark Sent Button */}
                            {!isSent && (
                              <button
                                onClick={() => handleMarkSent(prospect)}
                                disabled={queue.isRunning}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-olive-500 text-cream-50 hover:bg-olive-600 transition cursor-pointer disabled:opacity-40"
                                title="Tandai Terkirim"
                              >
                                <FontAwesomeIcon
                                  icon={faCheckCircle}
                                  className="h-3 w-3"
                                />
                                <span className="hidden sm:inline">Terkirim</span>
                              </button>
                            )}

                            {/* Opt-Out Button */}
                            <button
                              onClick={() => handleMarkOptOut(prospect)}
                              disabled={queue.isRunning}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer disabled:opacity-40"
                              title="Tandai OPTED_OUT"
                            >
                              <FontAwesomeIcon
                                icon={faTimesCircle}
                                className="h-3 w-3"
                              />
                              <span className="hidden sm:inline">Opt-Out</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}