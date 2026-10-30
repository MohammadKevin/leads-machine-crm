'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PengaturanModel, SheetLeadRecord } from '@/types/outreach';

interface Props {
  records: SheetLeadRecord[];
  settings: PengaturanModel;
  onUpdateSettings: (settings: Partial<PengaturanModel>) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

export default function KeuanganTab({
  records,
  settings,
  onUpdateSettings,
  showToast,
}: Props) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [targetNominalInput, setTargetNominalInput] = useState(String(settings.target_nominal));
  const [targetDateInput, setTargetDateInput] = useState(settings.target_tanggal);
  const [targetLabelInput, setTargetLabelInput] = useState(settings.target_label);
  const [isSaving, setIsSaving] = useState(false);

  const closedRecords = records.filter((r) => r.status === 'CLOSED_DEAL');
  const totalRevenue = closedRecords.reduce((acc, r) => {
    const val = r.category?.toLowerCase().includes('villa') ? 3500000 : 2500000;
    return acc + val;
  }, 0);

  const targetNominal = settings.target_nominal || 100_000_000;
  const progressPct = Math.min(100, Math.round((totalRevenue / targetNominal) * 100));

  // Calculate days & months remaining
  const targetDate = new Date(settings.target_tanggal || '2028-10-30T00:00:00');
  const now = new Date();
  const diffDays = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const diffMonths = Math.max(1, Math.ceil(diffDays / 30.5));
  const neededPerMonth = Math.round((targetNominal - totalRevenue) / diffMonths);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseInt(targetNominalInput.replace(/\D/g, ''), 10);
    if (isNaN(nominal) || nominal <= 0) {
      showToast('error', 'Masukkan nominal target yang valid.');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateSettings({
        target_nominal: nominal,
        target_tanggal: targetDateInput,
        target_label: targetLabelInput.trim() || 'Target Menuju Rp 100 Jt',
      });
      setIsEditModalOpen(false);
      showToast('success', 'Pengaturan target berhasil disimpan.');
    } catch {
      showToast('error', 'Gagal menyimpan pengaturan target.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-5 pb-8">
      {/* 1. Header Target Besar Menuju Rp 100 Jt */}
      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#6B6A63] font-normal">{settings.target_label}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
          >
            Ubah Pengaturan Target
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] sm:text-[34px] font-bold text-[#1B1B18] leading-none tabular-nums">
              Rp {totalRevenue.toLocaleString('id-ID')}
            </span>
            <span className="text-[18px] sm:text-[22px] text-[#6B6A63] font-normal leading-none tabular-nums">
              / Rp {targetNominal.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex-1 lg:max-w-xl flex flex-col gap-1.5">
            <div className="w-full h-2 bg-[#ECEAE2] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0B7A55] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[13px] text-[#6B6A63] font-normal select-none">
              {progressPct}% tercapai · {diffDays} hari ({diffMonths} bulan) tersisa · butuh ~Rp{' '}
              {neededPerMonth.toLocaleString('id-ID')}/bln
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Rincian Metrik Funnel & Keuangan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Total Closing Deal</span>
          <div className="text-[24px] font-semibold text-[#1B1B18] mt-1 tabular-nums">
            {closedRecords.length}
          </div>
          <span className="text-[12px] text-[#6B6A63] mt-2 border-t border-[#F0EEE7] pt-1.5">
            Dari {records.length} kontak di database
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Rata-rata Nilai Deal</span>
          <div className="text-[24px] font-semibold text-[#1B1B18] mt-1 tabular-nums">
            {closedRecords.length > 0
              ? `Rp ${Math.round(totalRevenue / closedRecords.length).toLocaleString('id-ID')}`
              : 'Rp 2.833.333'}
          </div>
          <span className="text-[12px] text-[#0B6B4A] mt-2 border-t border-[#F0EEE7] pt-1.5 font-medium">
            Target kenaikan: Rp 4.000.000
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Pemasukan Berulang (Retainer)</span>
          <div className="text-[24px] font-semibold text-[#0B7A55] mt-1 tabular-nums">
            Rp 0 / bln
          </div>
          <span className="text-[12px] text-[#6B6A63] mt-2 border-t border-[#F0EEE7] pt-1.5">
            Target: Rp 1.000.000/bln (akhir bulan ke-3)
          </span>
        </Card>
      </div>

      {/* 3. Tabel Riwayat Closing Deal */}
      <Card className="flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EEE7] flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-[#1B1B18]">
            Riwayat Deal Closing
          </h3>
          <span className="text-[13px] text-[#6B6A63]">
            {closedRecords.length} deal tercatat
          </span>
        </div>

        <div className="overflow-x-auto">
          {closedRecords.length === 0 ? (
            <div className="p-8 text-center text-[#6B6A63] text-[13px]">
              Belum ada closing deal tercatat. Tarik kartu ke kolom &ldquo;Closing&rdquo; di Deal Room untuk mencatat pembayaran.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0EEE7] text-[12px] font-normal text-[#6B6A63]">
                  <th className="py-3 px-5 font-normal">Nama Bisnis</th>
                  <th className="py-3 px-5 font-normal">Kategori</th>
                  <th className="py-3 px-5 font-normal">Kota</th>
                  <th className="py-3 px-5 font-normal">Nilai Deal</th>
                  <th className="py-3 px-5 font-normal">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE7] text-[13px]">
                {closedRecords.map((rec) => {
                  const dealVal = rec.category?.toLowerCase().includes('villa') ? 3500000 : 2500000;
                  return (
                    <tr key={rec.id} className="hover:bg-[#F7F6F2]/50 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-[#1B1B18]">
                        {rec.businessName}
                      </td>
                      <td className="py-3.5 px-5 text-[#6B6A63]">{rec.category}</td>
                      <td className="py-3.5 px-5 text-[#6B6A63]">{rec.city || 'Jatim'}</td>
                      <td className="py-3.5 px-5 font-semibold text-[#0B7A55] tabular-nums">
                        Rp {dealVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-5 text-[#6B6A63] tabular-nums">
                        {rec.timestamp ? rec.timestamp.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal Edit Target & Pengaturan */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1B18]">
                  Pengaturan Target Pribadi
                </h3>
                <p className="text-[13px] text-[#6B6A63] mt-0.5">
                  Atur nominal target dan tanggal tenggat waktu secara dinamis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Tutup modal"
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Label Target</label>
                <input
                  type="text"
                  value={targetLabelInput}
                  onChange={(e) => setTargetLabelInput(e.target.value)}
                  placeholder="contoh: Target Menuju Rp 100 Jt"
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Nominal Target (Rp)</label>
                <input
                  type="number"
                  value={targetNominalInput}
                  onChange={(e) => setTargetNominalInput(e.target.value)}
                  placeholder="contoh: 100000000"
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55] tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Target Tanggal Selesai</label>
                <input
                  type="date"
                  value={targetDateInput}
                  onChange={(e) => setTargetDateInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0EEE7]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                >
                  {isSaving ? 'Menyimpan…' : 'Simpan Perubahan'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
