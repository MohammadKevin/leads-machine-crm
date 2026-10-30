'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';

export type JobPlatform =
  | 'Glints'
  | 'JobStreet'
  | 'Kalibrr'
  | 'LinkedIn'
  | 'Indeed'
  | 'Loker.id'
  | 'Google Jobs';

export interface SavedJobItem {
  id: string;
  judul: string;
  perusahaan: string;
  platform: JobPlatform;
  url_lowongan?: string;
  estimasi_gaji: string;
  status: 'Baru' | 'Dilamar' | 'Interview' | 'Diterima' | 'Ditolak';
  tipe: 'Part-time' | 'Freelance' | 'Kontrak Remote' | 'Full-time';
  catatan?: string;
  tanggal_simpan: string;
}

export interface FreelanceProjectItem {
  id: string;
  judul: string;
  klien: string;
  tipe: 'Proyek Web' | 'Retainer IT';
  nominal: string;
  status: 'Diskusi' | 'Pengerjaan' | 'Selesai';
  kontak: string;
  catatan?: string;
}

const SEARCH_QUERIES = [
  'Frontend Developer Remote',
  'Web Developer Part-time',
  'Next.js Tailwind Developer',
  'Junior Web Developer',
  'Pembuat Website Landing Page',
];

const PLATFORM_URL_BUILDERS: Record<JobPlatform, (query: string) => string> = {
  Glints: (q) => `https://glints.com/id/opportunities/jobs/explore?keyword=${encodeURIComponent(q)}&country=ID`,
  JobStreet: (q) => `https://www.jobstreet.co.id/id/job-search/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))}-jobs/`,
  Kalibrr: (q) => `https://www.kalibrr.com/job-board/te/${encodeURIComponent(q)}/`,
  LinkedIn: (q) => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Indonesia`,
  Indeed: (q) => `https://id.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Indonesia`,
  'Loker.id': (q) => `https://www.loker.id/cari-lowongan-kerja?q=${encodeURIComponent(q)}`,
  'Google Jobs': (q) => `https://www.google.com/search?q=lowongan+kerja+${encodeURIComponent(q)}&ibp=htl;jobs`,
};

const INITIAL_JOBS: SavedJobItem[] = [
  {
    id: 'job-1',
    judul: 'Junior Frontend Developer (React / Next.js)',
    perusahaan: 'Studio Digital Kreatif',
    platform: 'Glints',
    url_lowongan: 'https://glints.com/id',
    estimasi_gaji: 'Rp 3.500.000 - Rp 5.000.000 / bln',
    status: 'Dilamar',
    tipe: 'Kontrak Remote',
    catatan: 'Sudah kirim portofolio website villa & klinik. Menunggu jadwal technical chat.',
    tanggal_simpan: new Date().toISOString(),
  },
  {
    id: 'job-2',
    judul: 'Part-time Website Maintenance & Webmaster',
    perusahaan: 'Agensi Pemasaran Lokal',
    platform: 'LinkedIn',
    url_lowongan: 'https://www.linkedin.com/jobs',
    estimasi_gaji: 'Rp 1.500.000 / bln (10 jam/minggu)',
    status: 'Interview',
    tipe: 'Part-time',
    catatan: 'Cocok sebagai pemasukan penopang rutin tanpa mengganggu waktu hunting prospek.',
    tanggal_simpan: new Date().toISOString(),
  },
];

const INITIAL_PROJECTS: FreelanceProjectItem[] = [
  {
    id: 'proj-1',
    judul: 'Landing Page Villa & Private Pool (Direct Booking WA)',
    klien: 'Owner Villa Songgoriti, Batu',
    tipe: 'Proyek Web',
    nominal: 'Rp 3.500.000',
    status: 'Pengerjaan',
    kontak: '081234908812',
    catatan: 'DP 50% diterima. Pengerjaan 3 hari selesai.',
  },
  {
    id: 'proj-2',
    judul: 'Pemeliharaan Web & Update Konten Bulanan (Retainer)',
    klien: 'Kontraktor & Desain Interior Malang',
    tipe: 'Retainer IT',
    nominal: 'Rp 750.000 / bln',
    status: 'Diskusi',
    kontak: '081230277182',
    catatan: 'Update portofolio proyek baru tiap 2 minggu.',
  },
];

