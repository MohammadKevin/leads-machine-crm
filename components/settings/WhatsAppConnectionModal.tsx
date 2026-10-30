'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PengaturanModel } from '@/types/outreach';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: PengaturanModel;
  onRefresh: () => void;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

export function WhatsAppConnectionModal({
  isOpen,
  onClose,
  settings,
  onRefresh,
  showToast,
}: Props) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Test payload to /api/fonnte/webhook
      const res = await fetch('/api/fonnte/webhook?secret=leads_machine_webhook_secret_2026', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: '6281252859295', // DRG Arif Setiawan from database
          message: 'Halo mas Kevin, boleh minta detail paket dan contoh websitenya?',
          name: 'drg. Arif Setiawan',
          device: 'Fonnte Device 01',
          timestamp: Date.now(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(
          `✓ Sukses! Webhook berhasil diproses (Matched: ${data.matched ? 'Ya' : 'Tidak'}, Status: ${data.status || 'Diterima'}).`
        );
        showToast('success', 'Uji webhook berhasil! Prospek berubah ke status Hangat.');
        onRefresh();
      } else {
        setTestResult(`Gagal: ${data.error || 'Server menolak request webhook.'}`);
        showToast('error', 'Uji webhook gagal.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kesalahan jaringan';
      setTestResult(`Error: ${msg}`);
      showToast('error', `Gagal menguji webhook: ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-lg p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#1B1B18]">
              Status Koneksi WhatsApp &amp; Webhook
            </h3>
            <p className="text-[13px] text-[#6B6A63] mt-0.5">
              Integrasi WhatsApp Gateway Fonnte &amp; deteksi balasan otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2]"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-2 gap-3 bg-[#F7F6F2] p-3.5 rounded-[10px] border border-[#DAD7CC]">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-[#6B6A63]">Status Perangkat Fonnte</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#0B7A55]" />
              <span className="text-[13px] font-semibold text-[#1B1B18]">Terhubung (Online)</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[12px] text-[#6B6A63]">Webhook 24 Jam Terakhir</span>
            <div className="text-[13px] font-semibold text-[#1B1B18] tabular-nums mt-0.5">
              {settings.webhook_count_24h || 0} pesan masuk
            </div>
          </div>

          <div className="flex flex-col gap-1 col-span-2 border-t border-[#ECEAE2] pt-2">
            <span className="text-[12px] text-[#6B6A63]">Waktu Pesan Terakhir Diterima</span>
            <span className="text-[13px] font-medium text-[#1B1B18]">
              {settings.last_webhook_at
                ? new Date(settings.last_webhook_at).toLocaleString('id-ID')
                : 'Belum ada balasan masuk via webhook'}
            </span>
          </div>
        </div>

        {/* Webhook Configuration Guide */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] text-[#6B6A63] font-medium">URL Webhook di Dashboard Fonnte</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value="https://<domain-kamu>/api/fonnte/webhook"
              className="flex-1 h-9 px-3 rounded-[8px] bg-[#F7F6F2] border border-[#DAD7CC] text-[12px] text-[#1B1B18] select-all"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText('https://<domain-kamu>/api/fonnte/webhook');
                showToast('success', 'URL Webhook disalin.');
              }}
            >
              Salin URL
            </Button>
          </div>
          <p className="text-[11px] text-[#6B6A63] leading-relaxed">
            Pasang di dashboard Fonnte $\rightarrow$ Device $\rightarrow$ Edit $\rightarrow$ Webhook URL. Pastikan Auto-Read menyala dan Autoreply dimatikan.
          </p>
        </div>

        {/* Uji Webhook Action */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#F0EEE7]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#1B1B18]">Uji Simulasi Pesan Masuk</span>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isTesting}
              onClick={handleTestWebhook}
            >
              {isTesting ? 'Menguji…' : 'Uji Webhook Sekarang'}
            </Button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-[8px] text-[12px] leading-relaxed ${
                testResult.startsWith('✓')
                  ? 'bg-[#E4F3EC] text-[#0B6B4A] border border-[#CDE9DC]'
                  : 'bg-[#FCE4E1] text-[#B3261E] border border-[#F9D0CA]'
              }`}
            >
              {testResult}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-[#F0EEE7]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </Card>
    </div>
  );
}

