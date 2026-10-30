'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';

export interface PeluangItem {
  id: string;
  judul: string;
  klien_atau_perusahaan: string;
  tipe: 'Proyek Web' | 'Part-time' | 'Retainer IT';
  estimasi_bayaran: string;
  lokasi: string;
  status: 'Baru' | 'Dilamar' | 'Diskusi' | 'Diterima' | 'Dilewati';
  tautan_atau_kontak?: string;
  catatan?: string;
  dibuat_at: string;
}

const INITIAL_PELUANG: PeluangItem[] = [
  {
    id: 'peluang-1',
    judul: 'Landing Page Villa & Private Pool (Direct Booking WA)',
    klien_atau_perusahaan: 'Owner Villa Songgoriti, Batu',
    tipe: 'Proyek Web',
    estimasi_bayaran: 'Rp 3.500.000',
    lokasi: 'Batu, Jawa Timur',
    status: 'Baru',
    tautan_atau_kontak: '081234908812',
    catatan: 'Prioritas tinggi, butuh website 3 hari selesai agar tidak kena potongan OTA 15%.',
    dibuat_at: new Date().toISOString(),
  },
  {
    id: 'peluang-2',
    judul: 'Website Profil & Jadwal Dokter Gigi Spesialis',
    klien_atau_perusahaan: 'Klinik Gigi Mandiri Surabaya Barat',
    tipe: 'Proyek Web',
    estimasi_bayaran: 'Rp 3.000.000',
    lokasi: 'Surabaya, Jawa Timur',
    status: 'Baru',
    tautan_atau_kontak: '082152006161',
    catatan: 'Butuh tombol reservasi WA langsung ke resepsionis & QR Maps meja.',
    dibuat_at: new Date().toISOString(),
  },
  {
    id: 'peluang-3',
    judul: 'Pemeliharaan Web & Update Konten Bulanan (Retainer)',
    klien_atau_perusahaan: 'Kontraktor & Desain Interior Malang',
    tipe: 'Retainer IT',
    estimasi_bayaran: 'Rp 750.000 / bln',
    lokasi: 'Malang, Jawa Timur',
    status: 'Diskusi',
    tautan_atau_kontak: '081230277182',
    catatan: 'Update portofolio proyek baru tiap 2 minggu dan monitor domain/hosting.',
    dibuat_at: new Date().toISOString(),
  },
];

