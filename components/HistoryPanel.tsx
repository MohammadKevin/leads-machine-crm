'use client';

import React, { useState } from 'react';
import {
  RefreshCw,
  Search,
  Star,
  Copy,
  ExternalLink,
  MessageCircle,
  Database,
  CheckCircle2,
  ThumbsUp,
  Award,
  XCircle,
  Clock,
  Filter,
  Check,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  SheetLeadRecord,
  OutreachMetrics,
  SheetResponseStatus,
} from '@/types/outreach';
import { formatPhoneDisplay } from '@/lib/defensive-client';

interface Props {
  records: SheetLeadRecord[];
  metrics: OutreachMetrics;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  onUpdateStatus: (phone: string, status: SheetResponseStatus) => Promise<boolean>;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

// ── Badge status styling map (exact user specification) ──────────────────────
const STATUS_STYLES: Record<
  SheetResponseStatus,
  { label: string; badge: string; select: string }
> = {
  CONTACTED: {
    label: 'CONTACTED',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    select: 'bg-blue-50 text-blue-700 border-blue-300 focus:ring-blue-500',
  },
  INTERESTED: {
    label: 'INTERESTED',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    select: 'bg-emerald-50 text-emerald-700 border-emerald-300 focus:ring-emerald-500',
  },
  IN_PROGRESS: {
    label: 'IN PROGRESS',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    select: 'bg-amber-50 text-amber-700 border-amber-300 focus:ring-amber-500',
  },
  CLOSED_DEAL: {
    label: 'CLOSED DEAL',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    select: 'bg-purple-50 text-purple-700 border-purple-300 focus:ring-purple-500',
  },
  REJECTED: {
    label: 'REJECTED',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    select: 'bg-rose-50 text-rose-700 border-rose-300 focus:ring-rose-500',
  },
};

export default function HistoryPanel({
  records,
  metrics,
  isSyncing,
  onSync,
  onUpdateStatus,
  showToast,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [viewMessageRecord, setViewMessageRecord] = useState<SheetLeadRecord | null>(null);

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
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
      showToast('success', `Status ${rec.businessName} diperbarui ke ${newStatus}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    showToast('success', `${label} disalin ke clipboard.`);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6">

      {/* ═════════════════════════════════════════════════════════════
          HEADER SECTION & KPI STATS
      ═════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs shrink-0 flex flex-col gap-5">
        {/* Title, Search, and Sync Action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">
                Database Prospek &amp; Log Sinkronisasi Sheets
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tabel kontak terverifikasi anti-duplikasi, tersinkronisasi dua arah secara langsung dengan Google Sheets Web App.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative w-64 md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama bisnis, nomor, atau kota…"
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition"
              />
            </div>

            {/* Sync Button */}
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition active:scale-[0.99] shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan…' : 'Sync Realtime ke Sheets'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Card 1: Total Contacted */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Terkirim (Sheets)
              </span>
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {metrics.totalUniqueContacted || records.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Kontak unik terdata</div>
            </div>
          </div>

          {/* Card 2: Interested / Positive Response */}
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Tertarik / Follow-Up
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ThumbsUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700">
                {metrics.interestedCount + metrics.inProgressCount}
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-0.5">Prospek berminat</div>
            </div>
          </div>

          {/* Card 3: Closed Deal */}
          <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
                Closed Deal
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-700">
                {metrics.closingDealCount}
              </div>
              <div className="text-[11px] text-purple-600/80 mt-0.5">Klien berhasil deal</div>
            </div>
          </div>

          {/* Card 4: Rejected */}
          <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                Ditolak / Belum Minat
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-700">
                {metrics.rejectedCount}
              </div>
              <div className="text-[11px] text-rose-600/80 mt-0.5">Tidak berminat</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          TABEL FULL-WIDTH DENGAN DROPDOWN STATUS INLINE
      ═════════════════════════════════════════════════════════════ */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs flex-1 min-h-[380px] flex flex-col overflow-hidden">
        {/* Filter Pills Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`h-7 px-3 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Semua ({records.length})
            </button>

            {(['CONTACTED', 'INTERESTED', 'IN_PROGRESS', 'CLOSED_DEAL', 'REJECTED'] as SheetResponseStatus[]).map(
              (st) => {
                const count = records.filter((r) => r.status === st).length;
                const active = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`h-7 px-3 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {STATUS_STYLES[st].label} ({count})
                  </button>
                );
              }
            )}
          </div>

          <div className="text-xs text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{filteredRecords.length}</span> data
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {filteredRecords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <Database className="w-10 h-10 stroke-1 text-slate-300 mb-2.5" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada riwayat prospek ditemukan</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Belum ada data outreach atau tidak ada prospek yang cocok dengan kata kunci &ldquo;{search}&rdquo;.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider z-10">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Waktu Kirim</th>
                  <th className="px-4 py-3">Nama Usaha</th>
                  <th className="px-3 py-3 whitespace-nowrap">Kategori &amp; Kota</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nomor WhatsApp</th>
                  <th className="px-3 py-3 whitespace-nowrap">Rating</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status Respon</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec) => {
                  const isUpdating = updatingPhone === rec.normalizedPhone;
                  const phoneFormatted = formatPhoneDisplay(rec.normalizedPhone || rec.phone);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* 1. Waktu Kirim */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {rec.timestamp || rec.lastSyncAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {new Date(rec.timestamp || rec.lastSyncAt || '').toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* 2. Nama Usaha */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-semibold text-slate-900 truncate" title={rec.businessName}>
                          {rec.businessName}
                        </div>
                        {rec.website ? (
                          <a
                            href={rec.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 transition mt-0.5 truncate max-w-full"
                          >
                            <span>Website</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">Tanpa Website</span>
                        )}
                      </td>

                      {/* 3. Kategori & Kota */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {rec.category}
                        </span>
                        {rec.city && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{rec.city}</div>
                        )}
                      </td>

                      {/* 4. Nomor WhatsApp */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 text-[11px]">
                            {phoneFormatted}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(rec.normalizedPhone || rec.phone, 'Nomor')}
                            className="text-slate-400 hover:text-slate-800 transition cursor-pointer"
                            title="Salin nomor"
                          >
                            {copiedPhone === (rec.normalizedPhone || rec.phone) ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 5. Rating */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {rec.rating > 0 ? (
                          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{rec.rating}</span>
                            <span className="text-slate-400 text-[10px]">({rec.reviewsCount})</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* 6. Status Respon (Inline Dropdown ke Sheets) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="relative inline-flex items-center gap-1.5">
                          <select
                            aria-label="Status Respon"
                            value={rec.status}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleStatusChange(rec, e.target.value as SheetResponseStatus)
                            }
                            className={`text-xs font-semibold py-1 pl-2.5 pr-7 rounded-md border focus:outline-none focus:ring-1 transition cursor-pointer shadow-2xs ${
                              STATUS_STYLES[rec.status]?.select || 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="INTERESTED">INTERESTED</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="CLOSED_DEAL">CLOSED DEAL</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>

                          {isUpdating && (
                            <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
                          )}
                        </div>
                      </td>

                      {/* 7. Aksi (WhatsApp Link & Pesan) */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {rec.messageSent && (
                            <button
                              type="button"
                              onClick={() => setViewMessageRecord(rec)}
                              className="h-7 w-7 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer"
                              title="Lihat pesan yang terkirim"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <a
                            href={`https://wa.me/${rec.normalizedPhone || rec.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-2xs transition cursor-pointer"
                            title={`Buka WhatsApp ke ${rec.businessName}`}
                          >
                            <MessageCircle className="w-3 h-3 fill-current" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Message Modal Preview */}
      {viewMessageRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-lg w-full p-5 flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {viewMessageRecord.businessName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {formatPhoneDisplay(viewMessageRecord.normalizedPhone || viewMessageRecord.phone)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewMessageRecord(null)}
                className="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
              {viewMessageRecord.messageSent}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (viewMessageRecord.messageSent) {
                    copyToClipboard(viewMessageRecord.messageSent, 'Pesan');
                  }
                }}
                className="h-8 px-3 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Salin Pesan
              </button>
              <button
                type="button"
                onClick={() => setViewMessageRecord(null)}
                className="h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
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
