'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PengaturanModel, SheetLeadRecord } from '@/types/outreach';
import { TransactionModel, ExpenseModel } from '@/lib/transaction-store';

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
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [expenses, setExpenses] = useState<ExpenseModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit target inputs
  const [targetNominalInput, setTargetNominalInput] = useState(String(settings.target_nominal || 100000000));
  const [targetDateInput, setTargetDateInput] = useState(settings.target_tanggal || '2028-10-30');
  const [targetLabelInput, setTargetLabelInput] = useState(settings.target_label || 'Target Menuju Rp 100 Jt');
  const [isSaving, setIsSaving] = useState(false);

  // Expense form input
  const [expenseJudul, setExpenseJudul] = useState('');
  const [expenseKategori, setExpenseKategori] = useState<'Domain & Server' | 'WhatsApp Gateway' | 'Operasional' | 'Alat Kerja'>('Domain & Server');
  const [expenseNominal, setExpenseNominal] = useState('');

  const fetchFinancials = useCallback(async () => {
    try {
      const [resTx, resExp] = await Promise.all([
        fetch('/api/deals/close').then((r) => r.json()).catch(() => ({ success: false })),
        fetch('/api/expenses').then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (resTx.success && Array.isArray(resTx.transactions)) {
        setTransactions(resTx.transactions);
      }
      if (resExp.success && Array.isArray(resExp.expenses)) {
        setExpenses(resExp.expenses);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  // Closed records from sheets
  const closedRecords = records.filter((r) => r.status === 'CLOSED_DEAL');

  // Total cash revenue received (DP masuk + Lunas)
  const txRevenue = transactions.reduce((acc, t) => acc + (t.dp_masuk || 0), 0);
  const totalPiutang = transactions.reduce((acc, t) => acc + (t.sisa_piutang || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.nominal || 0), 0);

  // If no transactions yet, estimate from closedRecords
  const fallbackRevenue = closedRecords.reduce((acc, r) => {
    const val = r.category?.toLowerCase().includes('villa') ? 3500000 : 2500000;
    return acc + val;
  }, 0);

  const totalCashIn = txRevenue > 0 ? txRevenue : fallbackRevenue;
  const netProfit = Math.max(0, totalCashIn - totalExpenses);

  // Allocation 70 / 20 / 10 (PRD 14.x)
  const alokasiTabungan100Jt = Math.round(netProfit * 0.7);
  const alokasiBiayaHidup = Math.round(netProfit * 0.2);
  const alokasiDaruratUpgrade = Math.round(netProfit * 0.1);

  const targetNominal = settings.target_nominal || 100_000_000;
  const progressPct = Math.min(100, Math.round((totalCashIn / targetNominal) * 100));

  // Time calculations
  const targetDate = new Date(settings.target_tanggal || '2028-10-30T00:00:00');
  const now = new Date();
  const diffDays = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const diffMonths = Math.max(1, Math.ceil(diffDays / 30.5));
  const neededPerMonth = Math.round((targetNominal - totalCashIn) / diffMonths);

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
      showToast('error', 'Gagal menyimpan target.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = parseInt(expenseNominal.replace(/\D/g, ''), 10);
    if (!expenseJudul.trim() || isNaN(nom) || nom <= 0) {
      showToast('error', 'Isi judul dan nominal pengeluaran dengan benar.');
      return;
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          judul: expenseJudul.trim(),
          kategori: expenseKategori,
          nominal: nom,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', 'Pengeluaran berhasil dicatat.');
        setExpenseJudul('');
        setExpenseNominal('');
        setIsExpenseModalOpen(false);
        fetchFinancials();
      } else {
        showToast('error', data.error || 'Gagal menyimpan pengeluaran.');
      }
    } catch {
      showToast('error', 'Kesalahan koneksi saat menyimpan pengeluaran.');
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
              Rp {totalCashIn.toLocaleString('id-ID')}
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

      {/* 2. Empat Kartu Arus Kas (Pemasukan, Piutang, Pengeluaran, Laba) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Pemasukan Kas (DP + Pelunasan)</span>
          <div className="text-[22px] font-bold text-[#1B1B18] mt-1 tabular-nums">
            Rp {totalCashIn.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#0B6B4A] mt-2 border-t border-[#F0EEE7] pt-1.5 font-medium">
            {closedRecords.length + transactions.length} deal / pembayaran masuk
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Sisa Piutang Klien</span>
          <div className="text-[22px] font-bold text-[#8A5300] mt-1 tabular-nums">
            Rp {totalPiutang.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#6B6A63] mt-2 border-t border-[#F0EEE7] pt-1.5">
            Pelunasan 50% setelah website tuntas
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Pengeluaran Operasional</span>
          <div className="text-[22px] font-bold text-[#B3261E] mt-1 tabular-nums">
            Rp {totalExpenses.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#6B6A63] mt-2 border-t border-[#F0EEE7] pt-1.5">
            Domain, Hosting, Fonnte WA Gateway
          </span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[12px] text-[#6B6A63] font-normal">Laba Bersih Siap Alokasi</span>
          <div className="text-[22px] font-bold text-[#0B7A55] mt-1 tabular-nums">
            Rp {netProfit.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#6B6A63] mt-2 border-t border-[#F0EEE7] pt-1.5">
            Setelah dikurangi beban operasional
          </span>
        </Card>
      </div>

      {/* 3. Pembagian & Alokasi Hasil 70 / 20 / 10 (PRD 14.x) */}
      <Card className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#F0EEE7] pb-2.5">
          <h3 className="text-[15px] font-semibold text-[#1B1B18]">
            Alokasi Hasil & Kunci Target (70 / 20 / 10)
          </h3>
          <span className="text-[12px] text-[#6B6A63]">
            Rumus disiplin solo freelancer mencapai Rp 100 Jt
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-[10px] bg-[#E4F3EC]/50 border border-[#CDE9DC] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#0B6B4A]">70% Tabungan Target</span>
                <Badge variant="sukses">Utama</Badge>
              </div>
              <p className="text-[11px] text-[#0B6B4A]/90 mt-1">
                Kunci target tabungan pribadi menuju Rp 100 Juta sebelum usia 20 tahun.
              </p>
            </div>
            <div className="text-[18px] font-bold text-[#0B7A55] mt-3 tabular-nums">
              Rp {alokasiTabungan100Jt.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="p-3.5 rounded-[10px] bg-[#F7F6F2] border border-[#ECEAE2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#1B1B18]">20% Biaya Hidup</span>
                <Badge variant="antre">Kebutuhan</Badge>
              </div>
              <p className="text-[11px] text-[#6B6A63] mt-1">
                Biaya hidup bulanan, makan, transportasi, dan kebutuhan harian pribadi.
              </p>
            </div>
            <div className="text-[18px] font-bold text-[#1B1B18] mt-3 tabular-nums">
              Rp {alokasiBiayaHidup.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="p-3.5 rounded-[10px] bg-[#FFF1D6]/40 border border-[#FFE3B3] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#8A5300]">10% Darurat & Alat</span>
                <Badge variant="hangat">Cadangan</Badge>
              </div>
              <p className="text-[11px] text-[#8A5300]/90 mt-1">
                Dana darurat dan upgrade alat kerja (upgrade RAM/SSD laptop, mouse, charger).
              </p>
            </div>
            <div className="text-[18px] font-bold text-[#8A5300] mt-3 tabular-nums">
              Rp {alokasiDaruratUpgrade.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Tabel Transaksi Closing & Piutang */}
      <Card className="flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EEE7] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1B1B18]">
              Riwayat Transaksi Closing & Piutang
            </h3>
            <span className="text-[12px] text-[#6B6A63]">
              {transactions.length > 0 ? `${transactions.length} transaksi tercatat` : `${closedRecords.length} deal dari Sheets`}
            </span>
          </div>
          <span className="text-[12px] text-[#0B7A55] font-medium">
            Otomatis terhubung dengan Deal Room
          </span>
        </div>

        <div className="overflow-x-auto">
          {transactions.length === 0 && closedRecords.length === 0 ? (
            <div className="p-8 text-center text-[#6B6A63] text-[13px]">
              Belum ada closing deal. Tarik kartu ke kolom &ldquo;Closing&rdquo; di Deal Room untuk mencatat pembayaran.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0EEE7] text-[12px] font-normal text-[#6B6A63]">
                  <th className="py-3 px-5 font-normal">Klien</th>
                  <th className="py-3 px-5 font-normal">Paket</th>
                  <th className="py-3 px-5 font-normal">Total Nilai</th>
                  <th className="py-3 px-5 font-normal">Uang Masuk</th>
                  <th className="py-3 px-5 font-normal">Sisa Piutang</th>
                  <th className="py-3 px-5 font-normal">Status</th>
                  <th className="py-3 px-5 font-normal">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE7] text-[13px]">
                {transactions.length > 0
                  ? transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#F7F6F2]/50 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-[#1B1B18]">{tx.klien}</td>
                        <td className="py-3.5 px-5 text-[#6B6A63]">{tx.paket}</td>
                        <td className="py-3.5 px-5 font-semibold text-[#1B1B18] tabular-nums">
                          Rp {tx.total_nilai.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-[#0B7A55] tabular-nums">
                          Rp {tx.dp_masuk.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-5 text-[#8A5300] tabular-nums">
                          {tx.sisa_piutang > 0 ? `Rp ${tx.sisa_piutang.toLocaleString('id-ID')}` : '—'}
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge variant={tx.status_pembayaran === 'Lunas' ? 'sukses' : 'hangat'}>
                            {tx.status_pembayaran}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-[#6B6A63] tabular-nums">
                          {tx.tanggal.slice(0, 10)}
                        </td>
                      </tr>
                    ))
                  : closedRecords.map((rec) => {
                      const dealVal = rec.category?.toLowerCase().includes('villa') ? 3500000 : 2500000;
                      return (
                        <tr key={rec.id} className="hover:bg-[#F7F6F2]/50 transition-colors">
                          <td className="py-3.5 px-5 font-semibold text-[#1B1B18]">{rec.businessName}</td>
                          <td className="py-3.5 px-5 text-[#6B6A63]">{rec.category}</td>
                          <td className="py-3.5 px-5 font-semibold text-[#1B1B18] tabular-nums">
                            Rp {dealVal.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-5 font-semibold text-[#0B7A55] tabular-nums">
                            Rp {dealVal.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-5 text-[#6B6A63]">—</td>
                          <td className="py-3.5 px-5">
                            <Badge variant="sukses">Lunas</Badge>
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

      {/* 5. Tabel Pengeluaran Operasional */}
      <Card className="flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EEE7] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1B1B18]">
              Pengeluaran Operasional Usaha
            </h3>
            <span className="text-[12px] text-[#6B6A63]">
              Beban rutin server, domain, dan gateway
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsExpenseModalOpen(true)}
          >
            + Catat Pengeluaran
          </Button>
        </div>

        <div className="overflow-x-auto">
          {expenses.length === 0 ? (
            <div className="p-8 text-center text-[#6B6A63] text-[13px]">
              Belum ada pengeluaran operasional dicatat.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0EEE7] text-[12px] font-normal text-[#6B6A63]">
                  <th className="py-3 px-5 font-normal">Nama Pengeluaran</th>
                  <th className="py-3 px-5 font-normal">Kategori</th>
                  <th className="py-3 px-5 font-normal">Nominal</th>
                  <th className="py-3 px-5 font-normal">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EEE7] text-[13px]">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#F7F6F2]/50 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-[#1B1B18]">{exp.judul}</td>
                    <td className="py-3.5 px-5 text-[#6B6A63]">
                      <Badge variant="antre">{exp.kategori}</Badge>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-[#B3261E] tabular-nums">
                      - Rp {exp.nominal.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-5 text-[#6B6A63] tabular-nums">
                      {exp.tanggal.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal Edit Target & Pengaturan */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md p-5 flex flex-col gap-4 shadow-xl rounded-[14px]">
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
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2]"
              >
                ✕
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

      {/* Modal Tambah Pengeluaran */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md p-5 flex flex-col gap-4 shadow-xl rounded-[14px]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1B1B18]">
                  Catat Pengeluaran Operasional
                </h3>
                <p className="text-[13px] text-[#6B6A63] mt-0.5">
                  Catat biaya server, domain, kuota, atau langganan gateway.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Nama Pengeluaran</label>
                <input
                  type="text"
                  value={expenseJudul}
                  onChange={(e) => setExpenseJudul(e.target.value)}
                  placeholder="misal: Beli domain .com untuk Villa Batu"
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Kategori</label>
                <select
                  value={expenseKategori}
                  onChange={(e) => setExpenseKategori(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55]"
                >
                  <option value="Domain & Server">Domain & Server</option>
                  <option value="WhatsApp Gateway">WhatsApp Gateway (Fonnte)</option>
                  <option value="Operasional">Operasional (Internet/Transport)</option>
                  <option value="Alat Kerja">Alat Kerja & Aksesoris</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-[#6B6A63] font-medium">Nominal (Rp)</label>
                <input
                  type="number"
                  value={expenseNominal}
                  onChange={(e) => setExpenseNominal(e.target.value)}
                  placeholder="contoh: 150000"
                  className="w-full h-9 px-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[13px] text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55] tabular-nums"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F0EEE7]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsExpenseModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Simpan Pengeluaran
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
