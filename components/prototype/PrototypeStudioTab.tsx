'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PrototypeData } from '@/types/prototype';
import { SheetLeadRecord } from '@/types/outreach';
import {
  createDefaultPrototype,
  generateFollowUpWhatsAppMessage,
  slugify,
  buildAdaptivePrompt,
} from '@/lib/prototype-templates';
import { formatPhoneDisplay } from '@/lib/defensive-client';

interface Props {
  sheetRecords: SheetLeadRecord[];
  initialSelectedLead?: SheetLeadRecord | null;
  showToast: (type: 'success' | 'error' | 'warn', message: string) => void;
}

export default function PrototypeStudioTab({
  sheetRecords,
  initialSelectedLead,
  showToast,
}: Props) {
  const [prototypes, setPrototypes] = useState<PrototypeData[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [deviceView, setDeviceView] = useState<'mobile' | 'desktop'>('mobile');
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [protoSearchQuery, setProtoSearchQuery] = useState('');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [fullscreenDevice, setFullscreenDevice] = useState<'mobile' | 'tablet' | 'desktop' | 'full'>('full');

  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [aiPrompt, setAiPrompt] = useState<string>(
    'Villa privat 3 kamar di lereng Gunung Arjuna, view sunrise, private pool air hangat, paket sewa harian & gathering. Tambah tombol direct WA admin untuk cek ketersediaan.'
  );
  const [currentPrototype, setCurrentPrototype] = useState<PrototypeData>(() =>
    createDefaultPrototype({
      businessName: 'Villa Puncak Arjuna',
      category: 'Villa & Glamping',
      city: 'Batu',
      phone: '081234908812',
      rating: 4.9,
      reviewsCount: 184,
      address: 'Batu, Malang',
    })
  );

  const fetchPrototypes = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch('/api/prototypes');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.prototypes)) {
        setPrototypes(data.prototypes);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchPrototypes();
  }, [fetchPrototypes]);

  // Seed initial prototype so it never 404s
  useEffect(() => {
    fetch('/api/prototypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPrototype),
    }).catch(() => {});
  }, []);

  // When initialSelectedLead is provided, sync prompt and auto-save prototype
  useEffect(() => {
    if (initialSelectedLead) {
      const proto = createDefaultPrototype({
        businessName: initialSelectedLead.businessName,
        category: initialSelectedLead.category,
        city: initialSelectedLead.city || 'Jawa Timur',
        phone: initialSelectedLead.normalizedPhone || initialSelectedLead.phone,
        rating: initialSelectedLead.rating || 4.9,
        reviewsCount: initialSelectedLead.reviewsCount || 40,
        address: initialSelectedLead.mapsUrl || `Kota ${initialSelectedLead.city || 'Malang'}`,
        chatMessage: initialSelectedLead.messageSent,
      });

      setCurrentPrototype(proto);
      setSelectedRecordId(initialSelectedLead.id);

      const adaptivePrompt = buildAdaptivePrompt({
        businessName: initialSelectedLead.businessName,
        category: initialSelectedLead.category,
        city: initialSelectedLead.city,
        chatMessage: initialSelectedLead.messageSent,
      });
      setAiPrompt(adaptivePrompt);
      setPreviewKey(Date.now());

      // Auto-save to guarantee zero 404 in iframe
      fetch('/api/prototypes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proto),
      }).catch(() => {});

      showToast('success', `Data & obrolan chat ${initialSelectedLead.businessName} diselaraskan ke generator.`);
    }
  }, [initialSelectedLead, showToast]);

  const activeRecord = useMemo(() => {
    return sheetRecords.find((r) => r.id === selectedRecordId) || initialSelectedLead;
  }, [sheetRecords, selectedRecordId, initialSelectedLead]);

  const activeChatMessage = activeRecord?.messageSent;

  const handleSelectLead = (recId: string) => {
    setSelectedRecordId(recId);
    if (!recId) return;

    const rec = sheetRecords.find((r) => r.id === recId);
    if (!rec) return;

    const newProto = createDefaultPrototype({
      businessName: rec.businessName,
      category: rec.category,
      city: rec.city || 'Malang',
      phone: rec.normalizedPhone || rec.phone,
      rating: rec.rating || 4.9,
      reviewsCount: rec.reviewsCount || 35,
      address: rec.mapsUrl || `Kota ${rec.city || 'Malang'}`,
      chatMessage: rec.messageSent,
    });

    setCurrentPrototype(newProto);

    const adaptivePrompt = buildAdaptivePrompt({
      businessName: rec.businessName,
      category: rec.category,
      city: rec.city,
      chatMessage: rec.messageSent,
    });
    setAiPrompt(adaptivePrompt);
    setPreviewKey(Date.now());

    // Auto-save to guarantee zero 404
    fetch('/api/prototypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProto),
    }).catch(() => {});

    showToast('success', `Data ${rec.businessName} siap diracik.`);
  };

  const handleAiGenerate = async (customInstruction?: string) => {
    const finalInstruction = customInstruction || aiPrompt;
    setIsAiGenerating(true);

    try {
      const res = await fetch('/api/ai/design-prototype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalInstruction,
          chatMessage: activeChatMessage,
          currentPrototype,
          leadData: {
            businessName: currentPrototype.businessName,
            category: currentPrototype.category,
            city: currentPrototype.city,
            phone: currentPrototype.phone,
            rating: currentPrototype.rating,
            reviewsCount: currentPrototype.reviewsCount,
            address: currentPrototype.address,
            messageSent: activeChatMessage,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.prototype) {
        throw new Error(data.error || 'Gagal meracik desain website.');
      }

      setCurrentPrototype(data.prototype);
      setPreviewKey(Date.now());
      if (typeof window !== 'undefined' && data.tokensUsed) {
        window.dispatchEvent(new CustomEvent('gk-token-deducted', { detail: { tokens: data.tokensUsed } }));
      }
      showToast('success', `Website ${currentPrototype.businessName} selesai diracik tanpa AI-slop!`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Gagal meracik prototype.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!currentPrototype.slug.trim()) {
      showToast('error', 'Slug URL tidak boleh kosong.');
      return;
    }
    setIsDeploying(true);
    try {
      const payload: PrototypeData = {
        ...currentPrototype,
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/prototypes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menerbitkan website.');
      }

      setCurrentPrototype(json.prototype);
      setPreviewKey(Date.now());
      await fetchPrototypes();
      showToast('success', `Website ${currentPrototype.businessName} resmi dipublish!`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Gagal publish website.');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeletePrototype = async (slug: string) => {
    if (!confirm(`Hapus prototype "${slug}"?`)) return;
    try {
      const res = await fetch(`/api/prototypes/${slug}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('success', 'Prototype berhasil dihapus.');
        fetchPrototypes();
      }
    } catch {
      showToast('error', 'Gagal menghapus prototype.');
    }
  };

  const [pitchTone, setPitchTone] = useState<'intro' | 'followup' | 'urgency'>('intro');

  const domain = currentPrototype.customDomain || 'corecraft.my.id';
  const livePreviewUrl = `/p/${currentPrototype.slug}?t=${previewKey}`;

  const followUpMessage = useMemo(() => {
    const link = `https://${domain}/p/${currentPrototype.slug}`;
    const name = currentPrototype.businessName;
    const city = currentPrototype.city || 'Jatim';

    if (pitchTone === 'followup') {
      return `Selamat siang Pak/Bu pengelola ${name}. Izin follow-up santun terkait konsep website resmi yang kami buatkan kemarin: ${link}. Sudah sempat dibuka di HP nggih Pak/Bu? Jika ada bagian foto katalog, tarif harga, atau tombol WA yang ingin disesuaikan, kulo bantu ubah langsung sekarang gratis.`;
    }

    if (pitchTone === 'urgency') {
      return `Halo Pak/Bu pengelola ${name}. Sekadar info, minggu ini kami menyediakan promo gratis setup Google Maps & domain resmi 1 tahun untuk 2 bisnis di ${city}. Konsep website bapak sudah kami siapkan di ${link}. Apakah berkenan kami kunci kuota pengerjaan 3 hari selesai untuk ${name}?`;
    }

    return generateFollowUpWhatsAppMessage(currentPrototype);
  }, [currentPrototype, domain, pitchTone]);

  const waSendUrl = useMemo(() => {
    const cleanPhone = (currentPrototype.phone || '').replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(followUpMessage)}`;
  }, [currentPrototype.phone, followUpMessage]);

  const copyPitchToClipboard = () => {
    navigator.clipboard.writeText(followUpMessage);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
    showToast('success', 'Pesan WhatsApp berhasil disalin.');
  };

  const nicheChips = useMemo(() => {
    switch (currentPrototype.niche) {
      case 'florist':
        return [
          { label: '🌸 Buket Wisuda & Mawar', prompt: `Fokus pada buket mawar segar Korean wrapping, bunga wisuda H-1 express, dan promo kartu ucapan cetak gratis.` },
          { label: 'Same-Day Delivery Express', prompt: `Highlight jaminan kirim cepat 2-3 jam area kota dan bukti foto sebelum dikirim.` },
          { label: 'Bunga Papan Ucapan', prompt: `Tampilkan paket bunga papan selamat & duka cita dengan bunga keliling segar dan proses pembuatan kilat.` },
          { label: 'Gratis Kartu Ucapan', prompt: `Tambahkan promo gratis custom kartu ucapan cetak personal untuk setiap pembelian buket.` },
          { label: 'Nuansa Ruby & Emerald', prompt: `Gunakan nuansa warna ruby rose mewah, foto rangkaian mawar premium, dan copy elegan.` },
        ];
      case 'villa':
        return [
          { label: 'Nuansa Luxury Resort', prompt: `Gunakan nuansa luxury premium, warna hangat estetik, dan tambahkan paket eksklusif untuk ${currentPrototype.businessName}.` },
          { label: '🛡️ Bebas Komisi OTA', prompt: `Tambahkan perbandingan direct booking vs komisi OTA 15% serta jaminan keamanan booking langsung via WhatsApp.` },
          { label: 'Promo Booking Langsung', prompt: `Tambahkan promo khusus booking langsung diskon 20% minggu ini dan tombol direct WA ke admin.` },
          { label: '+ Paket Gathering & BBQ', prompt: `Tambahkan paket Family Gathering & Corporate Event dengan rincian fasilitas lengkap dan set alat BBQ.` },
        ];
      case 'klinik':
        return [
          { label: 'Daftar WA Tanpa Antre', prompt: `Fokus pada kemudahan appointment online via WhatsApp tanpa perlu antre berjam-jam di ruang tunggu.` },
          { label: 'Jadwal Dokter Spesialis', prompt: `Tampilkan jadwal praktek dokter yang jelas dan kebersihan ruang tindakan berstandar medis.` },
          { label: 'Perawatan Gigi & Estetika', prompt: `Highlight layanan scaling gigi, penambalan rapi, dan perawatan kecantikan dengan tarif transparan.` },
          { label: 'Ulasan Pasien Puas', prompt: `Tonjolkan reputasi bintang 5 di Google Maps dari pasien keluarga lokal.` },
        ];
      case 'resto':
        return [
          { label: 'Menu Signature & Kopi', prompt: `Tonjolkan hidangan signature terlaris dan minuman kopi estetik yang digemari pelanggan.` },
          { label: 'Reservasi Meja WA', prompt: `Tambahkan tombol reservasi meja instan untuk arisan, ulang tahun, dan kumpul keluarga.` },
          { label: 'Promo Santap Hemat', prompt: `Tambahkan paket makan bareng diskon 15% untuk makan di tempat maupun pesanan katering.` },
        ];
      case 'kontraktor':
        return [
          { label: 'Portofolio Bangun Rumah', prompt: `Tampilkan hasil bangun dan renovasi rumah modern minimalis bergaransi.` },
          { label: 'RAB Transparan & SPK', prompt: `Tekankan rincian anggaran biaya jujur tanpa biaya siluman dan perjanjian kerja resmi.` },
          { label: 'Survey Lokasi Gratis', prompt: `Tambahkan penawaran survey lokasi gratis dan konsultasi desain arsitektur langsung via WA.` },
        ];
      case 'bengkel':
        return [
          { label: 'Servis Berkala & Tune-Up', prompt: `Tampilkan paket tune-up mesin, servis berkala, dan ganti oli dengan mekanik bersertifikat.` },
          { label: 'Transparansi Biaya Part', prompt: `Tekankan kejujuran diagnosa tanpa tembak harga suku cadang.` },
          { label: 'Booking Antrean WA', prompt: `Tambahkan tombol booking jam servis agar pelanggan tidak perlu menunggu antre.` },
        ];
      default:
        return [
          { label: 'Racik dari nol', prompt: `Bangun website profesional dari awal untuk ${currentPrototype.businessName} dengan copywriting persuasif dan elegan.` },
          { label: 'Nuansa premium', prompt: `Gunakan nuansa luxury premium, warna hangat estetik, dan katalog layanan unggulan untuk ${currentPrototype.businessName}.` },
          { label: 'Pemesanan Kilat WA', prompt: `Tambahkan penawaran promo khusus pemesanan via WhatsApp hari ini.` },
        ];
    }
  }, [currentPrototype.niche, currentPrototype.businessName]);

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 text-emerald-700">
              <span className="material-symbols-outlined text-[16px]">terminal</span>
            </span>
            <h1 className="text-[16px] font-semibold text-slate-900">Prototype Studio</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-600">
              Engine v2.5 · Anti-AI-Slop
            </span>
          </div>
          <p className="text-[12px] text-slate-500 mt-1">
            Bangun rancangan visual interaktif dalam hitungan detik yang selaras dengan obrolan chat klien.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
            Sandbox Siap Pakai
          </div>
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="h-8 px-3 rounded-md bg-white border border-[#E5E7EB] text-slate-700 text-[12px] font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Riwayat ({prototypes.length})</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Generator Form */}
        <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 flex flex-col">
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900">Generator Prototype Cepat</h2>
              <span className="text-[11px] font-semibold text-[#059669] bg-emerald-50 px-2 py-0.5 rounded">
                30s BUILD
              </span>
            </div>
            <p className="text-[12px] text-slate-500 mt-1">
              Bangun mockup landing page fungsional 1 halaman dalam 30 detik untuk dikirim via WA.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col">
              <label
                className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 mb-1.5"
                htmlFor="lead-selector"
              >
                Pilih Prospek Aktif
              </label>
              <div className="relative w-full">
                <select
                  id="lead-selector"
                  value={selectedRecordId}
                  onChange={(e) => handleSelectLead(e.target.value)}
                  className="w-full h-9 pl-3 pr-9 appearance-none rounded-[6px] bg-slate-50 border border-slate-200 text-slate-900 text-[13px] focus:bg-white focus:border-slate-400 transition-all cursor-pointer outline-none"
                >
                  <option value="">
                    {currentPrototype.businessName} · {currentPrototype.city} ({currentPrototype.niche.toUpperCase()})
                  </option>
                  {sheetRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.businessName} · {r.category} ({r.city || 'Jatim'})
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[18px] text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Context Chat Indicator */}
            {activeChatMessage && (
              <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-[6px] p-2.5 flex items-start justify-between gap-2 text-[11px] text-indigo-950">
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-indigo-600 shrink-0 mt-0.5">chat</span>
                  <div className="truncate">
                    <span className="font-semibold block text-indigo-900">Konteks Chat Outreach Klien:</span>
                    <span className="italic text-indigo-700 text-[10.5px] line-clamp-2">
                      &ldquo;{activeChatMessage}&rdquo;
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const adaptive = buildAdaptivePrompt({
                      businessName: currentPrototype.businessName,
                      category: currentPrototype.category,
                      city: currentPrototype.city,
                      chatMessage: activeChatMessage,
                    });
                    setAiPrompt(adaptive);
                    showToast('success', 'Prompt diselaraskan kembali dengan konteks chat klien.');
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-white border border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-100 shrink-0 transition cursor-pointer"
                >
                  Selaraskan
                </button>
              </div>
            )}

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500"
                  htmlFor="brief-input"
                >
                  Catatan &amp; Arahan Brief Desain
                </label>
                <span className="font-mono text-[11px] text-slate-400">
                  {aiPrompt.length} karakter
                </span>
              </div>
              <textarea
                id="brief-input"
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-900 text-[12px] focus:bg-white focus:border-slate-400 transition-all outline-none resize-none leading-relaxed"
              />

              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-[6px] p-2.5 flex items-center gap-2 text-[11px] text-emerald-900 my-2">
                <span className="material-symbols-outlined text-[16px] text-[#059669]">trending_up</span>
                <span>
                  <strong>Rumus Konversi Klien:</strong> Desain langsung menampilkan katalog foto riil &amp; tombol pemesanan WA kilat, sehingga klien merasa website sudah siap pakai dan bernilai jutaan rupiah.
                </span>
              </div>

              {/* Dynamic Niche Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {nicheChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAiGenerate(chip.prompt)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                id="btn-generate"
                type="button"
                disabled={isAiGenerating}
                onClick={() => handleAiGenerate()}
                className="flex-1 h-9 rounded-[6px] bg-[#0F172A] hover:bg-slate-800 text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <span
                  className={`material-symbols-outlined text-[17px] text-emerald-400 ${
                    isAiGenerating ? 'animate-spin' : ''
                  }`}
                >
                  {isAiGenerating ? 'refresh' : 'auto_awesome'}
                </span>
                <span>{isAiGenerating ? 'Meracik Prototype...' : 'Generate website'}</span>
              </button>

              <button
                type="button"
                disabled={isDeploying}
                onClick={handleDeploy}
                className="h-9 px-3 rounded-[6px] border border-slate-300 hover:bg-slate-50 text-slate-700 text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Simpan & Terbitkan Prototype ke URL Publik"
              >
                <span className="material-symbols-outlined text-[15px] text-[#059669]">publish</span>
                <span>{isDeploying ? 'Deploying…' : 'Publish'}</span>
              </button>
            </div>

            <div className="w-full h-px bg-slate-100 my-1" />

            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 mb-1.5">
                Subdomain Preview
              </label>
              <div className="flex items-center rounded-[6px] overflow-hidden bg-slate-50 border border-slate-200 focus-within:border-slate-400 focus-within:bg-white">
                <span className="material-symbols-outlined text-[16px] text-slate-400 pl-3">link</span>
                <input
                  type="text"
                  value={currentPrototype.slug}
                  onChange={(e) =>
                    setCurrentPrototype((prev) => ({ ...prev, slug: slugify(e.target.value) }))
                  }
                  className="font-mono text-[13px] px-2 py-2 text-slate-900 bg-transparent flex-1 outline-none font-medium"
                />
                <span className="font-mono text-[12px] px-3 py-2 bg-slate-100 text-slate-500 select-none border-l border-slate-200">
                  .{domain}
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                  Pratinjau Pesan WhatsApp
                </label>
                <button
                  type="button"
                  onClick={copyPitchToClipboard}
                  className="text-[#059669] hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">
                    {copiedPitch ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedPitch ? 'Tersalin' : 'Salin Teks'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-[4px] text-[10px] font-medium mb-1.5 self-start">
                <button
                  type="button"
                  onClick={() => setPitchTone('intro')}
                  className={`px-2 py-0.5 rounded-[3px] transition cursor-pointer ${
                    pitchTone === 'intro' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  1. Soft Intro
                </button>
                <button
                  type="button"
                  onClick={() => setPitchTone('followup')}
                  className={`px-2 py-0.5 rounded-[3px] transition cursor-pointer ${
                    pitchTone === 'followup' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  2. Follow-Up H+2
                </button>
                <button
                  type="button"
                  onClick={() => setPitchTone('urgency')}
                  className={`px-2 py-0.5 rounded-[3px] transition cursor-pointer ${
                    pitchTone === 'urgency' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  3. Urgensi Slot
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-[6px] p-3 text-[12px] text-slate-600 leading-relaxed select-text">
                {followUpMessage}
              </div>
            </div>

            <a
              href={waSendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-[6px] bg-white border border-[#059669] text-[#059669] font-medium text-[13px] hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>Kirim link ke WhatsApp klien</span>
            </a>
          </form>
        </div>

        {/* Right Column: Live Prototype Frame & Fullscreen Launcher */}
        <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#059669] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#059669]" />
              </div>
              <span className="text-[13px] font-semibold text-slate-900">Live Prototype Frame</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-medium">
                200 OK
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-0.5 rounded-[6px] inline-flex items-center text-[12px]">
                <button
                  type="button"
                  onClick={() => setDeviceView('mobile')}
                  className={`px-2.5 py-1 rounded-[4px] flex items-center gap-1 transition-all cursor-pointer ${
                    deviceView === 'mobile'
                      ? 'bg-white text-slate-900 font-medium shadow-none'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">smartphone</span>
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceView('desktop')}
                  className={`px-2.5 py-1 rounded-[4px] flex items-center gap-1 transition-all cursor-pointer ${
                    deviceView === 'desktop'
                      ? 'bg-white text-slate-900 font-medium shadow-none'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">laptop</span>
                  <span>Desktop</span>
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreenPreview(true)}
                className="px-2.5 py-1 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium flex items-center gap-1 transition cursor-pointer"
                title="Buka Pratayang Layar Penuh"
              >
                <span className="material-symbols-outlined text-[15px]">fullscreen</span>
                <span>Layar Penuh</span>
              </button>

              <a
                href={livePreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-700 p-1"
                title="Buka Halaman Penuh di Tab Baru"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            </div>
          </div>

          {/* Quick link bar */}
          <div className="mb-3 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono truncate">
              https://{currentPrototype.slug}.{domain}
            </span>
            <a
              href={livePreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 hover:underline font-semibold flex items-center gap-1 shrink-0 ml-2"
            >
              <span>Buka Full Page</span>
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
          </div>

          <div className="w-full flex items-center justify-center py-2 bg-slate-50/75 border border-slate-100 rounded-[8px] overflow-hidden min-h-[580px]">
            {deviceView === 'mobile' ? (
              <div
                className="w-full max-w-[340px] bg-white rounded-[24px] shadow-xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 relative"
                style={{ height: '560px' }}
              >
                <div className="bg-[#0F172A] px-4 py-1.5 flex items-center justify-between text-white text-[10px] font-mono select-none">
                  <span>09:41</span>
                  <div className="w-12 h-2.5 bg-black rounded-full" />
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px]">signal_cellular_4_bar</span>
                    <span className="material-symbols-outlined text-[11px]">wifi</span>
                    <span className="material-symbols-outlined text-[11px]">battery_full</span>
                  </div>
                </div>

                <div className="flex-1 w-full overflow-hidden bg-white">
                  <iframe
                    key={previewKey}
                    src={livePreviewUrl}
                    title="Mobile Live Preview"
                    className="w-full h-full border-0 select-none"
                  />
                </div>
              </div>
            ) : (
              <div
                className="w-full bg-white rounded-[8px] shadow-sm border border-slate-200 overflow-hidden flex flex-col"
                style={{ height: '560px' }}
              >
                <div className="h-8 bg-slate-100 border-b border-slate-200 px-3 flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                  </div>
                  <div className="flex-1 max-w-sm mx-auto bg-white rounded px-2 py-0.5 text-[11px] text-slate-500 font-mono text-center border border-slate-200 truncate">
                    https://{currentPrototype.slug}.{domain}
                  </div>
                </div>

                <div className="flex-1 w-full overflow-hidden bg-white">
                  <iframe
                    key={previewKey}
                    src={livePreviewUrl}
                    title="Desktop Live Preview"
                    className="w-full h-full border-0 select-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[12px] text-slate-500 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              <span>Pratayang instan tersinkron dengan engine Claude 3.7 &amp; Storage</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>Katalog Foto Produk Aktif</span>
              <span>·</span>
              <span className="text-[#059669] font-medium">Lighthouse: 100/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          FULLSCREEN MODAL PREVIEW (GAK FULL PAGE FIX)
      ═════════════════════════════════════════════════════════════ */}
      {isFullscreenPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-fade-in">
          {/* Header Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-white shadow-xl mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="font-bold text-sm block leading-tight">{currentPrototype.businessName}</span>
                <span className="text-[11px] text-slate-400 font-mono">https://{currentPrototype.slug}.{domain}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Device Selector */}
              <div className="bg-slate-800 p-1 rounded-lg hidden sm:flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFullscreenDevice('mobile')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    fullscreenDevice === 'mobile' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  HP (375px)
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenDevice('tablet')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    fullscreenDevice === 'tablet' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Tablet (768px)
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenDevice('desktop')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    fullscreenDevice === 'desktop' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Desktop (1180px)
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenDevice('full')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${
                    fullscreenDevice === 'full' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  100% Layar Penuh
                </button>
              </div>

              <a
                href={livePreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Buka Tab Baru</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </a>

              <button
                type="button"
                onClick={() => setIsFullscreenPreview(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Tutup (ESC)"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Frame Container */}
          <div className="flex-1 w-full bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
            <div
              className="h-full bg-white transition-all duration-300 overflow-hidden rounded-lg shadow-2xl"
              style={{
                width:
                  fullscreenDevice === 'mobile'
                    ? '385px'
                    : fullscreenDevice === 'tablet'
                    ? '768px'
                    : fullscreenDevice === 'desktop'
                    ? '1180px'
                    : '100%',
              }}
            >
              <iframe
                key={`fullscreen-${previewKey}`}
                src={livePreviewUrl}
                title="Full Page Live Preview"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] max-w-3xl w-full p-6 shadow-xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Riwayat Website Prototype ({prototypes.length})
                </h3>
                <p className="text-[12px] text-slate-500">
                  Daftar seluruh website yang telah diracik dan aktif di {domain}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                value={protoSearchQuery}
                onChange={(e) => setProtoSearchQuery(e.target.value)}
                placeholder="Cari nama bisnis, kota, atau slug..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] outline-none focus:bg-white focus:border-slate-400"
              />
            </div>

            <div className="overflow-y-auto flex-1 max-h-[50vh]">
              {isLoadingList ? (
                <div className="text-center py-8 text-xs text-slate-400">Memuat riwayat...</div>
              ) : prototypes.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Belum ada prototype yang disimpan.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-mono text-[11px]">
                      <th className="py-2 px-3">Bisnis</th>
                      <th className="py-2 px-3">Kota</th>
                      <th className="py-2 px-3">Subdomain</th>
                      <th className="py-2 px-3">Views</th>
                      <th className="py-2 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prototypes.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.businessName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.city}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-700">
                          /p/{item.slug}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {item.viewCount || 1}x
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`https://${domain}/p/${item.slug}`);
                                showToast('success', `Link ${item.businessName} disalin!`);
                              }}
                              className="border border-[#E5E7EB] hover:bg-slate-100 text-slate-600 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer"
                              title="Salin Link Publik"
                            >
                              Salin
                            </button>
                            <a
                              href={`/p/${item.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border border-[#E5E7EB] hover:bg-slate-100 text-slate-700 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer"
                            >
                              Lihat
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentPrototype(item);
                                setPreviewKey(Date.now());
                                setShowHistoryModal(false);
                                showToast('success', `Prototype ${item.businessName} dibuka.`);
                              }}
                              className="border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePrototype(item.slug)}
                              className="border border-red-200 hover:bg-red-50 text-red-600 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer"
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

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="h-8 px-4 rounded-[6px] bg-[#0F172A] hover:bg-slate-800 text-white text-[12px] font-medium transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
