'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperPlane,
  faCheckCircle,
  faTimesCircle,
  faPause,
  faPlay,
  faForward,
  faSync,
  faExclamationTriangle,
  faBullseye,
  faSpinner,
  faMapMarkerAlt,
  faShieldAlt,
  faRotateLeft,
  faClock,
} from '@fortawesome/free-solid-svg-icons';

import { useOutreachQueue } from '@/hooks/useOutreachQueue';
import { BATCH_TARGET_TOTAL, LeadStatus } from '@/types/outreach';

const STATUS_BADGE: Record<LeadStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-cream-200 text-olive-700 border-cream-300' },
  generating: { label: 'Generating', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  ready: { label: 'Ready', className: 'bg-olive-100 text-olive-700 border-olive-200' },
  in_queue: { label: 'In Queue', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  sent: { label: 'Sent', className: 'bg-mint-100 text-olive-800 border-mint-200' },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  skipped: { label: 'Skipped', className: 'bg-cream-200 text-olive-600 border-cream-300' },
};

function formatTime(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

export default function OutreachDashboard() {
  const {
    leads,
    isRunning,
    isPaused,
    isFetching,
    sentCount,
    failedCount,
    activeTarget,
    countdown,
    notification,
    total,
    runEngine,
    fetchLeads,
    pauseEngine,
    resumeEngine,
    skipCurrent,
    resetQueue,
  } = useOutreachQueue();

  const processed = sentCount + failedCount;
  const progressPct = Math.min(100, Math.round((processed / (total || BATCH_TARGET_TOTAL)) * 100));

  const statusBadge = isRunning
    ? isPaused
      ? { label: 'Paused', className: 'bg-amber-100 text-amber-900 border-amber-300' }
      : {
          label: `Running (Mengirim Otomatis ke ${total} Target)`,
          className: 'bg-mint-100 text-olive-800 border-mint-200',
        }
    : { label: 'Idle', className: 'bg-cream-200 text-olive-700 border-olive-300' };

  const remainingCount = leads.filter(
    (l) => l.status === 'ready' || l.status === 'pending'
  ).length;

  return (
    <div className="space-y-5">
      {notification && (
        <div
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
            notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : notification.type === 'success'
              ? 'bg-mint-50 border-mint-200 text-olive-800'
              : 'bg-olive-50 border-olive-200 text-olive-700'
          }`}
        >
          <FontAwesomeIcon
            icon={notification.type === 'error' ? faExclamationTriangle : faCheckCircle}
            className="h-3.5 w-3.5 shrink-0"
          />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Metrics */}
      <div className="bg-cream-50 border border-olive-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-olive-500 text-cream-50 flex items-center justify-center shadow-sm">
              <FontAwesomeIcon icon={faBullseye} className="h-4 w-4 text-mint-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-olive-900 tracking-tight">
                Batch Automated Outreach Engine
              </h3>
              <p className="text-[11px] text-olive-600 mt-0.5">
                Auto-discovery 75 prospek A1 & pengiriman Fonnte berjeda manusiawi
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${statusBadge.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning && !isPaused ? 'bg-olive-600 animate-pulse' : 'bg-olive-400'}`} />
            {statusBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-cream-100 rounded-lg text-center">
            <span className="text-[10px] font-bold text-olive-600 uppercase">Target Batch</span>
            <p className="text-xl font-mono font-bold text-olive-900 mt-0.5">{BATCH_TARGET_TOTAL}</p>
            <span className="text-[10px] text-olive-500">Prospek A1</span>
          </div>
          <div className="p-3 bg-mint-50 rounded-lg text-center">
            <span className="text-[10px] font-bold text-olive-600 uppercase">Progres</span>
            <p className="text-xl font-mono font-bold text-olive-800 mt-0.5">
              {sentCount} <span className="text-sm text-olive-500">/ {total || BATCH_TARGET_TOTAL}</span>
            </p>
            <span className="text-[10px] text-olive-500">Terkirim</span>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg text-center">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Gagal / Error</span>
            <p className="text-xl font-mono font-bold text-rose-700 mt-0.5">{failedCount}</p>
            <span className="text-[10px] text-rose-500">Perlu ditinjau</span>
          </div>
          <div className="p-3 bg-cream-100 rounded-lg text-center">
            <span className="text-[10px] font-bold text-olive-600 uppercase">Sisa Antrean</span>
            <p className="text-xl font-mono font-bold text-olive-900 mt-0.5">{remainingCount}</p>
            <span className="text-[10px] text-olive-500">Belum diproses</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-olive-700">Progress Pengiriman Batch</span>
            <span className="font-mono text-olive-600">{progressPct}%</span>
          </div>
          <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-olive-400 to-mint-300 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!isRunning ? (
            <button
              onClick={runEngine}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-olive-500 hover:bg-olive-600 disabled:opacity-50 text-cream-50 text-xs font-bold shadow-sm cursor-pointer"
            >
              <FontAwesomeIcon
                icon={isFetching ? faSpinner : faPaperPlane}
                className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
              />
              <span>{isFetching ? 'Fetching 75 Prospek...' : '🚀 Run Engine (Fetch 75 & Auto-Send 75)'}</span>
            </button>
          ) : (
            <button
              onClick={isPaused ? resumeEngine : pauseEngine}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm cursor-pointer ${
                isPaused
                  ? 'bg-mint-200 hover:bg-mint-100 text-olive-900'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
              }`}
            >
              <FontAwesomeIcon icon={isPaused ? faPlay : faPause} className="h-3.5 w-3.5" />
              <span>{isPaused ? '▶ Lanjutkan Pengiriman' : '⏸ Jeda Pengiriman'}</span>
            </button>
          )}

          {isRunning && (
            <button
              onClick={skipCurrent}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-olive-200 bg-cream-50 hover:bg-cream-200 text-olive-700 text-xs font-semibold cursor-pointer"
            >
              <FontAwesomeIcon icon={faForward} className="h-3.5 w-3.5" />
              <span>Skip Target</span>
            </button>
          )}

          <button
            onClick={resetQueue}
            disabled={isRunning || leads.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-olive-200 bg-cream-50 hover:bg-cream-200 text-olive-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
            <span>Reset Batch</span>
          </button>
        </div>
      </div>

      {/* Realtime Monitor Banner */}
      {isRunning && (
        <div className="bg-olive-700 text-cream-50 rounded-xl p-4 shadow-sm border border-olive-500 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-mint-200 animate-pulse shrink-0" />
              <span className="text-xs font-semibold truncate">
                Sedang diproses: {activeTarget?.clinicName || 'menyiapkan target...'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-mint-100 shrink-0">
              {activeTarget?.whatsappNumber || '-'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-mint-100">
            <span className="inline-flex items-center gap-1">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="h-3 w-3" />
              {activeTarget ? `${activeTarget.city}, ${activeTarget.province}` : '-'}
            </span>
            <span className="inline-flex items-center gap-1">
              <FontAwesomeIcon icon={faShieldAlt} className="h-3 w-3" />
              {activeTarget?.category || '-'}
            </span>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-olive-500">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} className="h-4 w-4 text-mint-200" />
              <span className="text-xs font-semibold">
                Jeda pesan berikutnya:{' '}
                <span className="font-mono text-2xl font-bold text-cream-50 align-middle">{countdown}</span>{' '}
                detik
              </span>
            </div>
            <span className="text-[10px] text-mint-100 italic">(Menjaga reputasi nomor WA)</span>
          </div>
        </div>
      )}

      {/* Realtime Log Table */}
      <div className="bg-cream-50 border border-olive-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-olive-200">
          <h4 className="text-xs font-bold text-olive-900 uppercase tracking-wider">
            Log Realtime 75 Target
          </h4>
          <button
            onClick={() => { void fetchLeads(); }}
            disabled={isRunning || isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-olive-200 bg-cream-50 hover:bg-mint-50 text-olive-700 text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
          >
            <FontAwesomeIcon icon={faSync} className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Muat 75 Prospek A1</span>
          </button>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-olive-100 flex items-center justify-center mb-3">
              <FontAwesomeIcon icon={faPaperPlane} className="h-5 w-5 text-olive-500" />
            </div>
            <p className="text-sm font-semibold text-olive-700">Belum ada antrean batch.</p>
            <p className="text-xs text-olive-500 mt-1">
              Klik &quot;Run Engine&quot; untuk auto-discovery 75 prospek A1 dan mulai pengiriman otomatis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-olive-100 text-olive-700 border-b border-olive-200 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-3 py-2.5">No</th>
                  <th className="px-3 py-2.5">Nama Klinik</th>
                  <th className="px-3 py-2.5">Wilayah</th>
                  <th className="px-3 py-2.5">Kategori</th>
                  <th className="px-3 py-2.5">Tier</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Preview Pesan</th>
                  <th className="px-3 py-2.5">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-100">
                {leads.map((lead, index) => {
                  const badge = STATUS_BADGE[lead.status];
                  return (
                    <tr key={lead.id} className="hover:bg-cream-100/70 transition text-[11px] align-top">
                      <td className="px-3 py-2.5 font-mono text-olive-500">{index + 1}</td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <div className="font-semibold text-olive-900 truncate" title={lead.clinicName}>
                          {lead.clinicName}
                        </div>
                        <div className="text-[10px] font-mono text-olive-600 mt-0.5">
                          {lead.whatsappNumber}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-olive-700 whitespace-nowrap">
                        {lead.city}
                        <span className="block text-[10px] text-olive-500">{lead.province}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-olive-100 font-medium text-[10px] text-olive-700 whitespace-nowrap">
                          {lead.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-mint-50 border border-mint-100 text-[9px] font-bold text-olive-700 whitespace-nowrap">
                          A1 PRIORITY
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${badge.className}`}>
                          {lead.status === 'sent' && <FontAwesomeIcon icon={faCheckCircle} className="h-2.5 w-2.5" />}
                          {lead.status === 'failed' && <FontAwesomeIcon icon={faTimesCircle} className="h-2.5 w-2.5" />}
                          {lead.status === 'in_queue' && <FontAwesomeIcon icon={faSpinner} className="h-2.5 w-2.5 animate-spin" />}
                          {badge.label}
                        </span>
                        {lead.status === 'failed' && lead.lastError && (
                          <span className="block text-[9px] text-rose-600 mt-0.5 max-w-[140px] truncate" title={lead.lastError}>
                            {lead.lastError}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <p className="text-olive-600 line-clamp-2" title={lead.generatedMessage}>
                          {lead.generatedMessage || '-'}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-olive-600 whitespace-nowrap">
                        {formatTime(lead.sentAt)}
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