interface Props {
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

export default function PeluangTab({ showToast }: Props) {
  const [items, setItems] = useState<PeluangItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('leads_peluang_v4');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_PELUANG;
  });

  const [activeFilter, setActiveFilter] = useState<string>('SEMUA');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form input
  const [judul, setJudul] = useState('');
  const [perusahaan, setPerusahaan] = useState('');
  const [tipe, setTipe] = useState<'Proyek Web' | 'Part-time' | 'Retainer IT'>('Proyek Web');
  const [bayaran, setBayaran] = useState('');
  const [lokasi, setLokasi] = useState('Malang / Jawa Timur');
  const [kontak, setKontak] = useState('');
  const [catatan, setCatatan] = useState('');

  const saveItems = (next: PeluangItem[]) => {
    setItems(next);
    try {
      localStorage.setItem('leads_peluang_v4', JSON.stringify(next));
    } catch {}
  };

  const handleAddPeluang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !perusahaan.trim()) {
      showToast('error', 'Judul dan nama klien/perusahaan wajib diisi.');
      return;
    }
    const newItem: PeluangItem = {
      id: `peluang-${Date.now()}`,
      judul: judul.trim(),
      klien_atau_perusahaan: perusahaan.trim(),
      tipe,
      estimasi_bayaran: bayaran.trim() || 'Rp 2.500.000',
      lokasi: lokasi.trim() || 'Jawa Timur',
      status: 'Baru',
      tautan_atau_kontak: kontak.trim(),
      catatan: catatan.trim(),
      dibuat_at: new Date().toISOString(),
    };
    const next = [newItem, ...items];
    saveItems(next);
    showToast('success', 'Peluang berhasil ditambahkan ke pelacak.');
    setIsModalOpen(false);
    setJudul('');
    setPerusahaan('');
    setBayaran('');
    setCatatan('');
  };

  const handleStatusChange = (id: string, newStatus: PeluangItem['status']) => {
    const next = items.map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );
    saveItems(next);
    showToast('success', `Status diperbarui ke ${newStatus}.`);
  };

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'SEMUA') return true;
    return item.status === activeFilter;
  });

  return (
    <div className="flex flex-col w-full gap-5 pb-8">
      {/* 1. Header Pelacak Peluang */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#1B1B18]">
            Pelacak Proyek &amp; Pemasukan Penopang
          </h2>
          <p className="text-[13px] text-[#6B6A63] mt-0.5">
            Kelola lowongan proyek freelance lokal, website UMKM, dan pekerjaan IT pendamping untuk mengejar target Rp 100 jt.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="shrink-0"
        >
          + Tambah Peluang Baru
        </Button>
      </Card>

      {/* 2. Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['SEMUA', 'Baru', 'Dilamar', 'Diskusi', 'Diterima', 'Dilewati'] as const).map((st) => (
          <Chip
            key={st}
            active={activeFilter === st}
            onClick={() => setActiveFilter(st)}
            count={st === 'SEMUA' ? items.length : items.filter((i) => i.status === st).length}
          >
            {st}
          </Chip>
        ))}
      </div>

      {/* 3. List Peluang Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#6B6A63] text-[13px]">
            Belum ada peluang pada status ini. Klik &ldquo;+ Tambah Peluang Baru&rdquo; untuk mencatat proyek.
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-medium text-[#0B7A55] bg-[#E4F3EC] px-2 py-0.5 rounded-full">
                    {item.tipe}
                  </span>
                  <Badge
                    variant={
                      item.status === 'Diterima'
                        ? 'sukses'
                        : item.status === 'Diskusi'
                        ? 'hangat'
                        : item.status === 'Dilewati'
                        ? 'gagal'
                        : 'antre'
                    }
                  >
                    {item.status}
                  </Badge>
                </div>

                <h3 className="text-[15px] font-semibold text-[#1B1B18] mt-2 leading-snug">
                  {item.judul}
                </h3>
                <div className="text-[13px] text-[#6B6A63] mt-0.5">
                  {item.klien_atau_perusahaan} · {item.lokasi}
                </div>

                <div className="text-[14px] font-bold text-[#1B1B18] mt-2.5 tabular-nums">
                  {item.estimasi_bayaran}
                </div>

                {item.catatan && (
                  <p className="text-[12px] text-[#6B6A63] mt-2 bg-[#F7F6F2] p-2 rounded-[6px] leading-relaxed">
                    {item.catatan}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-[#F0EEE7] flex items-center justify-between gap-2">
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                  className="h-8 px-2 text-[12px] rounded-[6px] bg-white border border-[#DAD7CC] text-[#1B1B18] cursor-pointer"
                >
                  <option value="Baru">Baru</option>
                  <option value="Dilamar">Dilamar</option>
                  <option value="Diskusi">Diskusi</option>
                  <option value="Diterima">Diterima</option>
                  <option value="Dilewati">Dilewati</option>
                </select>

                {item.tautan_atau_kontak && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (item.tautan_atau_kontak?.startsWith('08') || item.tautan_atau_kontak?.startsWith('62')) {
                        const clean = item.tautan_atau_kontak.replace(/\D/g, '');
                        window.open(`https://wa.me/${clean}`, '_blank');
                      } else {
                        window.open(item.tautan_atau_kontak, '_blank');
                      }
                    }}
                  >
                    Hubungi
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal Tambah Peluang */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1B18]">
                  Tambah Peluang Baru
                </h3>
                <p className="text-[13px] text-[#6B6A63] mt-0.5">
                  Catat penawaran proyek atau lowongan freelance penopang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup modal"
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddPeluang} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Judul Proyek / Pekerjaan</label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="contoh: Landing Page Villa Batu Direct Booking"
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Nama Klien / Perusahaan</label>
                <input
                  type="text"
                  value={perusahaan}
                  onChange={(e) => setPerusahaan(e.target.value)}
                  placeholder="contoh: Owner Villa Songgoriti"
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-[#6B6A63] font-medium">Tipe</label>
                  <select
                    value={tipe}
                    onChange={(e) => setTipe(e.target.value as any)}
                    className="w-full h-9 px-2 text-[13px] rounded-[8px] bg-white border border-[#DAD7CC] text-[#1B1B18]"
                  >
                    <option value="Proyek Web">Proyek Web</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Retainer IT">Retainer IT</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-[#6B6A63] font-medium">Estimasi Bayaran</label>
                  <input
                    type="text"
                    value={bayaran}
                    onChange={(e) => setBayaran(e.target.value)}
                    placeholder="contoh: Rp 3.500.000"
                    className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Nomor WhatsApp / Tautan</label>
                <input
                  type="text"
                  value={kontak}
                  onChange={(e) => setKontak(e.target.value)}
                  placeholder="contoh: 08123456789 atau https://..."
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Catatan Khusus</label>
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Kebutuhan khusus klien, timeline, dll."
                  className="w-full p-2.5 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0EEE7]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  Simpan Peluang
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
