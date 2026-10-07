'use client';

import { useState, useEffect } from 'react';
import type { Lead, LeadStatus } from '@/lib/outreach-data';
import PitchSkeleton from './pitch-skeleton';

export default function PitchModal({
  lead,
  onClose,
  onStatusChange,
}: {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!lead) return;
    setLoading(true);
    setError('');
    setMessage('');

    fetch('/api/generate-pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: lead.name,
        category: lead.category,
        city: lead.city,
        area: lead.area,
        phone: lead.phone,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.message) {
          setMessage(data.message);
        } else {
          setError(data.error || 'Gagal menghasilkan pesan.');
        }
      })
      .catch(() => setError('Terjadi kesalahan jaringan.'))
      .finally(() => setLoading(false));
  }, [lead]);

  if (!lead) return null;

  const cleanPhone = lead.phone.startsWith('0')
    ? '62' + lead.phone.slice(1)
    : lead.phone.startsWith('62')
    ? lead.phone
    : '62' + lead.phone;

  const handleSendWa = () => {
    if (!message.trim()) return;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message.trim())}`;
    window.open(waUrl, '_blank');
    onStatusChange(lead.id, 'sent');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Buat Pesan Penawaran</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{lead.name} — {lead.area}, {lead.city}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 min-h-[180px]">
          {loading ? (
            <PitchSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="p-2 rounded-full bg-rose-50">
                <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-xs text-rose-600 font-medium">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          ) : (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-40 p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Draf pesan akan muncul di sini..."
            />
          )}
        </div>

        {!loading && !error && (
          <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSendWa}
              disabled={!message.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              Kirim via WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}