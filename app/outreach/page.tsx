'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Lead, LeadCategory, LeadStatus } from '@/lib/outreach-data';
import FilterTabs from './components/filter-tabs';
import CityFilter from './components/city-filter';
import LeadTable from './components/lead-table';
import PitchModal from './components/pitch-modal';

const STORAGE_KEY = 'outreach_lead_statuses';

function loadStatuses(): Record<string, LeadStatus> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStatuses(map: Record<string, LeadStatus>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, LeadStatus>>({});
  const [filterCategory, setFilterCategory] = useState<LeadCategory | 'semua'>('semua');
  const [filterCity, setFilterCity] = useState<string>('malang');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    setStatusMap(loadStatuses());
    fetch('/api/leads')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setLeads(data.leads);
      })
      .finally(() => setLoading(false));
  }, []);

  const mergedLeads = useMemo(() => {
    return leads.map((l) => ({
      ...l,
      status: statusMap[l.id] || l.status,
    }));
  }, [leads, statusMap]);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = { semua: mergedLeads.length };
    for (const l of mergedLeads) {
      counts[l.city] = (counts[l.city] || 0) + 1;
    }
    return counts;
  }, [mergedLeads]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { semua: mergedLeads.length };
    for (const l of mergedLeads) {
      counts[l.category] = (counts[l.category] || 0) + 1;
    }
    return counts;
  }, [mergedLeads]);

  const filteredLeads = useMemo(() => {
    let result = mergedLeads;
    if (filterCategory !== 'semua') {
      result = result.filter((l) => l.category === filterCategory);
    }
    if (filterCity !== 'semua') {
      result = result.filter((l) => l.city === filterCity);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.area.toLowerCase().includes(q) ||
          l.phone.includes(q)
      );
    }
    return result;
  }, [mergedLeads, filterCategory, filterCity, searchQuery]);

  const handleStatusChange = (id: string, newStatus: LeadStatus) => {
    const next = { ...statusMap, [id]: newStatus };
    setStatusMap(next);
    saveStatuses(next);
  };

  const handleGeneratePitch = (lead: Lead) => {
    setGeneratingId(lead.id);
    setSelectedLead(lead);
    setTimeout(() => setGeneratingId(null), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 animate-pulse" />
          <p className="text-xs text-slate-500 font-medium">Memuat data leads...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">AI Cold Outreach Engine</h1>
              <p className="text-[11px] text-slate-500">Leads UMKM Jawa Timur — Personalisasi pesan via Gemini AI</p>
            </div>
          </div>
          <a
            href="/"
            className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition"
          >
            Back to CRM
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-6 py-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <FilterTabs active={filterCategory} onChange={setFilterCategory} counts={categoryCounts} />
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari leads..."
                className="w-40 pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <CityFilter active={filterCity} onChange={setFilterCity} counts={cityCounts} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{filteredLeads.length}</span>
          leads ditemukan
          {filterCategory !== 'semua' && <span className="text-slate-300">• Kategori: {filterCategory}</span>}
          {filterCity !== 'semua' && <span className="text-slate-300">• Kota: {filterCity}</span>}
        </div>

        <LeadTable
          leads={filteredLeads}
          generatingId={generatingId}
          onGeneratePitch={handleGeneratePitch}
        />
      </div>

      {selectedLead && (
        <PitchModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}