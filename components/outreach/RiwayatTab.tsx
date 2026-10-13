'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSync,
  faCopy,
  faSearch,
  faStar,
  faPaperPlane,
  faCheckCircle,
  faComments,
  faHandshake,
  faExternalLinkAlt,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import {
  SheetLeadRecord,
  OutreachMetrics,
  SheetResponseStatus,
  RESPONSE_STATUS_OPTIONS,
} from '@/types/outreach';
import { formatPhoneDisplay } from '@/lib/defensive-client';

interface RiwayatTabProps {
  records: SheetLeadRecord[];
  metrics: OutreachMetrics;
  isSyncing: boolean;
  onSyncSheets: () => Promise<void>;
  onUpdateStatus: (phone: string, status: SheetResponseStatus) => Promise<boolean>;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

export default function RiwayatTab({
  records,
  metrics,
  isSyncing,
  onSyncSheets,
  onUpdateStatus,
  showToast,
}: RiwayatTabProps) {
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);

  const filteredRecords = records.filter((rec) => {
    if (statusFilter !== 'ALL' && rec.status !== statusFilter) {
      return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchName = rec.businessName.toLowerCase().includes(q);
      const matchPhone = rec.normalizedPhone.includes(q) || rec.phone.includes(q);
      const matchCategory = rec.category.toLowerCase().includes(q);
      return matchName || matchPhone || matchCategory;
    }
    return true;
  });