interface Props {
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

export default function PeluangTab({ showToast }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'search' | 'tracker' | 'freelance' | 'profile'>('search');
  const [selectedQuery, setSelectedQuery] = useState(SEARCH_QUERIES[0]);
  const [customKeyword, setCustomKeyword] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  // Saved jobs
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>(INITIAL_JOBS);
  // Freelance projects
  const [projects, setProjects] = useState<FreelanceProjectItem[]>(INITIAL_PROJECTS);

  // Modal save job
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobJudul, setJobJudul] = useState('');
  const [jobPerusahaan, setJobPerusahaan] = useState('');
  const [jobPlatform, setJobPlatform] = useState<JobPlatform>('Glints');
  const [jobUrl, setJobUrl] = useState('');
  const [jobGaji, setJobGaji] = useState('');
  const [jobTipe, setJobTipe] = useState<'Part-time' | 'Freelance' | 'Kontrak Remote' | 'Full-time'>('Part-time');
  const [jobCatatan, setJobCatatan] = useState('');

  // Hydration safety: read local storage only on mount
  useEffect(() => {
    setHasMounted(true);
    try {
      const savedJ = localStorage.getItem('leads_jobs_v4');
      if (savedJ) {
        const parsed = JSON.parse(savedJ);
        if (Array.isArray(parsed) && parsed.length > 0) setSavedJobs(parsed);
      }
      const savedP = localStorage.getItem('leads_projects_v4');
      if (savedP) {
        const parsed = JSON.parse(savedP);
        if (Array.isArray(parsed) && parsed.length > 0) setProjects(parsed);
      }
    } catch {}
  }, []);

  const saveJobsToStorage = (next: SavedJobItem[]) => {
    setSavedJobs(next);
    try {
      localStorage.setItem('leads_jobs_v4', JSON.stringify(next));
    } catch {}
  };

  const currentQueryString = customKeyword.trim() || selectedQuery;

  const handleOpenPlatform = (platform: JobPlatform) => {
    const builder = PLATFORM_URL_BUILDERS[platform];
    if (builder) {
      window.open(builder(currentQueryString), '_blank');
    }
  };

  const handleOpenAllPlatforms = () => {
    const platforms: JobPlatform[] = ['Glints', 'JobStreet', 'LinkedIn', 'Google Jobs'];
    platforms.forEach((p) => {
      const builder = PLATFORM_URL_BUILDERS[p];
      if (builder) window.open(builder(currentQueryString), '_blank');
    });
    showToast('success', `Membuka 4 portal pencarian kerja untuk "${currentQueryString}".`);
  };

