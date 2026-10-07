'use client';

import type { LeadCategory } from '@/lib/outreach-data';

const TABS: { key: LeadCategory | 'semua'; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'klinik', label: 'Klinik' },
  { key: 'kost', label: 'Kost' },
  { key: 'kafe', label: 'Kafe' },
  { key: 'lainnya', label: 'Lainnya' },
];

export default function FilterTabs({
  active,
  onChange,
  counts,
}: {
  active: LeadCategory | 'semua';
  onChange: (v: LeadCategory | 'semua') => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
            active === tab.key
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {tab.label}
          {counts[tab.key] !== undefined && (
            <span
              className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                active === tab.key ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {counts[tab.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}