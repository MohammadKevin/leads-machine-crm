'use client';

import { KOTA_JATIM } from '@/lib/outreach-data';

export default function CityFilter({
  active,
  onChange,
  counts,
}: {
  active: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <select
      value={active}
      onChange={(e) => onChange(e.target.value)}
      className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
    >
      <option value="semua">Semua Kota ({counts['semua'] ?? 0})</option>
      {KOTA_JATIM.map((k) => (
        <option key={k.name} value={k.name}>
          {k.label} ({counts[k.name] ?? 0})
        </option>
      ))}
    </select>
  );
}