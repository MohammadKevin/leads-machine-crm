'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import OutreachMachine from '@/components/OutreachMachine';
import HistoryPanel from '@/components/HistoryPanel';
import PrototypeStudioTab from '@/components/prototype/PrototypeStudioTab';
import KeuanganTab from '@/components/keuangan/KeuanganTab';
import PeluangTab from '@/components/peluang/PeluangTab';
import { WhatsAppConnectionModal } from '@/components/settings/WhatsAppConnectionModal';
import FaceIdGuard, { useFaceId } from '@/components/FaceIdGuard';
import { Lock } from 'lucide-react';
import {
  SheetLeadRecord,
  OutreachMetrics,
  OutreachLead,
  SheetResponseStatus,
  PengaturanModel,
} from '@/types/outreach';
import { Button } from '@/components/ui/Button';

type TabId = 'outreach' | 'history' | 'prototype' | 'keuangan' | 'peluang';

interface Toast {
  type: 'success' | 'error' | 'warn';
  message: string;
  id: number;
}

const DEFAULT_SETTINGS_STATE: PengaturanModel = {
  target_nominal: 25_000_000,
  target_tanggal: '2027-03-16',
  target_label: 'Target Maret 2027',
  batas_harian: 50,
  jeda_detik: 20,
  auto_followup_mode: 'manual',
  fonnte_connected: true,
  webhook_count_24h: 0,
};

function AppInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lockDashboard } = useFaceId();
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId =
    tabParam === 'history'
      ? 'history'
      : tabParam === 'prototype'
      ? 'prototype'
      : tabParam === 'keuangan'
      ? 'keuangan'
      : tabParam === 'peluang'
      ? 'peluang'
      : 'outreach';

  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());
  const [sheetRecords, setSheetRecords] = useState<SheetLeadRecord[]>([]);
  const [selectedLeadForPrototype, setSelectedLeadForPrototype] = useState<SheetLeadRecord | null>(null);
  const [settings, setSettings] = useState<PengaturanModel>(DEFAULT_SETTINGS_STATE);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [metrics, setMetrics] = useState<OutreachMetrics>({
    totalUniqueContacted: 0,
    interestedCount: 0,
    closingDealCount: 0,
    inProgressCount: 0,
    rejectedCount: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dealRoomSearch, setDealRoomSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const goTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'outreach') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { type, message, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (res.ok && data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdateSettings = async (partial: Partial<PengaturanModel>) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    const data = await res.json();
    if (res.ok && data.success && data.settings) {
      setSettings(data.settings);
    } else {
      throw new Error(data.error || 'Gagal menyimpan');
    }
  };

  // Keyboard shortcuts 1, 2, 3, 4, 5, /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        if (activeTab !== 'history') {
          goTab('history');
          setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
          searchInputRef.current?.focus();
        }
        return;
      }

      if (isInput) return;

      if (e.key === '1') {
        e.preventDefault();
        goTab('outreach');
      } else if (e.key === '2') {
        e.preventDefault();
        goTab('history');
      } else if (e.key === '3') {
        e.preventDefault();
        goTab('prototype');
      } else if (e.key === '4') {
        e.preventDefault();
        goTab('keuangan');
      } else if (e.key === '5') {
        e.preventDefault();
        goTab('peluang');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goTab, activeTab]);

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

  const syncFromSheets = useCallback(async (isManual = false) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/outreach/blacklist', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const blacklistSet = new Set<string>(data.blacklist || []);
        setBlacklist(blacklistSet);
        if (Array.isArray(data.records)) {
          setSheetRecords(data.records);
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        if (isManual) {
          showToast('success', `${blacklistSet.size} nomor tersinkron dengan Google Sheets.`);
        }
      } else if (isManual) {
        showToast('error', data?.error || 'Gagal sinkron Sheets.');
      }
    } catch {
      if (isManual) {
        showToast('error', 'Koneksi ke Sheets gagal.');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  useEffect(() => {
    syncFromSheets(false);
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

      setSheetRecords((all) =>
        all.map((r) => (r.normalizedPhone === phone ? { ...r, status: newStatus } : r))
      );

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
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) return true;
        setSheetRecords(prev);
        showToast('error', 'Gagal update status di Sheets.');
        return false;
      } catch {
        setSheetRecords(prev);
        showToast('error', 'Kesalahan koneksi saat update.');
        return false;
      }
    },
    [sheetRecords, showToast]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayChatsCount = sheetRecords.filter(
    (r) => r.timestamp && r.timestamp.startsWith(todayStr)
  ).length;

  const closedCount = sheetRecords.filter((r) => r.status === 'CLOSED_DEAL').length;
  const currentRevenue = closedCount * 2500000;
  const targetRevenue = settings.target_nominal || 25000000;
  const progressPercent = Math.min(100, Math.round((currentRevenue / targetRevenue) * 100));

  const pageTitle =
    activeTab === 'outreach'
      ? 'Radar Klien'
      : activeTab === 'history'
      ? 'Deal Room'
      : activeTab === 'prototype'
      ? 'Prototype Studio'
      : activeTab === 'keuangan'
      ? 'Keuangan & Target'
      : 'Peluang Proyek';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F6F2] text-[#1B1B18] antialiased">
      {/* Global Sidebar: 216px, background SAMA dengan halaman, tanpa garis pemisah vertikal kasar */}
      <aside className="fixed left-0 top-0 h-full w-[216px] bg-[#F7F6F2] z-40 flex flex-col justify-between p-4 pb-24 select-none">
        <div className="flex flex-col gap-6">
          {/* Logo Leads Machine & Quick Lock Button */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-[6px] bg-[#0B7A55] flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-[2px] bg-white/90" />
              </div>
              <span className="text-[14px] font-semibold text-[#1B1B18] tracking-tight">
                Leads Machine
              </span>
            </div>
            <button
              type="button"
              onClick={lockDashboard}
              className="p-1 rounded-[6px] text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/5 transition cursor-pointer"
              title="Kunci Dashboard (Face ID)"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Navigation Links with keyboard shortcuts 1/2/3/4/5 */}
          <nav className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => goTab('outreach')}
              className={`h-9 flex items-center justify-between px-3 rounded-[8px] transition cursor-pointer text-[13px] ${
                activeTab === 'outreach'
                  ? 'bg-white text-[#1B1B18] font-medium shadow-xs ring-1 ring-[#ECEAE2]'
                  : 'text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/4'
              }`}
            >
              <span>Radar Klien</span>
              <span className="text-[12px] text-[#6B6A63] font-normal">1</span>
            </button>

            <button
              type="button"
              onClick={() => goTab('history')}
              className={`h-9 flex items-center justify-between px-3 rounded-[8px] transition cursor-pointer text-[13px] ${
                activeTab === 'history'
                  ? 'bg-white text-[#1B1B18] font-medium shadow-xs ring-1 ring-[#ECEAE2]'
                  : 'text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/4'
              }`}
            >
              <span>Deal Room</span>
              <span className="text-[12px] text-[#6B6A63] font-normal">2</span>
            </button>

            <button
              type="button"
              onClick={() => goTab('prototype')}
              className={`h-9 flex items-center justify-between px-3 rounded-[8px] transition cursor-pointer text-[13px] ${
                activeTab === 'prototype'
                  ? 'bg-white text-[#1B1B18] font-medium shadow-xs ring-1 ring-[#ECEAE2]'
                  : 'text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/4'
              }`}
            >
              <span>Prototype Studio</span>
              <span className="text-[12px] text-[#6B6A63] font-normal">3</span>
            </button>

            <button
              type="button"
              onClick={() => goTab('keuangan')}
              className={`h-9 flex items-center justify-between px-3 rounded-[8px] transition cursor-pointer text-[13px] ${
                activeTab === 'keuangan'
                  ? 'bg-white text-[#1B1B18] font-medium shadow-xs ring-1 ring-[#ECEAE2]'
                  : 'text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/4'
              }`}
            >
              <span>Keuangan</span>
              <span className="text-[12px] text-[#6B6A63] font-normal">4</span>
            </button>

            <button
              type="button"
              onClick={() => goTab('peluang')}
              className={`h-9 flex items-center justify-between px-3 rounded-[8px] transition cursor-pointer text-[13px] ${
                activeTab === 'peluang'
                  ? 'bg-white text-[#1B1B18] font-medium shadow-xs ring-1 ring-[#ECEAE2]'
                  : 'text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/4'
              }`}
            >
              <span>Peluang</span>
              <span className="text-[12px] text-[#6B6A63] font-normal">5</span>
            </button>
          </nav>
        </div>

        {/* Dynamic Target widget di dasar sidebar */}
        <div className="bg-white/60 ring-1 ring-[#ECEAE2] p-3 rounded-[10px] flex flex-col gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] text-[#6B6A63] font-normal truncate">
            {settings.target_label || 'Target Maret 2027'}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-bold text-[#1B1B18] leading-none tabular-nums">
              Rp {currentRevenue >= 1000000 ? `${(currentRevenue / 1000000).toFixed(1).replace('.0', '')} jt` : currentRevenue.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-[#6B6A63] font-normal leading-none tabular-nums">
              / Rp {targetRevenue >= 1000000 ? `${Math.round(targetRevenue / 1000000)} jt` : targetRevenue.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="w-full bg-[#ECEAE2] h-1 rounded-full overflow-hidden my-0.5">
            <div
              className="bg-[#0B7A55] h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-[#6B6A63] font-normal tabular-nums">
            {closedCount} dari {Math.max(10, Math.ceil(targetRevenue / 2500000))} deal
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-[216px] flex-1 flex flex-col h-full overflow-hidden">
        {/* Header: Judul H1 (22px) di kiri, Sheets tersinkron / Search di kanan */}
        <header className="h-16 px-8 flex items-center justify-between shrink-0">
          <h1 className="text-[22px] font-semibold text-[#1B1B18] tracking-tight">
            {pageTitle}
          </h1>

          <div className="flex items-center gap-3">
            {activeTab === 'history' && (
              <div className="relative w-56 sm:w-64">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={dealRoomSearch}
                  onChange={(e) => setDealRoomSearch(e.target.value)}
                  placeholder="Cari bisnis, nomor, kota…"
                  className="w-full h-8 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] placeholder:text-[#6B6A63] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>
            )}

            {/* WA Fonnte Connection button & indicator */}
            <button
              type="button"
              onClick={() => setIsWaModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] hover:bg-black/4 text-[12px] text-[#6B6A63] transition cursor-pointer"
              title="Periksa status koneksi WhatsApp & Webhook Fonnte"
            >
              <span className="w-2 h-2 rounded-full bg-[#0B7A55]" />
              <span className="hidden sm:inline">WA Fonnte Aktif</span>
            </button>

            {/* Sheets tersinkron indicator */}
            <div className="flex items-center gap-1.5 select-none px-2.5 py-1 text-[12px] text-[#6B6A63]">
              <span className="w-2 h-2 rounded-full bg-[#0B7A55]" />
              <span className="hidden sm:inline">Sheets tersinkron</span>
            </div>

            {/* Kunci Dashboard Button */}
            <button
              type="button"
              onClick={lockDashboard}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] hover:bg-black/4 text-[12px] text-[#6B6A63] hover:text-[#1B1B18] transition cursor-pointer"
              title="Kunci Dashboard dengan Face ID"
            >
              <Lock className="w-3.5 h-3.5 text-[#6B6A63]" />
              <span className="hidden sm:inline">Kunci</span>
            </button>

            {activeTab === 'history' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSyncing}
                onClick={() => syncFromSheets(true)}
              >
                {isSyncing ? 'Sinkron…' : 'Sinkron'}
              </Button>
            )}
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-8 pb-12">
          {activeTab === 'outreach' && (
            <OutreachMachine
              blacklist={blacklist}
              todayChatsCount={todayChatsCount}
              onContactSentSuccess={handleContactSentSuccess}
              showToast={showToast}
              onSyncSuccess={() => syncFromSheets(true)}
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
              onGoToRadar={() => goTab('outreach')}
              searchQuery={dealRoomSearch}
              onSearchChange={setDealRoomSearch}
            />
          )}

          {activeTab === 'prototype' && (
            <PrototypeStudioTab
              sheetRecords={sheetRecords}
              initialSelectedLead={selectedLeadForPrototype}
              showToast={showToast}
            />
          )}

          {activeTab === 'keuangan' && (
            <KeuanganTab
              records={sheetRecords}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              showToast={showToast}
            />
          )}

          {activeTab === 'peluang' && (
            <PeluangTab showToast={showToast} />
          )}
        </main>
      </div>

      {/* WhatsApp & Webhook Connection Modal */}
      <WhatsAppConnectionModal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        settings={settings}
        onRefresh={fetchSettings}
        showToast={showToast}
      />

      {/* Floating Toast Notification */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3.5 py-2.5 rounded-[8px] text-[13px] font-medium shadow-md flex items-center gap-2 animate-fade-in ${
                t.type === 'success'
                  ? 'bg-[#0B7A55] text-white'
                  : t.type === 'error'
                  ? 'bg-[#B3261E] text-white'
                  : 'bg-[#1B1B18] text-white'
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
        <div className="h-screen w-screen flex items-center justify-center bg-[#F7F6F2] text-[#6B6A63] text-[13px]">
          Memuat Leads Machine…
        </div>
      }
    >
      <FaceIdGuard>
        <AppInner />
      </FaceIdGuard>
    </Suspense>
  );
}
