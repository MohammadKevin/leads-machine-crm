import React from 'react';
import Link from 'next/link';
import { PrototypeData } from '@/types/prototype';
import {
  Star,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Shield,
  ArrowRight,
  HelpCircle,
  ShoppingBag,
  Award,
  Zap,
} from 'lucide-react';

import { getPrototypeBySlug, savePrototype } from '@/lib/prototype-storage';
import { createDefaultPrototype, unslugify } from '@/lib/prototype-templates';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const proto = (await getPrototypeBySlug(slug)) || createDefaultPrototype({ businessName: unslugify(slug) });
  return {
    title: `${proto.businessName} - Website Resmi & Layanan di ${proto.city}`,
    description: proto.subheadline || `Website profil resmi untuk ${proto.businessName} di ${proto.city}.`,
  };
}

export default async function PrototypePublicPage({ params }: Props) {
  const { slug } = await params;
  let data = await getPrototypeBySlug(slug);

  // Fallback: If not yet saved in database, generate default on the fly so it NEVER 404s!
  if (!data) {
    const fallbackName = unslugify(slug);
    data = createDefaultPrototype({
      businessName: fallbackName,
      category: fallbackName.toLowerCase().includes('florist') || fallbackName.toLowerCase().includes('bunga') ? 'Florist & Dekorasi' : 'Layanan Profesional',
    });
    data.slug = slug;
    // Cache in background
    savePrototype(data).catch(() => {});
  }

  const cleanPhone = data.phone.replace(/\D/g, '');
  const clientWaText = encodeURIComponent(
    `Halo ${data.businessName}, saya melihat website resmi Anda dan tertarik ingin tanya mengenai layanan/pemesanan.`
  );
  const clientWaLink = `https://wa.me/${cleanPhone}?text=${clientWaText}`;

  // WhatsApp link to Kevin (for closing the deal when client views this page!)
  const kevinWaText = encodeURIComponent(
    `Halo Mas Kevin, saya dari ${data.businessName}. Saya sudah melihat pratinjau website di corecraft.my.id/p/${data.slug} dan tertarik ingin pakai desain ini. Boleh diskusi proses selanjutnya?`
  );
  const kevinWaLink = `https://wa.me/6285156475734?text=${kevinWaText}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-500 selection:text-white flex flex-col pb-20 sm:pb-0">
      {/* ═════════════════════════════════════════════════════════════
          TOP CLIENT PREVIEW BANNER (Sticky on top for Kevin's pitch)
      ═════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md text-white border-b border-slate-800 shadow-md px-3.5 py-2 text-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <span className="text-slate-300 text-[11px] sm:text-xs truncate">
              Pratinjau Konsep: <strong className="text-white font-bold">{data.businessName}</strong>
            </span>
            <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
              CoreCraft Studio
            </span>
          </div>

          <a
            href={kevinWaLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] sm:text-xs shrink-0 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pakai Desain Ini via WA</span>
          </a>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          PROMO BANNER
      ═════════════════════════════════════════════════════════════ */}
      {data.promoBanner && (
        <div
          className="text-white text-center py-2.5 px-4 text-xs font-semibold tracking-wide shadow-xs"
          style={{ backgroundColor: data.primaryColor }}
        >
          {data.promoBanner}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          HEADER NAV
      ═════════════════════════════════════════════════════════════ */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-9 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
              style={{ backgroundColor: data.primaryColor }}
            >
              {data.businessName.charAt(0)}
            </div>
            <div className="truncate">
              <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg block leading-tight truncate">
                {data.businessName}
              </span>
              <span className="text-[11px] text-slate-500 font-medium block truncate">{data.category}</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#katalog" className="hover:text-slate-900 transition">
              Katalog
            </a>
            <a href="#keunggulan" className="hover:text-slate-900 transition">
              Keunggulan
            </a>
            <a href="#cara-pesan" className="hover:text-slate-900 transition">
              Cara Pesan
            </a>
            <a href="#galeri" className="hover:text-slate-900 transition">
              Galeri
            </a>
            <a href="#ulasan" className="hover:text-slate-900 transition">
              Ulasan Maps
            </a>
            <a href="#faq" className="hover:text-slate-900 transition">
              FAQ
            </a>
            <a href="#lokasi" className="hover:text-slate-900 transition">
              Lokasi
            </a>
          </nav>

          <a
            href={clientWaLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-sm transition hover:opacity-90 shrink-0"
            style={{ backgroundColor: data.primaryColor }}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Chat WhatsApp</span>
            <span className="sm:hidden">WA</span>
          </a>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════
          HERO SECTION
      ═════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200 pt-10 pb-14 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Headlines & CTA */}
            <div className="lg:col-span-7 flex flex-col gap-5 text-left">
              
              {/* Badge Google Maps Rating */}
              <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1 text-amber-500 font-extrabold">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{data.rating.toFixed(1)}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 font-medium">
                  {data.reviewsCount}+ Ulasan Terverifikasi Google Maps
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-[1.18]">
                {data.headline}
              </h1>

              <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-xl">
                {data.subheadline}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <a
                  href={clientWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 rounded-xl text-white font-bold text-sm flex items-center gap-2.5 shadow-md hover:shadow-lg transition cursor-pointer"
                  style={{ backgroundColor: data.primaryColor }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Pesan Sekarang via WA</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="#katalog"
                  className="px-5 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm flex items-center gap-2 transition shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4 text-slate-500" />
                  <span>Lihat Katalog Produk</span>
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Respon Kilat &amp; Ramah</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Jaminan Kualitas 100%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{data.city}</span>
                </div>
              </div>

            </div>

            {/* Right Column: Hero Visual Frame */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] bg-slate-100 group">
                <img
                  src={data.heroImage}
                  alt={data.businessName}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                
                {/* Floating Card Overlay */}
                <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-slate-200 shadow-lg flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Lokasi Terverifikasi
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate block">
                      {data.address}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          STATS STRIP
      ═════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="pt-2 md:pt-0">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">4.9 / 5.0</span>
              <span className="text-xs text-slate-500 font-medium">Rating Google Maps</span>
            </div>
            <div className="pt-2 md:pt-0">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">1.500+</span>
              <span className="text-xs text-slate-500 font-medium">Pesanan Sukses &amp; Puas</span>
            </div>
            <div className="pt-2 md:pt-0">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">100%</span>
              <span className="text-xs text-slate-500 font-medium">Jaminan Segar &amp; Rapi</span>
            </div>
            <div className="pt-2 md:pt-0">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 block">&lt; 15 Mnt</span>
              <span className="text-xs text-slate-500 font-medium">Respon Cepat WhatsApp</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          CATALOG & SERVICES (RICH WITH PHOTOS & DIRECT WA ORDER)
      ═════════════════════════════════════════════════════════════ */}
      <section id="katalog" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <span
                className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full text-white inline-block mb-2"
                style={{ backgroundColor: data.primaryColor }}
              >
                Katalog Produk &amp; Layanan
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                Pilihan Terbaik &amp; Paling Favorit
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Pesan langsung via WhatsApp dengan harga jujur tanpa biaya tersembunyi.
              </p>
            </div>

            <a
              href={clientWaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
              style={{ color: data.primaryColor }}
            >
              <span>Konsultasi Request Khusus via WA</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.services.map((service, idx) => {
              const itemWaText = encodeURIComponent(
                `Halo ${data.businessName}, saya ingin pesan/tanya info untuk paket: *${service.title}* (${service.price || 'Harga info'}). Apakah ready?`
              );
              const itemWaLink = `https://wa.me/${cleanPhone}?text=${itemWaText}`;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group"
                >
                  {/* Service Photo */}
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
                    <img
                      src={
                        service.image ||
                        data.heroImage ||
                        'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=600&q=80'
                      }
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {service.badge && (
                      <span
                        className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md"
                        style={{ backgroundColor: data.primaryColor }}
                      >
                        {service.badge}
                      </span>
                    )}
                  </div>

                  {/* Service Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-1.5 line-clamp-1">
                        {service.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                        {service.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Harga</span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {service.price || 'Hubungi Kami'}
                        </span>
                      </div>

                      <a
                        href={itemWaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 transition hover:opacity-90 shadow-xs cursor-pointer shrink-0"
                        style={{ backgroundColor: data.primaryColor }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Pesan</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          KENAPA MEMILIH KAMI (4 VALUE PILLARS)
      ═════════════════════════════════════════════════════════════ */}
      <section id="keunggulan" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold tracking-wider uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              Kenapa Memilih Kami
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-3">
              Dedikasi Pelayanan Terbaik untuk Anda
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col gap-3 hover:bg-slate-100/60 transition"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: data.primaryColor }}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">{feature}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Kami mengutamakan kualitas, ketepatan waktu, dan kepuasan Anda dalam setiap proses pemesanan.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          3-STEP ORDER WORKFLOW
      ═════════════════════════════════════════════════════════════ */}
      <section id="cara-pesan" className="py-14 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Proses Pemesanan Praktis
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">
              3 Langkah Mudah Pesan via WhatsApp
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center">
                1
              </span>
              <h3 className="font-bold text-base text-white">Pilih Model &amp; Chat Kami</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tentukan paket yang diinginkan dari katalog, lalu klik tombol WhatsApp untuk konsultasi ketersediaan dan request warna/desain.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center">
                2
              </span>
              <h3 className="font-bold text-base text-white">Konfirmasi Foto &amp; Ucapan</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tim kami merangkai dan mengirimkan foto/video pratinjau sebelum dikirim untuk memastikan hasil 100% sesuai ekspektasi Anda.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl flex flex-col gap-3">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center">
                3
              </span>
              <h3 className="font-bold text-base text-white">Pengiriman Tepat Waktu</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kurir mengantarkan pesanan dengan aman sampai ke alamat tujuan dengan bukti foto penerima di lokasi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          GALLERY SECTION
      ═════════════════════════════════════════════════════════════ */}
      {data.gallery && data.gallery.length > 0 && (
        <section id="galeri" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-extrabold tracking-wider uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                Dokumentasi Asli
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-3">
                Galeri Karya &amp; Suasana
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {data.gallery.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs group"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  </div>
                  <div className="p-3.5">
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">{item.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════
          GOOGLE MAPS REVIEWS
      ═════════════════════════════════════════════════════════════ */}
      <section id="ulasan" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1 text-amber-500 font-extrabold text-sm mb-2">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
              Kata Pelanggan di Google Maps
            </h2>
            <p className="text-xs text-slate-500 mt-2">
              Ulasan nyata dari pelanggan yang telah membuktikan kualitas layanan {data.businessName}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {data.testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between gap-4"
              >
                <p className="text-slate-700 text-sm leading-relaxed italic">
                  &ldquo;{t.comment}&rdquo;
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{t.name}</span>
                    <span className="text-[11px] text-slate-500">{t.role || 'Pelanggan Terverifikasi'}</span>
                  </div>
                  <div className="flex text-amber-400">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          FAQ ACCORDION
      ═════════════════════════════════════════════════════════════ */}
      {data.faqs && data.faqs.length > 0 && (
        <section id="faq" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <span className="text-xs font-extrabold tracking-wider uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                Tanya Jawab
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-3">
                Pertanyaan yang Sering Diajukan
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              {data.faqs.map((faq, idx) => (
                <details
                  key={idx}
                  className="group bg-slate-50 rounded-2xl border border-slate-200 p-5 transition open:bg-white open:shadow-xs"
                >
                  <summary className="flex items-center justify-between font-bold text-slate-900 text-sm sm:text-base cursor-pointer list-none">
                    <span>{faq.question}</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200 text-xs">
                      ▼
                    </span>
                  </summary>
                  <p className="text-slate-600 text-xs sm:text-sm mt-3 pt-3 border-t border-slate-200/60 leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════
          LOKASI & JAM OPERASIONAL
      ═════════════════════════════════════════════════════════════ */}
      <section id="lokasi" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 flex flex-col gap-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Lokasi &amp; Kontak
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Siap Melayani Anda di {data.city}
              </h2>
              <div className="flex flex-col gap-2.5 text-slate-300 text-xs sm:text-sm pt-2">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{data.address}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{data.businessHours}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>WhatsApp: {data.phone}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-3">
              <a
                href={clientWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-lg cursor-pointer text-center"
              >
                <MessageCircle className="w-5 h-5 fill-slate-950" />
                <span>Chat Langsung via WhatsApp</span>
              </a>

              {data.mapsUrl && (
                <a
                  href={data.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Google Maps</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          FOOTER
      ═════════════════════════════════════════════════════════════ */}
      <footer className="bg-white py-8 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} {data.businessName}. Hak cipta dilindungi.
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Rancangan konsep website resmi oleh</span>
            <strong className="text-slate-800 font-bold">CoreCraft Studio</strong>
          </div>
        </div>
      </footer>

      {/* ═════════════════════════════════════════════════════════════
          STICKY MOBILE BOTTOM CONTACT BAR
      ═════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:hidden shadow-xl flex items-center justify-between gap-3">
        <div className="truncate">
          <span className="text-[10px] text-slate-500 block truncate">{data.businessName}</span>
          <span className="text-xs font-bold text-slate-900 block truncate">Konsultasi &amp; Order</span>
        </div>
        <a
          href={clientWaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-md shrink-0"
          style={{ backgroundColor: data.primaryColor }}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Chat WhatsApp</span>
        </a>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          FLOATING DESKTOP WHATSAPP BUTTON (Bottom Right)
      ═════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:flex fixed bottom-6 right-6 z-40 flex-col items-end gap-2">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Tanya &amp; Order via WhatsApp</span>
        </div>
        <a
          href={clientWaLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
          title="Chat WhatsApp Resmi"
        >
          <MessageCircle className="w-7 h-7" />
        </a>
      </div>
    </div>
  );
}
