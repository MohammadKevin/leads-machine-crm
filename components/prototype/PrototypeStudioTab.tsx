'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PrototypeData } from '@/types/prototype';
import { SheetLeadRecord } from '@/types/outreach';
import {
  createDefaultPrototype,
  slugify,
  buildAdaptivePrompt,
} from '@/lib/prototype-templates';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PrototypeWireframeSkeleton } from '@/components/ui/Skeleton';

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
  const [isDeploying, setIsDeploying] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [deviceView, setDeviceView] = useState<'mobile' | 'desktop'>('mobile');
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [pitchTone, setPitchTone] = useState<'intro' | 'followup' | 'urgency'>('intro');

  const [aiPrompt, setAiPrompt] = useState<string>(
    'Villa privat 3 kamar di lereng Gunung Arjuna, private pool air hangat, paket harian & gathering. Tombol WA admin.'
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

  const domain = currentPrototype.customDomain || 'corecraft.my.id';
  const livePreviewUrl = `/p/${currentPrototype.slug}?t=${previewKey}`;

  const fetchPrototypes = useCallback(async () => {
    try {
      const res = await fetch('/api/prototypes');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.prototypes)) {
        setPrototypes(data.prototypes);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchPrototypes();
  }, [fetchPrototypes]);

  // Seed default prototype
  useEffect(() => {
    fetch('/api/prototypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPrototype),
    }).catch(() => {});
  }, []);

  // When initialSelectedLead is provided, populate fields
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

      fetch('/api/prototypes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proto),
      }).catch(() => {});

      showToast('success', `Data ${initialSelectedLead.businessName} siap diracik.`);
    }
  }, [initialSelectedLead, showToast]);

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

    fetch('/api/prototypes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProto),
    }).catch(() => {});

    showToast('success', `Data ${rec.businessName} siap diracik.`);
  };

  const handleAiGenerate = async () => {
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/design-prototype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          currentPrototype,
          leadData: {
            businessName: currentPrototype.businessName,
            category: currentPrototype.category,
            city: currentPrototype.city,
            phone: currentPrototype.phone,
            rating: currentPrototype.rating,
            reviewsCount: currentPrototype.reviewsCount,
            address: currentPrototype.address,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.prototype) {
        throw new Error(data.error || 'Gagal meracik desain website.');
      }

      setCurrentPrototype(data.prototype);
      setPreviewKey(Date.now());
      showToast('success', `Website ${currentPrototype.businessName} selesai diracik!`);
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

  // WhatsApp Messages
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});

  const defaultMessages = useMemo(() => {
    const name = currentPrototype.businessName;
    const city = currentPrototype.city || 'Jawa Timur';

    return {
      intro: `Halo selamat siang Kak, saya Kevin. Sudah saya buatkan pratinjau konsep website untuk ${name}: [link]. Silakan dilihat dulu ya Kak.`,
      followup: `Selamat siang Pak/Bu pengelola ${name}. Izin follow-up santun terkait konsep website resmi yang kemarin saya buatkan: [link]. Sudah sempat dibuka di HP nggih Pak/Bu? Jika ada bagian foto atau tarif yang ingin disesuaikan, kulo bantu ubah langsung sekarang gratis.`,
      urgency: `Halo Pak/Bu pengelola ${name}. Sekadar info, minggu ini kami menyediakan promo gratis setup Google Maps & domain resmi 1 tahun untuk bisnis di ${city}. Konsep website bapak sudah kami siapkan di [link]. Apakah berkenan kami kunci slot kuotanya untuk ${name}?`,
    };
  }, [currentPrototype.businessName, currentPrototype.city]);

  const activeMessageText = customMessages[pitchTone] !== undefined ? customMessages[pitchTone] : defaultMessages[pitchTone];

  const handleMessageTextChange = (val: string) => {
    setCustomMessages((prev) => ({ ...prev, [pitchTone]: val }));
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(activeMessageText);
    showToast('success', 'Pesan WhatsApp berhasil disalin.');
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = (currentPrototype.phone || '').replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(activeMessageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* Left Column: Form & Messages */}
        <div className="flex flex-col gap-4">
          {/* Prospek selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] text-[#6B6A63] font-medium" htmlFor="prospek-select">
              Prospek
            </label>
            <div className="relative">
              <select
                id="prospek-select"
                value={selectedRecordId}
                onChange={(e) => handleSelectLead(e.target.value)}
                className="w-full h-10 px-3 pr-9 rounded-[8px] bg-white border border-[#DAD7CC] text-[#1B1B18] text-[14px] focus:outline-2 focus:outline-[#0B7A55] appearance-none cursor-pointer"
              >
                <option value="">
                  {currentPrototype.businessName} · {currentPrototype.city}
                </option>
                {sheetRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.businessName} · {r.city || r.category}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[18px] text-[#6B6A63] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Brief desain */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] text-[#6B6A63] font-medium" htmlFor="brief-textarea">
              Brief desain
            </label>
            <textarea
              id="brief-textarea"
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full p-3 rounded-[8px] bg-white border border-[#DAD7CC] text-[#1B1B18] text-[13px] leading-relaxed focus:outline-2 focus:outline-[#0B7A55] resize-none"
            />
          </div>

          {/* Action buttons: Generate & Publish */}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              disabled={isAiGenerating}
              onClick={handleAiGenerate}
            >
              {isAiGenerating ? 'Meracik website…' : 'Generate website'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isDeploying}
              onClick={handleDeploy}
            >
              {isDeploying ? 'Publishing…' : 'Publish'}
            </Button>
          </div>

          {/* Subdomain text */}
          <div className="text-[12px] text-[#6B6A63] -mt-1 select-all truncate">
            {currentPrototype.slug}.{domain}
          </div>

          {/* WhatsApp Message Card */}
          <Card className="p-4 flex flex-col gap-3 mt-1">
            {/* Tone chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Chip
                active={pitchTone === 'intro'}
                onClick={() => setPitchTone('intro')}
              >
                Soft intro
              </Chip>
              <Chip
                active={pitchTone === 'followup'}
                onClick={() => setPitchTone('followup')}
              >
                Follow-up H+2
              </Chip>
              <Chip
                active={pitchTone === 'urgency'}
                onClick={() => setPitchTone('urgency')}
              >
                Urgensi
              </Chip>
            </div>

            {/* Editable textarea */}
            <textarea
              rows={5}
              value={activeMessageText}
              onChange={(e) => handleMessageTextChange(e.target.value)}
              className="w-full p-2.5 rounded-[8px] bg-white border border-[#DAD7CC] text-[#1B1B18] text-[13px] leading-relaxed focus:outline-2 focus:outline-[#0B7A55] resize-none"
            />

            {/* Message Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleCopyMessage}
                className="flex-1"
              >
                Salin teks
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSendWhatsApp}
                className="flex-1"
              >
                Kirim ke WhatsApp
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Large Preview Card */}
        <Card className="p-4 sm:p-5 flex flex-col min-h-[640px]">
          {/* Preview topbar */}
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-[#F0EEE7]">
            <div className="flex items-center gap-1.5">
              <Chip
                active={deviceView === 'mobile'}
                onClick={() => setDeviceView('mobile')}
              >
                Mobile
              </Chip>
              <Chip
                active={deviceView === 'desktop'}
                onClick={() => setDeviceView('desktop')}
              >
                Desktop
              </Chip>
            </div>

            <a
              href={livePreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-[#6B6A63] hover:text-[#1B1B18] transition"
            >
              Buka tab baru
            </a>
          </div>

          {/* Canvas viewport */}
          <div className="flex-1 w-full rounded-[10px] bg-[#EDECE6] p-4 sm:p-6 flex items-center justify-center overflow-hidden">
            {isAiGenerating ? (
              <PrototypeWireframeSkeleton device={deviceView} />
            ) : deviceView === 'mobile' ? (
              <div
                className="w-full max-w-[320px] bg-white rounded-[24px] shadow-lg border border-[#DAD7CC] overflow-hidden flex flex-col transition-all duration-200"
                style={{ height: '580px' }}
              >
                <div className="h-6 bg-[#1B1B18] px-4 flex items-center justify-between text-white text-[10px] select-none">
                  <span>09:41</span>
                  <div className="w-12 h-2.5 bg-black rounded-full" />
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px]">wifi</span>
                    <span className="material-symbols-outlined text-[10px]">battery_full</span>
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
                className="w-full max-w-[680px] bg-white rounded-[10px] shadow-lg border border-[#DAD7CC] overflow-hidden flex flex-col transition-all duration-200"
                style={{ height: '580px' }}
              >
                <div className="h-8 bg-[#F7F6F2] border-b border-[#DAD7CC] px-3 flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DAD7CC]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DAD7CC]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DAD7CC]" />
                  </div>
                  <div className="flex-1 max-w-xs mx-auto bg-white rounded-[6px] px-2 py-0.5 text-[11px] text-[#6B6A63] text-center border border-[#DAD7CC] truncate">
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
        </Card>
      </div>
    </div>
  );
}
