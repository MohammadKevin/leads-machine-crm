'use client';

import type { Lead } from '@/lib/outreach-data';
import StatusBadge from './status-badge';

const CATEGORY_LABEL: Record<string, string> = {
  klinik: 'Klinik',
  kost: 'Kost',
  kafe: 'Kafe',
  lainnya: 'Lainnya',
};

const CATEGORY_COLOR: Record<string, string> = {
  klinik: 'bg-rose-50 text-rose-700 border-rose-200',
  kost: 'bg-violet-50 text-violet-700 border-violet-200',
  kafe: 'bg-orange-50 text-orange-700 border-orange-200',
  lainnya: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function LeadTable({
  leads,
  generatingId,
  onGeneratePitch,
}: {
  leads: Lead[];
  generatingId: string | null;
  onGeneratePitch: (lead: Lead) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5" />
        </svg>
        <p className="text-sm font-medium">Belum ada leads</p>
        <p className="text-xs mt-1">Coba ubah filter kategori atau kota</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Nama Bisnis</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Kota</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Area</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Telepon</th>
            <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50/50 transition">
              <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{lead.name}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border ${CATEGORY_COLOR[lead.category]}`}>
                  {CATEGORY_LABEL[lead.category]}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.city}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.area}</td>
              <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap text-[11px]">{lead.phone}</td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                <button
                  onClick={() => onGeneratePitch(lead)}
                  disabled={generatingId === lead.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {generatingId === lead.id ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                      Buat Pesan
                    </>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}