  const handleStatusChange = async (rec: SheetLeadRecord, newStatus: SheetResponseStatus) => {
    if (rec.status === newStatus || updatingPhone === rec.normalizedPhone) return;

    setUpdatingPhone(rec.normalizedPhone);
    const success = await onUpdateStatus(rec.normalizedPhone, newStatus);
    setUpdatingPhone(null);

    if (success) {
      showToast('success', `Status ${rec.businessName} diperbarui ke ${newStatus}.`);
    } else {
      showToast('error', `Gagal memperbarui status di Google Sheets. Perubahan dibatalkan.`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', `${label} disalin ke clipboard!`);
  };

  return (
    <div className="space-y-6">
      {/* 1. BANNER PENCAPAIAN DI ATAS TABEL */}
      <div className="bg-cream-50 border border-olive-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-olive-200">
          <div>
            <h2 className="text-sm font-bold text-olive-900 tracking-tight">
              Riwayat Outreach & Database Anti-Duplikasi
            </h2>
            <p className="text-[11px] text-olive-600 mt-0.5">
              Sinkronisasi dua arah langsung ke Google Sheets Apps Script
            </p>
          </div>
          <button
            onClick={onSyncSheets}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-olive-500 hover:bg-olive-600 disabled:opacity-50 text-cream-50 text-xs font-semibold shadow-sm transition cursor-pointer shrink-0"
          >
            <FontAwesomeIcon icon={faSync} className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sinkronisasi Sheets...' : 'Sinkronkan Data Sheets'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Outreach Unik */}
          <div className="bg-cream-100/70 border border-olive-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-olive-500 text-cream-50 flex items-center justify-center font-bold shadow-sm">
              <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5 text-mint-200" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-olive-600 uppercase tracking-wider">
                Total Outreach Unik
              </span>
              <p className="text-2xl font-mono font-bold text-olive-900 leading-tight">
                {metrics.totalUniqueContacted}{' '}
                <span className="text-xs font-sans font-normal text-olive-600">bisnis</span>
              </p>
            </div>
          </div>

          {/* Card 2: Prospek Tertarik / Follow-up */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
              <FontAwesomeIcon icon={faComments} className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                Prospek Tertarik / Follow-up
              </span>
              <p className="text-2xl font-mono font-bold text-emerald-900 leading-tight">
                {metrics.interestedCount}{' '}
                <span className="text-xs font-sans font-normal text-emerald-700">respon positif</span>
              </p>
            </div>
          </div>

          {/* Card 3: Closing Deal */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-sm">
              <FontAwesomeIcon icon={faHandshake} className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                Closing Deal
              </span>
              <p className="text-2xl font-mono font-bold text-purple-900 leading-tight">
                {metrics.closingDealCount}{' '}
                <span className="text-xs font-sans font-normal text-purple-700">klien deal</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & PENCARIAN RIWAYAT */}
      <div className="bg-cream-50 border border-olive-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                statusFilter === 'ALL'
                  ? 'bg-olive-500 text-cream-50 shadow-sm'
                  : 'bg-cream-100 text-olive-700 hover:bg-cream-200 border border-olive-200'
              }`}
            >
              Semua ({records.length})
            </button>
            {RESPONSE_STATUS_OPTIONS.map((opt) => {
              const count = records.filter((r) => r.status === opt.value).length;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-[11px] border ${
                    statusFilter === opt.value
                      ? 'bg-olive-700 text-cream-50 shadow-sm border-olive-800'
                      : `${opt.color} hover:opacity-80`
                  }`}
                >
                  {opt.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Cari bisnis, nomor, atau kategori..."
              className="w-full text-xs font-medium py-2 pl-8 pr-3 rounded-xl border border-olive-200 bg-cream-50 text-olive-900 placeholder:text-olive-400 focus:outline-none focus:border-olive-500"
            />
            <FontAwesomeIcon icon={faSearch} className="h-3 w-3 text-olive-400 absolute left-2.5 top-3" />
          </div>
        </div>
      </div>

      {/* 3. TABEL DATA GOOGLE SHEETS */}
      <div className="bg-cream-50 border border-olive-200 rounded-2xl overflow-hidden shadow-sm">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-olive-100 flex items-center justify-center mb-3 text-olive-500">
              <FontAwesomeIcon icon={faSearch} className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-olive-800">Tidak ada riwayat prospek yang sesuai.</p>
            <p className="text-xs text-olive-500 mt-1">
              Gunakan tab Mesin Outreach untuk memulai pencarian dan pengiriman batch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-olive-100/70 text-olive-800 border-b border-olive-200 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama Bisnis</th>
                  <th className="px-4 py-3">Kategori / Kota</th>
                  <th className="px-4 py-3">Nomor WhatsApp</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Status Respon</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-100">
                {filteredRecords.map((rec) => {
                  const isUpdating = updatingPhone === rec.normalizedPhone;

                  return (
                    <tr key={rec.id} className="hover:bg-cream-100/70 transition text-[11px] align-middle">
                      {/* 1. Tanggal */}
                      <td className="px-4 py-3 whitespace-nowrap text-olive-600 font-mono text-[10px]">
                        {rec.timestamp || rec.lastSyncAt
                          ? new Date(rec.timestamp || rec.lastSyncAt || '').toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </td>

                      {/* 2. Nama Bisnis */}
                      <td className="px-4 py-3 font-semibold text-olive-900 max-w-[220px]">
                        <div className="truncate font-bold" title={rec.businessName}>
                          {rec.businessName}
                        </div>
                        {rec.website ? (
                          <a
                            href={rec.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-olive-500 hover:underline inline-flex items-center gap-1 font-normal"
                          >
                            <span>Website</span>
                            <FontAwesomeIcon icon={faExternalLinkAlt} className="h-2 w-2" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-olive-400 font-normal">Tanpa Website</span>
                        )}
                      </td>

                      {/* 3. Kategori / Kota */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-olive-100 text-olive-800 font-medium text-[10px]">
                          {rec.category}
                        </span>
                        {rec.city && (
                          <span className="block text-[10px] text-olive-500 mt-0.5">
                            {rec.city}
                          </span>
                        )}
                      </td>

                      {/* 4. Nomor WhatsApp */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-olive-900">
                            {formatPhoneDisplay(rec.normalizedPhone || rec.phone)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(rec.normalizedPhone, 'Nomor')}
                            className="text-olive-400 hover:text-olive-700 cursor-pointer p-0.5"
                            title="Salin Nomor"
                          >
                            <FontAwesomeIcon icon={faCopy} className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </td>

                      {/* 5. Rating */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-olive-800">
                        {rec.rating > 0 ? (
                          <span className="flex items-center gap-1 font-medium">
                            <FontAwesomeIcon icon={faStar} className="h-3 w-3 text-amber-500" />
                            <span>{rec.rating}</span>
                            <span className="text-olive-500 text-[10px]">({rec.reviewsCount})</span>
                          </span>
                        ) : (
                          <span className="text-olive-400">-</span>
                        )}
                      </td>

                      {/* 6. Status Respon (Dropdown dengan Optimistic Update) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <select
                            aria-label="Status Respon"
                            value={rec.status}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleStatusChange(rec, e.target.value as SheetResponseStatus)
                            }
                            className={`text-[10px] font-bold py-1 px-2 rounded-lg border focus:outline-none cursor-pointer transition ${
                              rec.status === 'INTERESTED'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : rec.status === 'CLOSED_DEAL'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : rec.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : rec.status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="INTERESTED">INTERESTED</option>
                            <option value="IN_PROGRESS">IN PROGRESS</option>
                            <option value="CLOSED_DEAL">CLOSED DEAL</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                          {isUpdating && (
                            <FontAwesomeIcon
                              icon={faSpinner}
                              className="h-2.5 w-2.5 animate-spin text-olive-600 ml-1.5"
                            />
                          )}
                        </div>
                      </td>

                      {/* 7. Aksi Cepat: Direct WA */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <a
                          href={`https://wa.me/${rec.normalizedPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] shadow-sm transition cursor-pointer"
                          title="Buka chat WhatsApp di tab baru"
                        >
                          <FontAwesomeIcon icon={faPaperPlane} className="h-2.5 w-2.5" />
                          <span>Buka WA</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
