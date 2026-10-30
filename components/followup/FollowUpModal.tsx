'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FollowUpItem } from '@/app/api/followup/route';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
  onFollowUpSent?: () => void;
}

export function FollowUpModal({
  isOpen,
  onClose,
  showToast,
  onFollowUpSent,
}: Props) {
  const [queue, setQueue] = useState<FollowUpItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  // Check working hours (08:30 - 16:30 WIB)
  const isWorkingHours = (() => {
    const now = new Date();
    // UTC+7 for WIB
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const wibHours = (utcHours + 7) % 24;
    const wibTimeNum = wibHours + utcMinutes / 60;
    return wibTimeNum >= 8.5 && wibTimeNum <= 16.5;
  })();

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/followup');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.queue)) {
        setQueue(data.queue);
        setSelectedIds(new Set(data.queue.map((item: FollowUpItem) => item.leadId)));
        const msgMap: Record<string, string> = {};
        for (const item of data.queue) {
          msgMap[item.leadId] = item.pesanTemplate;
        }
        setEditedMessages(msgMap);
      }
    } catch {
      showToast('error', 'Gagal memuat antrean follow-up.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQueue();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === queue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.map((q) => q.leadId)));
    }
  };

  const handleSendSelected = async () => {
    const selectedItems = queue.filter((q) => selectedIds.has(q.leadId));
    if (selectedItems.length === 0) {
      showToast('warn', 'Pilih minimal satu prospek untuk difollow-up.');
      return;
    }

    setIsSending(true);
    setSendProgress({ current: 0, total: selectedItems.length });

    try {
      const payloadItems = selectedItems.map((q) => ({
        leadId: q.leadId,
        phone: q.phone,
        message: editedMessages[q.leadId] || q.pesanTemplate,
        tahap: q.tahap,
      }));

      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', `${data.sentCount} pesan follow-up berhasil diproses.`);
        onFollowUpSent?.();
        onClose();
      } else {
        showToast('error', data.error || 'Gagal mengirim follow-up.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col p-6 bg-white shadow-xl overflow-hidden rounded-[14px]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#F0EEE7]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold text-[#1B1B18] tracking-tight">
                Follow-up Hari Ini
              </h2>
              <Badge variant="antre">{queue.length} antrean</Badge>
              {!isWorkingHours && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFF1D6] text-[#8A5300] font-medium">
                  Di luar jam kerja (08.30-16.30 WIB)
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#6B6A63] mt-1">
              Prinsip manusia di loop: Tinjau dan setujui pesan sebelum dikirim. Jeda aman 45–90 detik diterapkan otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-[#6B6A63] hover:text-[#1B1B18] hover:bg-black/5 flex items-center justify-center transition cursor-pointer text-[16px]"
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-[13px] text-[#6B6A63]">
              Memeriksa antrean prospek yang jatuh tempo follow-up…
            </div>
          ) : queue.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#E4F3EC] text-[#0B7A55] flex items-center justify-center font-bold">
                ✓
              </div>
              <p className="text-[14px] font-medium text-[#1B1B18]">
                Semua prospek sudah tertangani
              </p>
              <p className="text-[13px] text-[#6B6A63] max-w-md">
                Tidak ada prospek yang jatuh tempo H+2 atau H+4 hari ini. Prospek yang baru dikirimi akan muncul di sini setelah 2 hari tanpa balasan.
              </p>
            </div>
          ) : (
            queue.map((item) => {
              const isSelected = selectedIds.has(item.leadId);
              return (
                <div
                  key={item.leadId}
                  className={`p-3.5 rounded-[10px] border transition ${
                    isSelected
                      ? 'border-[#0B7A55]/40 bg-[#F7F6F2]/60'
                      : 'border-[#ECEAE2] bg-white opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.leadId)}
                        className="w-4 h-4 rounded text-[#0B7A55] focus:ring-[#0B7A55] border-[#DAD7CC] cursor-pointer"
                      />
                      <span className="text-[14px] font-semibold text-[#1B1B18]">
                        {item.businessName}
                      </span>
                      <span className="text-[12px] text-[#6B6A63]">· {item.city}</span>
                    </label>

                    <Badge variant={item.tahap === 1 ? 'hangat' : 'antre'}>
                      {item.tahapLabel}
                    </Badge>
                  </div>

                  <div className="text-[12px] text-[#6B6A63] mb-2 flex items-center gap-3">
                    <span>Nomor: <strong className="text-[#1B1B18] font-mono">{item.phone}</strong></span>
                    <span>·</span>
                    <span>{item.hariSejakPesan} hari sejak kontak terakhir</span>
                  </div>

                  <textarea
                    rows={3}
                    value={editedMessages[item.leadId] || ''}
                    onChange={(e) =>
                      setEditedMessages((prev) => ({ ...prev, [item.leadId]: e.target.value }))
                    }
                    className="w-full p-2.5 text-[12px] rounded-[6px] border border-[#DAD7CC] bg-white text-[#1B1B18] focus:outline-2 focus:outline-[#0B7A55] resize-none"
                    placeholder="Isi pesan follow-up..."
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {queue.length > 0 && (
          <div className="pt-4 border-t border-[#F0EEE7] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[13px] text-[#0B7A55] hover:underline cursor-pointer"
              >
                {selectedIds.size === queue.length ? 'Batalkan Semua' : 'Pilih Semua'}
              </button>
              <span className="text-[12px] text-[#6B6A63]">
                ({selectedIds.size} dari {queue.length} dipilih)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSending}>
                Lewati Hari Ini
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSendSelected}
                disabled={isSending || selectedIds.size === 0}
              >
                {isSending
                  ? `Mengirim (${sendProgress?.current || 0}/${sendProgress?.total || 0})…`
                  : `Setujui & Kirim (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
