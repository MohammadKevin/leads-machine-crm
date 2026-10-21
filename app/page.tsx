'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import OutreachMachine from '@/components/OutreachMachine';
import HistoryPanel from '@/components/HistoryPanel';
import PrototypeStudioTab from '@/components/prototype/PrototypeStudioTab';
import {
  SheetLeadRecord,
  OutreachMetrics,
  OutreachLead,
  SheetResponseStatus,
} from '@/types/outreach';

type TabId = 'outreach' | 'history' | 'prototype';

interface Toast {
  type: 'success' | 'error' | 'warn';
  message: string;
  id: number;
}

function AppInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId =
    tabParam === 'history' ? 'history' : tabParam === 'prototype' ? 'prototype' : 'outreach';

  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());
  const [sheetRecords, setSheetRecords] = useState<SheetLeadRecord[]>([]);
  const [selectedLeadForPrototype, setSelectedLeadForPrototype] = useState<SheetLeadRecord | null>(null);
  const [metrics, setMetrics] = useState<OutreachMetrics>({
    totalUniqueContacted: 0,
    interestedCount: 0,
    closingDealCount: 0,
    inProgressCount: 0,
    rejectedCount: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingFonnte, setIsSyncingFonnte] = useState(false);
  const [isDataToolsOpen, setIsDataToolsOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [geraiToken, setGeraiToken] = useState<{
    tokens: number | null;
    formattedTokens: string;
    fullTokensFormatted?: string;
    usedInSession: number;
    source?: string;
  }>({
    tokens: null,
    formattedTokens: 'Claude Aktif',
    usedInSession: 0,
  });
  const [isGeraiModalOpen, setIsGeraiModalOpen] = useState(false);
  const [isCheckingGerai, setIsCheckingGerai] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [manualTokenInput, setManualTokenInput] = useState('');

  const goTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleOpenPrototype = useCallback(
    (record: SheetLeadRecord | OutreachLead) => {
      const isSheetRecord =
        'status' in record &&
        typeof record.status === 'string' &&
        ['CONTACTED', 'INTERESTED', 'IN_PROGRESS', 'CLOSED_DEAL', 'REJECTED'].includes(record.status);

      const messageSent =
        ('messageSent' in record && record.messageSent) ||
        ('pitchMessage' in record && (record as OutreachLead).pitchMessage) ||
        undefined;

      const sheetFormat: SheetLeadRecord = isSheetRecord
        ? { ...(record as SheetLeadRecord), messageSent: (record as SheetLeadRecord).messageSent || messageSent }
        : {
            id: record.id,
            businessName: record.businessName,
            category: record.category,
            city: record.city,
            phone: record.phone,
            normalizedPhone: record.phone,
            rating: record.rating,
            reviewsCount: record.reviewsCount,
            hasWebsite: record.hasWebsite,
            website: record.website,
            status: 'CONTACTED',
            messageSent,
          };
      setSelectedLeadForPrototype(sheetFormat);
      goTab('prototype');
    },
    [goTab]
  );

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-3), { type, message, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const syncFromSheets = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/outreach/blacklist', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const rawText = await res.text().catch(() => '');
      let data: {
        success?: boolean;
        blacklist?: string[];
        records?: SheetLeadRecord[];
        metrics?: OutreachMetrics;
        error?: string;
      } | null = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { success: false, error: 'Format data Google Sheets tidak sesuai.' };
      }

      if (res.ok && data?.success) {
        const blacklistSet = new Set<string>(data.blacklist || []);
        setBlacklist(blacklistSet);
        if (Array.isArray(data.records)) {
          setSheetRecords(data.records);
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        showToast('success', `Tersinkron dengan ${blacklistSet.size} nomor terverifikasi di Sheets.`);
      } else {
        showToast('error', data?.error || 'Gagal menyinkronkan data dari Google Sheets.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan saat sync Sheets.';
      showToast('error', msg);
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const syncGeraiTokens = useCallback(
    async (customToken?: string, manualAmount?: number) => {
      setIsCheckingGerai(true);
      try {
        if (typeof manualAmount === 'number' && !isNaN(manualAmount)) {
          localStorage.setItem('gk_remaining_tokens', String(manualAmount));
          const formatted = manualAmount >= 1000 ? `${Math.round(manualAmount / 1000)}K Token` : `${manualAmount} Token`;
          setGeraiToken((prev) => ({
            ...prev,
            tokens: manualAmount,
            formattedTokens: formatted,
            fullTokensFormatted: `${manualAmount.toLocaleString('id-ID')} Token`,
            source: 'manual',
          }));
          showToast('success', `Sisa token disetel: ${manualAmount.toLocaleString('id-ID')} Token`);
          setIsCheckingGerai(false);
          return;
        }

        const tokenToSend =
          customToken ||
          (typeof window !== 'undefined' ? localStorage.getItem('gk_session_cookie') : '') ||
          '';

        if (tokenToSend) {
          const res = await fetch('/api/geraikita/balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookieToken: tokenToSend }),
          });
          const json = await res.json();
          if (res.ok && json.success && typeof json.tokens === 'number') {
            if (typeof window !== 'undefined') {
              localStorage.setItem('gk_session_cookie', tokenToSend);
              localStorage.setItem('gk_remaining_tokens', String(json.tokens));
            }
            setGeraiToken((prev) => ({
              ...prev,
              tokens: json.tokens,
              formattedTokens: json.formattedTokens,
              fullTokensFormatted: json.fullTokensFormatted || `${json.tokens.toLocaleString('id-ID')} Token`,
              source: 'live_api',
            }));
            showToast('success', `Sisa token tersinkronisasi: ${json.fullTokensFormatted || json.formattedTokens}`);
            return;
          } else if (customToken) {
            showToast('error', json.error || 'Sesi token ai.geraikita.com tidak valid.');
          }
        }

        const savedTokens =
          typeof window !== 'undefined'
            ? localStorage.getItem('gk_remaining_tokens') || localStorage.getItem('gk_manual_balance')
            : null;
        if (savedTokens) {
          const num = parseInt(savedTokens, 10);
          if (!isNaN(num)) {
            const formatted = num >= 1000 ? `${Math.round(num / 1000)}K Token` : `${num} Token`;
            setGeraiToken((prev) => ({
              ...prev,
              tokens: num,
              formattedTokens: formatted,
              fullTokensFormatted: `${num.toLocaleString('id-ID')} Token`,
              source: 'manual',
            }));
          }
        }

        const res = await fetch('/api/geraikita/balance');
        const json = await res.json();
        if (res.ok && json.success && typeof json.tokens === 'number') {
          setGeraiToken((prev) => ({
            ...prev,
            tokens: json.tokens,
            formattedTokens: json.formattedTokens,
            fullTokensFormatted: json.fullTokensFormatted,
            source: json.source,
          }));
        }
      } catch {
        // ignore
      } finally {
        setIsCheckingGerai(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    syncGeraiTokens();
  }, [syncGeraiTokens]);

  useEffect(() => {
    const handleDeduction = (e: Event) => {
      const custom = e as CustomEvent<{ tokens?: number }>;
      const deducted = custom.detail?.tokens || 0;
      if (deducted > 0) {
        setGeraiToken((prev) => {
          const current = prev.tokens;
          const nextVal = current !== null ? Math.max(0, current - deducted) : null;
          if (nextVal !== null && typeof window !== 'undefined') {
            localStorage.setItem('gk_remaining_tokens', String(nextVal));
          }
          return {
            ...prev,
            tokens: nextVal,
            formattedTokens:
              nextVal !== null
                ? nextVal >= 1000
                  ? `${Math.round(nextVal / 1000)}K Token`
                  : `${nextVal} Token`
                : 'Claude Aktif',
            fullTokensFormatted: nextVal !== null ? `${nextVal.toLocaleString('id-ID')} Token` : 'Claude Aktif',
            usedInSession: prev.usedInSession + deducted,
          };
        });
      }
    };

    window.addEventListener('gk-token-deducted', handleDeduction);
    return () => window.removeEventListener('gk-token-deducted', handleDeduction);
  }, []);

  const handleSyncFonnteFile = async () => {
    setIsSyncingFonnte(true);
    try {
      const res = await fetch('/api/sync-fonnte-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        showToast('success', json.message || 'Riwayat Fonnte berhasil disinkronkan ke Sheets.');
        await syncFromSheets();
      } else {
        showToast('error', json?.error || 'Gagal membaca riwayat Fonnte.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan koneksi saat sync Fonnte.';
      showToast('error', msg);
    } finally {
      setIsSyncingFonnte(false);
    }
  };

  const handleBulkImportWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim() || isImporting) return;

    setIsImporting(true);
    try {
      const res = await fetch('/api/sync-wa-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: importText }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        showToast(
          'success',
          `Berhasil mengimpor ${json.importedCount} nomor unik WhatsApp ke Google Sheets!`
        );
        setImportText('');
        setIsImportModalOpen(false);
        await syncFromSheets();
      } else {
        showToast('error', json?.error || 'Gagal memproses daftar nomor WhatsApp.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan.';
      showToast('error', msg);
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    syncFromSheets();
  }, [syncFromSheets]);

  const handleContactSentSuccess = useCallback((phone: string, lead: OutreachLead) => {
    setBlacklist((prev) => new Set([...prev, phone]));
    const rec: SheetLeadRecord = {
      id: `rec-${phone}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      businessName: lead.businessName,
      category: lead.category,
      city: lead.city,
      phone: lead.phone,
      normalizedPhone: lead.phone,
      mapsUrl: lead.address,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      hasWebsite: lead.hasWebsite,
      website: lead.website,
      status: 'CONTACTED',
      messageSent: lead.pitchMessage || '',
      lastSyncAt: new Date().toISOString(),
    };
    setSheetRecords((prev) => [rec, ...prev]);
    setMetrics((prev) => ({
      ...prev,
      totalUniqueContacted: prev.totalUniqueContacted + 1,
    }));
  }, []);

  const handleUpdateStatus = useCallback(
    async (phone: string, newStatus: SheetResponseStatus): Promise<boolean> => {
      const prev = [...sheetRecords];
      const target = prev.find((r) => r.normalizedPhone === phone);
      if (!target) return false;
      const oldStatus = target.status;

      setSheetRecords((all) =>
        all.map((r) => (r.normalizedPhone === phone ? { ...r, status: newStatus } : r))
      );
      setMetrics((m) => {
        const delta = (key: SheetResponseStatus, dir: 1 | -1) =>
          key === 'INTERESTED'
            ? { interestedCount: m.interestedCount + dir }
            : key === 'CLOSED_DEAL'
            ? { closingDealCount: m.closingDealCount + dir }
            : key === 'IN_PROGRESS'
            ? { inProgressCount: m.inProgressCount + dir }
            : key === 'REJECTED'
            ? { rejectedCount: m.rejectedCount + dir }
            : {};
        return {
          ...m,
          ...delta(oldStatus, -1),
          ...delta(newStatus, 1),
          interestedCount: Math.max(
            0,
            m.interestedCount + (newStatus === 'INTERESTED' ? 1 : 0) + (oldStatus === 'INTERESTED' ? -1 : 0)
          ),
          closingDealCount: Math.max(
            0,
            m.closingDealCount + (newStatus === 'CLOSED_DEAL' ? 1 : 0) + (oldStatus === 'CLOSED_DEAL' ? -1 : 0)
          ),
          inProgressCount: Math.max(
            0,
            m.inProgressCount + (newStatus === 'IN_PROGRESS' ? 1 : 0) + (oldStatus === 'IN_PROGRESS' ? -1 : 0)
          ),
          rejectedCount: Math.max(
            0,
            m.rejectedCount + (newStatus === 'REJECTED' ? 1 : 0) + (oldStatus === 'REJECTED' ? -1 : 0)
          ),
        };
      });

      try {
        const res = await fetch('/api/sheets/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            status: newStatus,
            businessName: target.businessName,
          }),
        });
        const json = await res.json();
        if (res.ok && json.success) return true;
        setSheetRecords(prev);
        showToast('error', 'Gagal update status di Sheets — perubahan dibatalkan.');
        return false;
      } catch {
        setSheetRecords(prev);
        showToast('error', 'Kesalahan jaringan — status dikembalikan.');
        return false;
      }
    },
    [sheetRecords, showToast]
  );

  const hotCount = sheetRecords.filter(
    (r) => r.status === 'INTERESTED' || r.status === 'IN_PROGRESS'
  ).length;
  const closedCount = sheetRecords.filter((r) => r.status === 'CLOSED_DEAL').length;
  const currentRevenue = closedCount * 2500000;
  const progressPercent = Math.min(100, Math.round((currentRevenue / 25000000) * 100));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAFAFA] text-on-surface antialiased font-sans">
      <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0B0F14] border-r border-[#1F2937] z-50 flex flex-col justify-between p-4">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#059669] text-white flex items-center justify-center font-bold text-xs">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                </div>
                <span className="text-[14px] font-medium text-white tracking-tight">Leads Machine</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                v3.2
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1F2937]/60">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#059669]"></span>
              </span>
              <span className="text-[11px] text-slate-400">Sheets terhubung</span>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => goTab('outreach')}
              className={`h-9 flex items-center justify-between px-3 rounded-md transition-colors cursor-pointer ${
                activeTab === 'outreach'
                  ? 'bg-[#161F2E] text-white border-l-2 border-[#059669] font-medium'
                  : 'text-[13px] text-slate-400 hover:text-slate-200 hover:bg-[#161F2E]/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[16px]">radar</span>
                <span>Radar Klien</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => goTab('history')}
              className={`h-9 flex items-center justify-between px-3 rounded-md transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#161F2E] text-white border-l-2 border-[#059669] font-medium'
                  : 'text-[13px] text-slate-400 hover:text-slate-200 hover:bg-[#161F2E]/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[16px]">view_kanban</span>
                <span>Deal Room</span>
              </div>
              {hotCount > 0 && (
                <span className="bg-amber-500/10 text-amber-500 font-mono text-[11px] px-1.5 py-0.5 rounded font-medium">
                  {hotCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => goTab('prototype')}
              className={`h-9 flex items-center justify-between px-3 rounded-md transition-colors cursor-pointer ${
                activeTab === 'prototype'
                  ? 'bg-[#161F2E] text-white border-l-2 border-[#059669] font-medium'
                  : 'text-[13px] text-slate-400 hover:text-slate-200 hover:bg-[#161F2E]/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                <span>Prototype Studio</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="bg-[#111827] border border-[#1F2937] p-3 rounded-lg text-left">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Misi 16 Maret 2027</div>
          <div className="text-[12px] font-mono font-medium text-white mt-1">
            Rp {currentRevenue.toLocaleString('id-ID')}{' '}
            <span className="text-slate-400 font-normal">/ Rp 25.000.000</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-[#059669] h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 flex justify-between items-center">
            <span>Kemajuan</span>
            <span className="text-slate-300 font-medium">{closedCount} dari 10 deal</span>
          </div>
        </div>
      </aside>

      <div className="pl-[240px] flex-1 flex flex-col h-full overflow-hidden">
        <header className="fixed top-0 left-[240px] right-0 h-14 bg-white border-b border-[#E5E7EB] z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#0F172A]">
              <span className="text-slate-400 font-normal">Cockpit</span>
              <span className="text-slate-300">/</span>
              <span>
                {activeTab === 'outreach'
                  ? 'Radar Klien'
                  : activeTab === 'history'
                  ? 'Deal Room'
                  : 'Prototype Studio'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsGeraiModalOpen(true)}
              className="text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Klik untuk melihat & mengelola sisa token GeraiKita AI"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669] animate-pulse"></span>
              <span className="font-semibold">
                {geraiToken.tokens !== null
                  ? `Sisa: ${geraiToken.tokens.toLocaleString('id-ID')} Token`
                  : 'Token: Aktif'}
              </span>
              <span className="material-symbols-outlined text-[13px] text-emerald-600">generating_tokens</span>
            </button>

            <button
              onClick={syncFromSheets}
              disabled={isSyncing}
              className="text-[12px] font-medium border border-[#E5E7EB] hover:bg-slate-50 px-3 py-1.5 rounded-[6px] text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              type="button"
            >
              <span className={`material-symbols-outlined text-[15px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{isSyncing ? 'Menyinkronkan…' : 'Sinkron Sheets'}</span>
            </button>

            <div className="relative flex items-center">
              <button
                onClick={() => setIsDataToolsOpen(!isDataToolsOpen)}
                className="text-[12px] font-medium border border-[#E5E7EB] hover:bg-slate-50 px-3 py-1.5 rounded-[6px] text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                type="button"
              >
                <span>Alat Data</span>
                <span className="material-symbols-outlined text-[15px]">expand_more</span>
              </button>

              {isDataToolsOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-1.5 z-50 text-xs">
                  <button
                    onClick={() => {
                      setIsDataToolsOpen(false);
                      setIsImportModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded flex items-center gap-2 text-slate-700 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">upload</span>
                    <span>Import WA Lama</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsDataToolsOpen(false);
                      handleSyncFonnteFile();
                    }}
                    disabled={isSyncingFonnte}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded flex items-center gap-2 text-emerald-700 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">table_view</span>
                    <span>Sync Fonnte-History.xlsx</span>
                  </button>
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-full bg-[#059669] text-white flex items-center justify-center font-bold text-xs">
              <span className="material-symbols-outlined text-white text-[18px]">person</span>
            </div>
          </div>
        </header>

        <main className="w-full pt-14 min-h-screen bg-[#FAFAFA] overflow-y-auto">
          <div className="max-w-[1440px] mx-auto p-6 lg:p-8">
            {activeTab === 'outreach' && (
              <OutreachMachine
                blacklist={blacklist}
                onContactSentSuccess={handleContactSentSuccess}
                showToast={showToast}
                onSyncSuccess={syncFromSheets}
                onOpenPrototype={handleOpenPrototype}
              />
            )}

            {activeTab === 'history' && (
              <HistoryPanel
                records={sheetRecords}
                metrics={metrics}
                isSyncing={isSyncing}
                onSync={syncFromSheets}
                onUpdateStatus={handleUpdateStatus}
                showToast={showToast}
                onOpenPrototype={handleOpenPrototype}
              />
            )}

            {activeTab === 'prototype' && (
              <PrototypeStudioTab
                sheetRecords={sheetRecords}
                initialSelectedLead={selectedLeadForPrototype}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">upload</span>
                <h3 className="text-sm font-semibold text-slate-900">Import Nomor WA Lama</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkImportWa} className="p-4 flex flex-col gap-3">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Tempel nomor WA di sini, pisahkan baris atau koma (contoh: 08123456789, 628987654321)..."
                rows={6}
                className="w-full p-2.5 text-xs rounded-lg border border-slate-200 font-mono focus:ring-1 focus:ring-slate-900 outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importText.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white rounded-md cursor-pointer"
                >
                  {isImporting ? 'Mengimpor…' : 'Impor ke Sheets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGeraiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  <span className="material-symbols-outlined text-[16px]">generating_tokens</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Sisa Token &amp; Kuota GeraiKita AI</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGeraiModalOpen(false)}
                className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-4 rounded-lg bg-slate-900 text-white flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>SISA TOKEN AKTIF</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Gateway Aktif
                  </span>
                </div>
                <div className="text-[26px] font-bold font-mono text-emerald-400 leading-tight flex items-baseline gap-1.5">
                  <span>{geraiToken.tokens !== null ? geraiToken.tokens.toLocaleString('id-ID') : 'Aktif'}</span>
                  <span className="text-xs font-normal text-slate-400">Token</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                  <span>Model: claude-sonnet-4-6</span>
                  <span>
                    Terpakai sesi ini: <strong className="text-slate-200">{geraiToken.usedInSession.toLocaleString('id-ID')}</strong> Token
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Preset Kuota Cepat:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[100000, 250000, 500000, 1000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        syncGeraiTokens(undefined, amt);
                        setIsGeraiModalOpen(false);
                      }}
                      className="py-1.5 px-2 rounded-[6px] border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-[11px] font-medium text-slate-700 hover:text-emerald-800 transition cursor-pointer text-center"
                    >
                      {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Setel Sisa Token Manual:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="contoh: 450000"
                    className="flex-1 h-8 px-2.5 rounded-[6px] border border-slate-200 text-xs font-mono focus:border-slate-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = parseInt(manualTokenInput, 10);
                      if (!isNaN(num) && num >= 0) {
                        syncGeraiTokens(undefined, num);
                        setManualTokenInput('');
                        setIsGeraiModalOpen(false);
                      } else {
                        showToast('error', 'Masukkan angka jumlah sisa token yang valid.');
                      }
                    }}
                    className="h-8 px-3 rounded-[6px] bg-[#0F172A] hover:bg-slate-800 text-white font-medium text-xs transition cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Sinkronisasi Otomatis (Live Token):
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    placeholder="Tempel token sesi ai.geraikita.com..."
                    className="flex-1 h-8 px-2.5 rounded-[6px] border border-slate-200 text-xs font-mono focus:border-slate-400 outline-none"
                  />
                  <button
                    type="button"
                    disabled={isCheckingGerai || !cookieInput.trim()}
                    onClick={async () => {
                      await syncGeraiTokens(cookieInput);
                      setCookieInput('');
                    }}
                    className="h-8 px-3 rounded-[6px] border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isCheckingGerai ? 'Sinkron…' : 'Sync Live'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Sesi live didekripsi langsung via enkripsi AES-256-CBC dari api.geraikita.com.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <a
                  href="https://ai.geraikita.com/topup"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>Buka Top Up ai.geraikita.com</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>

                <button
                  type="button"
                  onClick={() => setIsGeraiModalOpen(false)}
                  className="h-8 px-4 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3 py-2 rounded-lg text-xs font-medium shadow-md flex items-center gap-2 animate-fade-in ${
                t.type === 'success'
                  ? 'bg-emerald-800 text-white'
                  : t.type === 'error'
                  ? 'bg-rose-800 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-[#FAFAFA] text-slate-500 font-mono text-xs">
          Memuat Leads Machine…
        </div>
      }
    >
      <AppInner />
    </Suspense>
  );
}