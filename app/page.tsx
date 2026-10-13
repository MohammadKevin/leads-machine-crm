'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Zap,
  History,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Radio,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  User,
  Sliders,
} from 'lucide-react';
import OutreachMachine from '@/components/OutreachMachine';
import HistoryPanel from '@/components/HistoryPanel';
import {
  SheetLeadRecord,
  OutreachMetrics,
  OutreachLead,
  SheetResponseStatus,
} from '@/types/outreach';

type TabId = 'outreach' | 'history';

interface Toast {
  type: 'success' | 'error' | 'warn';
  message: string;
  id: number;
}

// ── Inner component (uses searchParams) ──────────────────────────────────────
function AppInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam === 'history' ? 'history' : 'outreach';

  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());
  const [sheetRecords, setSheetRecords] = useState<SheetLeadRecord[]>([]);
  const [metrics, setMetrics] = useState<OutreachMetrics>({
    totalUniqueContacted: 0,
    interestedCount: 0,
    closingDealCount: 0,
    inProgressCount: 0,
    rejectedCount: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Tab navigation ──────────────────────────────────────────────────────────
  const goTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  // ── Toast System ────────────────────────────────────────────────────────────
  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-3), { type, message, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Sync Sheets (blacklist + records) ───────────────────────────────────────
  const syncFromSheets = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/outreach/blacklist', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nums: string[] = data.blacklist || [];
        setBlacklist(new Set(nums));
        setSheetRecords(data.records || []);
        if (data.metrics) setMetrics(data.metrics);
        showToast('success', `Anti-duplikasi aktif — ${nums.length} nomor terproteksi.`);
      } else {
        showToast('warn', data.error || 'Gagal memuat data Google Sheets.');
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Kesalahan jaringan.');
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  useEffect(() => {
    syncFromSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Callback when WA is sent successfully ──────────────────────────────────
  const handleContactSentSuccess = useCallback(
    (phone: string, lead: OutreachLead) => {
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
    },
    []
  );

  // ── Optimistic Status Update to Sheets ──────────────────────────────────────
  const handleUpdateStatus = useCallback(
    async (phone: string, newStatus: SheetResponseStatus): Promise<boolean> => {
      const prev = [...sheetRecords];
      const target = prev.find((r) => r.normalizedPhone === phone);
      if (!target) return false;
      const oldStatus = target.status;

      // Optimistic update
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
          interestedCount: Math.max(0, m.interestedCount + (newStatus === 'INTERESTED' ? 1 : 0) + (oldStatus === 'INTERESTED' ? -1 : 0)),
          closingDealCount: Math.max(0, m.closingDealCount + (newStatus === 'CLOSED_DEAL' ? 1 : 0) + (oldStatus === 'CLOSED_DEAL' ? -1 : 0)),
          inProgressCount: Math.max(0, m.inProgressCount + (newStatus === 'IN_PROGRESS' ? 1 : 0) + (oldStatus === 'IN_PROGRESS' ? -1 : 0)),
          rejectedCount: Math.max(0, m.rejectedCount + (newStatus === 'REJECTED' ? 1 : 0) + (oldStatus === 'REJECTED' ? -1 : 0)),
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
        setSheetRecords(prev); // rollback
        showToast('error', 'Gagal update status di Sheets — perubahan dibatalkan.');
        return false;
      } catch {
        setSheetRecords(prev); // rollback
        showToast('error', 'Kesalahan jaringan — status dikembalikan.');
        return false;
      }
    },
    [sheetRecords, showToast]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">

      {/* ═════════════════════════════════════════════════════════════
          1.1 SIDEBAR KIRI (Fixed, lebar 260px)
      ═════════════════════════════════════════════════════════════ */}
      <aside className="w-[260px] shrink-0 h-full bg-white border-r border-slate-200 flex flex-col justify-between z-20 select-none">
        
        {/* Top Section */}
        <div className="p-4 flex flex-col gap-6">

          {/* Header Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
                    Leads Machine
                  </h1>
                  <span className="text-[10px] text-slate-400 font-medium">B2B SaaS Engine</span>
                </div>
              </div>

              {/* Badge pill v3.2 Live */}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                v3.2 Live
              </span>
            </div>

            {/* Indikator dot hijau berdenyut (pulse) dengan label Sheets Connected */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-100 text-emerald-800 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-semibold">Sheets Connected</span>
              <span className="ml-auto text-[10px] text-emerald-600 font-mono">200 OK</span>
            </div>
          </div>

          {/* Navigasi Utama */}
          <nav className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1">
              Main Navigation
            </span>

            {/* Nav 1: Discovery & Outreach */}
            <button
              type="button"
              onClick={() => goTab('outreach')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'outreach'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className={`w-4 h-4 ${activeTab === 'outreach' ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>Discovery &amp; Outreach</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                activeTab === 'outreach' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}>
                Auto
              </span>
            </button>

            {/* Nav 2: Riwayat & Anti-Duplikasi */}
            <button
              type="button"
              onClick={() => goTab('history')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-blue-300' : 'text-slate-400'}`} />
                <span>Riwayat &amp; Database</span>
              </div>
              {blacklist.size > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  activeTab === 'history' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}>
                  {blacklist.size}
                </span>
              )}
            </button>
          </nav>

        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-3 bg-slate-50/40">

          {/* Kartu kecil: 🛡️ Anti-Duplikasi: [X] nomor terdaftar */}
          <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Anti-Duplikasi</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-900 font-mono">{blacklist.size}</span> nomor terdaftar
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Nomor yang ada di Sheets otomatis dilewati saat batch.
            </p>
          </div>

          {/* Badge profil minimalis di pojok bawah */}
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 transition">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                OP
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 leading-none">Operator Lead</span>
                <span className="text-[10px] text-slate-400 mt-0.5">B2B Pro Tier</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Aktif Online" />
          </div>

        </div>

      </aside>

      {/* ═════════════════════════════════════════════════════════════
          1.2 WORKSPACE UTAMA (Full-Viewport, Background: Slate-50)
      ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-slate-50 overflow-hidden">

        {/* Top Navbar Header */}
        <header className="h-14 px-6 lg:px-8 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-semibold text-slate-900">
              {activeTab === 'outreach' ? '⚡ Discovery & Outreach Engine' : '📜 Riwayat & Anti-Duplikasi'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={syncFromSheets}
              disabled={isSyncing}
              className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkronisasi…' : 'Sync Sheets'}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Fonnte WA &amp; Gemini AI Ready</span>
            </div>
          </div>
        </header>

        {/* Main Workspace Body (Fills entire remaining viewport, no bottom void) */}
        <main className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8 flex flex-col">
          {activeTab === 'outreach' && (
            <OutreachMachine
              blacklist={blacklist}
              onContactSentSuccess={handleContactSentSuccess}
              showToast={showToast}
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
            />
          )}
        </main>

      </div>

      {/* ── TOAST NOTIFICATIONS (shadcn/Vercel style) ─────────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-in flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-medium border bg-white ${
              t.type === 'success'
                ? 'border-emerald-200 text-emerald-900'
                : t.type === 'warn'
                ? 'border-amber-200 text-amber-900'
                : 'border-rose-200 text-rose-900'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {t.type === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

// ── Export default page wrapped in Suspense ──────────────────────────────────
export default function Page() {
  return (
    <Suspense>
      <AppInner />
    </Suspense>
  );
}