  const handleSaveJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobJudul.trim() || !jobPerusahaan.trim()) {
      showToast('error', 'Judul posisi dan nama perusahaan wajib diisi.');
      return;
    }

    const newItem: SavedJobItem = {
      id: `job-${Date.now()}`,
      judul: jobJudul.trim(),
      perusahaan: jobPerusahaan.trim(),
      platform: jobPlatform,
      url_lowongan: jobUrl.trim() || undefined,
      estimasi_gaji: jobGaji.trim() || '—',
      status: 'Baru',
      tipe: jobTipe,
      catatan: jobCatatan.trim() || undefined,
      tanggal_simpan: new Date().toISOString(),
    };

    saveJobsToStorage([newItem, ...savedJobs]);
    setIsJobModalOpen(false);
    setJobJudul('');
    setJobPerusahaan('');
    setJobUrl('');
    setJobGaji('');
    setJobCatatan('');
    showToast('success', `Lowongan ${newItem.judul} berhasil disimpan!`);
  };

  const handleUpdateJobStatus = (jobId: string, nextStatus: SavedJobItem['status']) => {
    const next = savedJobs.map((j) => (j.id === jobId ? { ...j, status: nextStatus } : j));
    saveJobsToStorage(next);
    showToast('success', 'Status lamaran diperbarui.');
  };

  const handleDeleteJob = (jobId: string) => {
    const next = savedJobs.filter((j) => j.id !== jobId);
    saveJobsToStorage(next);
    showToast('success', 'Lowongan dihapus dari daftar.');
  };

  return (
    <div className="flex flex-col w-full gap-5 pb-8">
      {/* 1. Header & Sub-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0EEE7] pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip
            active={activeSubTab === 'search'}
            onClick={() => setActiveSubTab('search')}
          >
            🔍 Cari Lowongan (7 Platform)
          </Chip>
          <Chip
            active={activeSubTab === 'tracker'}
            count={savedJobs.length}
            onClick={() => setActiveSubTab('tracker')}
          >
            📋 Pelacak Lamaran
          </Chip>
          <Chip
            active={activeSubTab === 'freelance'}
            count={projects.length}
            onClick={() => setActiveSubTab('freelance')}
          >
            💼 Proyek &amp; Retainer
          </Chip>
          <Chip
            active={activeSubTab === 'profile'}
            onClick={() => setActiveSubTab('profile')}
          >
            👤 Profil &amp; CV Cepat
          </Chip>
        </div>

        {activeSubTab === 'tracker' && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsJobModalOpen(true)}
          >
            + Simpan Lowongan Baru
          </Button>
        )}
      </div>

      {/* 2. Peringatan Penipuan (PRD 15.x Anti-Scam Guard) */}
      <div className="p-3.5 rounded-[10px] bg-[#FFF1D6]/40 border border-[#FFE3B3] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[12px] text-[#8A5300]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[14px]">⚠️ Radar Anti-Penipuan Loker:</span>
          <span>
            Hindari lowongan yang meminta uang pendaftaran, biaya seragam, atau tugas klik medsos berbayar tak wajar.
          </span>
        </div>
        <span className="font-medium text-[#8A5300] shrink-0 underline cursor-default">
          Legal &amp; Tanpa Scraping
        </span>
      </div>

      {/* TAB 1: CARI LOWONGAN & GENERATOR LINK (PRD 15.x) */}
      {activeSubTab === 'search' && (
        <div className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-[#1B1B18]">
                Generator Tautan Pencarian Kerja Terarah
              </h3>
              <p className="text-[13px] text-[#6B6A63] mt-0.5">
                Pilih kata kunci spesifik dan buka hasil pencarian resmi di 7 portal lowongan terpercaya dalam 1 klik.
              </p>
            </div>

            {/* Keyword Chips */}
            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-[#6B6A63] font-medium">Kata Kunci Populer:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {SEARCH_QUERIES.map((q) => (
                  <Chip
                    key={q}
                    active={selectedQuery === q && !customKeyword.trim()}
                    onClick={() => {
                      setSelectedQuery(q);
                      setCustomKeyword('');
                    }}
                  >
                    {q}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                placeholder="Atau ketik kata kunci lain (misal: WordPress Elementor Malang)…"
                className="flex-1 h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleOpenAllPlatforms}
              >
                Buka di 4 Platform Sekaligus
              </Button>
            </div>
          </Card>

          {/* 7 Platform Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(
              [
                { platform: 'Glints', desc: 'Cocok untuk junior frontend & remote startup' },
                { platform: 'JobStreet', desc: 'Portal korporasi & perusahaan lokal terbesar' },
                { platform: 'LinkedIn', desc: 'Koneksi langsung dengan founder & HR recruiter' },
                { platform: 'Kalibrr', desc: 'Peluang magang & junior IT developer' },
                { platform: 'Indeed', desc: 'Agregator lowongan remote & hybrid global' },
                { platform: 'Loker.id', desc: 'Spesialis lowongan UMKM & bisnis lokal' },
                { platform: 'Google Jobs', desc: 'Pencarian instan langsung di Google Search' },
              ] as const
            ).map((item) => (
              <Card
                key={item.platform}
                className="p-4 flex flex-col justify-between hover:border-[#0B7A55]/40 transition group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[#1B1B18] group-hover:text-[#0B7A55]">
                      {item.platform}
                    </span>
                    <Badge variant="antre">Resmi</Badge>
                  </div>
                  <p className="text-[12px] text-[#6B6A63] mt-1.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0EEE7]">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full text-center"
                    onClick={() => handleOpenPlatform(item.platform)}
                  >
                    Cari di {item.platform} ↗
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PELACAK LAMARAN (PRD 15.x Tracker) */}
      {activeSubTab === 'tracker' && (
        <Card className="flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EEE7] flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[#1B1B18]">
              Daftar Lowongan Tersimpan &amp; Status Lamaran
            </h3>
            <span className="text-[12px] text-[#6B6A63]">
              {savedJobs.length} posisi terpantau
            </span>
          </div>

          <div className="overflow-x-auto">
            {savedJobs.length === 0 ? (
              <div className="p-8 text-center text-[#6B6A63] text-[13px]">
                Belum ada lowongan tersimpan. Temukan lowongan dari tab &ldquo;Cari Lowongan&rdquo; lalu klik &ldquo;Simpan Lowongan Baru&rdquo;.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#F0EEE7] text-[12px] font-normal text-[#6B6A63]">
                    <th className="py-3 px-5 font-normal">Posisi &amp; Perusahaan</th>
                    <th className="py-3 px-5 font-normal">Portal</th>
                    <th className="py-3 px-5 font-normal">Tipe &amp; Gaji</th>
                    <th className="py-3 px-5 font-normal">Status Lamaran</th>
                    <th className="py-3 px-5 font-normal">Catatan</th>
                    <th className="py-3 px-5 font-normal text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEE7] text-[13px]">
                  {savedJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-[#F7F6F2]/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-[#1B1B18]">{job.judul}</div>
                        <div className="text-[12px] text-[#6B6A63] mt-0.5">{job.perusahaan}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge variant="antre">{job.platform}</Badge>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="text-[12px] font-medium text-[#1B1B18]">{job.tipe}</div>
                        <div className="text-[11px] text-[#0B7A55] font-semibold tabular-nums mt-0.5">
                          {job.estimasi_gaji}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <select
                          value={job.status}
                          onChange={(e) => handleUpdateJobStatus(job.id, e.target.value as any)}
                          className="h-7 px-2 text-[12px] rounded-[6px] border border-[#DAD7CC] bg-white font-medium cursor-pointer"
                        >
                          <option value="Baru">Baru Disimpan</option>
                          <option value="Dilamar">Sudah Dilamar</option>
                          <option value="Interview">Tahap Interview</option>
                          <option value="Diterima">Diterima</option>
                          <option value="Ditolak">Ditolak / Dilewati</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-5 text-[#6B6A63] text-[12px] max-w-xs truncate">
                        {job.catatan || '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {job.url_lowongan && (
                            <a
                              href={job.url_lowongan}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[12px] text-[#0B7A55] hover:underline"
                            >
                              Buka ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-[12px] text-[#B3261E] hover:underline ml-2 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* TAB 3: PROYEK FREELANCE & RETAINER */}
      {activeSubTab === 'freelance' && (
        <Card className="flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0EEE7] flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[#1B1B18]">
              Papan Proyek Web &amp; Retainer IT Aktif
            </h3>
            <span className="text-[12px] text-[#6B6A63]">
              {projects.length} kontrak terdaftar
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0EEE7] text-[12px] font-normal text-[#6B6A63]">
                  <th className="py-3 px-5 font-normal">Nama Pekerjaan</th>
                  <th className="py-3 px-5 font-normal">Klien / Lokasi</th>
                  <th className="py-3 px-5 font-normal">Tipe</th>
                  <th className="py-3 px-5 font-normal">Fee / Nilai</th>
                  <th className="py-3 px-5 font-normal">Status</th>
                  <th className="py-3 px-5 font-normal text-right">Kontak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE7] text-[13px]">
                {projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-[#F7F6F2]/50 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-[#1B1B18]">
                      {proj.judul}
                    </td>
                    <td className="py-3.5 px-5 text-[#6B6A63]">{proj.klien}</td>
                    <td className="py-3.5 px-5">
                      <Badge variant={proj.tipe === 'Proyek Web' ? 'sukses' : 'hangat'}>
                        {proj.tipe}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[#0B7A55] tabular-nums">
                      {proj.nominal}
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge variant="antre">{proj.status}</Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-[12px] text-[#6B6A63]">
                      {proj.kontak}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: PROFIL PENCARI KERJA (PRD 15.x Profile) */}
      {activeSubTab === 'profile' && (
        <Card className="p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between border-b border-[#F0EEE7] pb-4">
            <div>
              <h3 className="text-[18px] font-bold text-[#1B1B18]">Kevin</h3>
              <p className="text-[13px] text-[#6B6A63] mt-0.5">
                Solo Freelancer (18 Tahun) · Junior Frontend &amp; Web Developer
              </p>
            </div>
            <Badge variant="sukses">Tersedia untuk Proyek</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#1B1B18]">Spesialisasi Teknis:</span>
              <ul className="list-disc list-inside space-y-1 text-[#6B6A63]">
                <li>Next.js App Router, React, TypeScript</li>
                <li>Tailwind CSS Mobile-First Design &amp; Clean UI</li>
                <li>Integrasi WhatsApp Gateway (Fonnte) &amp; Webhook Realtime</li>
                <li>Pembuatan Landing Page Bisnis Lokal (Villa, Klinik, Kontraktor)</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#1B1B18]">Standar Tarif Jasa:</span>
              <ul className="list-disc list-inside space-y-1 text-[#6B6A63]">
                <li>Landing Page UMKM Esensial: Rp 2.500.000 (3 hari kerja)</li>
                <li>Website Bisnis Juara (SEO + Direct WA): Rp 3.500.000</li>
                <li>Retainer IT Pemeliharaan: Rp 750.000 - Rp 1.000.000 / bulan</li>
                <li>Part-time Developer: Rp 2.500.000 - Rp 4.000.000 / bulan</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Modal Simpan Lowongan Baru */}
      {isJobModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md p-5 flex flex-col gap-4 shadow-xl rounded-[14px]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1B18]">Simpan Lowongan Baru</h3>
                <p className="text-[12px] text-[#6B6A63] mt-0.5">
                  Catat posisi menarik yang ditemukan dari portal lowongan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsJobModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[#6B6A63] font-medium">Judul Posisi</label>
                <input
                  type="text"
                  value={jobJudul}
                  onChange={(e) => setJobJudul(e.target.value)}
                  placeholder="misal: Junior Web Developer Part-time"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#DAD7CC] text-[13px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[#6B6A63] font-medium">Nama Perusahaan / Klien</label>
                <input
                  type="text"
                  value={jobPerusahaan}
                  onChange={(e) => setJobPerusahaan(e.target.value)}
                  placeholder="misal: Agensi Kreatif Surabaya"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#DAD7CC] text-[13px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#6B6A63] font-medium">Portal / Sumber</label>
                  <select
                    value={jobPlatform}
                    onChange={(e) => setJobPlatform(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-[6px] border border-[#DAD7CC] text-[13px]"
                  >
                    <option value="Glints">Glints</option>
                    <option value="JobStreet">JobStreet</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Kalibrr">Kalibrr</option>
                    <option value="Indeed">Indeed</option>
                    <option value="Loker.id">Loker.id</option>
                    <option value="Google Jobs">Google Jobs</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[#6B6A63] font-medium">Tipe Pekerjaan</label>
                  <select
                    value={jobTipe}
                    onChange={(e) => setJobTipe(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-[6px] border border-[#DAD7CC] text-[13px]"
                  >
                    <option value="Part-time">Part-time</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Kontrak Remote">Kontrak Remote</option>
                    <option value="Full-time">Full-time</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[#6B6A63] font-medium">Estimasi Gaji / Fee</label>
                <input
                  type="text"
                  value={jobGaji}
                  onChange={(e) => setJobGaji(e.target.value)}
                  placeholder="misal: Rp 3.000.000 / bln"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#DAD7CC] text-[13px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[#6B6A63] font-medium">URL Lowongan (Opsional)</label>
                <input
                  type="text"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#DAD7CC] text-[13px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] text-[#6B6A63] font-medium">Catatan Persiapan</label>
                <textarea
                  rows={2}
                  value={jobCatatan}
                  onChange={(e) => setJobCatatan(e.target.value)}
                  placeholder="misal: Butuh kirim CV sebelum tanggal 5..."
                  className="w-full p-2 rounded-[6px] border border-[#DAD7CC] text-[12px] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0EEE7]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsJobModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Simpan ke Pelacak
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
