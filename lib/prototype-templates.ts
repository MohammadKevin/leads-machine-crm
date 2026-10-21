import { PrototypeData, PrototypeNiche } from '@/types/prototype';
import { normalizeIndonesianPhone } from './defensive-client';

export function detectNicheFromCategory(category: string, name: string): PrototypeNiche {
  const text = `${category} ${name}`.toLowerCase();
  if (
    text.includes('florist') ||
    text.includes('bunga') ||
    text.includes('buket') ||
    text.includes('bouquet') ||
    text.includes('karangan') ||
    text.includes('standing flower') ||
    text.includes('dekorasi') ||
    text.includes('hantaran') ||
    text.includes('papan bunga')
  ) {
    return 'florist';
  }
  if (
    text.includes('klinik') ||
    text.includes('apotek') ||
    text.includes('dokter') ||
    text.includes('gigi') ||
    text.includes('dental') ||
    text.includes('estetika') ||
    text.includes('kecantikan') ||
    text.includes('skincare')
  ) {
    return 'klinik';
  }
  if (
    text.includes('villa') ||
    text.includes('homestay') ||
    text.includes('guesthouse') ||
    text.includes('resort') ||
    text.includes('kos') ||
    text.includes('penginapan') ||
    text.includes('glamping')
  ) {
    return 'villa';
  }
  if (
    text.includes('kontraktor') ||
    text.includes('arsitek') ||
    text.includes('interior') ||
    text.includes('renovasi') ||
    text.includes('bangunan') ||
    text.includes('konstruksi')
  ) {
    return 'kontraktor';
  }
  if (
    text.includes('bengkel') ||
    text.includes('otomotif') ||
    text.includes('motor') ||
    text.includes('mobil') ||
    text.includes('cuci') ||
    text.includes('ac')
  ) {
    return 'bengkel';
  }
  if (
    text.includes('cafe') ||
    text.includes('resto') ||
    text.includes('kopi') ||
    text.includes('bakso') ||
    text.includes('makan') ||
    text.includes('culinary') ||
    text.includes('kuliner')
  ) {
    return 'resto';
  }
  if (
    text.includes('pabrik') ||
    text.includes('distributor') ||
    text.includes('suplier') ||
    text.includes('manufaktur') ||
    text.includes('logistik') ||
    text.includes('pt ') ||
    text.includes('cv ')
  ) {
    return 'corporate';
  }
  return 'general';
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

export function unslugify(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildAdaptivePrompt(params: {
  businessName: string;
  category?: string;
  city?: string;
  chatMessage?: string;
  niche?: PrototypeNiche;
}): string {
  const name = params.businessName || 'Bisnis Klien';
  const category = params.category || 'Layanan Profesional';
  const niche = params.niche || detectNicheFromCategory(category, name);
  const city = params.city || 'Jatim';
  const chat = params.chatMessage?.trim();

  if (chat && chat.length > 8) {
    // Clean preview snippet
    const cleanSnippet = chat.replace(/\s+/g, ' ').slice(0, 150);
    return `Website profesional untuk ${name} (${category}) di ${city}. Sesuai dengan pesan obrolan chat outreach: "${cleanSnippet}...". Tampilkan katalog layanan/produk spesifik yang relevan dengan chat tersebut, paket harga transparan, ulasan bintang 5 Google Maps, dan tombol WhatsApp order kilat.`;
  }

  switch (niche) {
    case 'florist':
      return `Website luxury florist & studio bunga untuk ${name} di ${city}. Fokus katalog buket wisuda & fresh bloom mawar, karangan bunga papan ucapan/duka cita express same-day delivery, gratis kartu ucapan custom, foto produk estetik, dan tombol direct WhatsApp pemesanan cepat.`;
    case 'villa':
      return `Website privat villa & glamping eksklusif untuk ${name} di ${city}. Highlight fasilitas private pool pemandangan alam, kamar luas, paket sewa harian & gathering keluarga, perbandingan direct booking tanpa potongan komisi OTA 15-20%, dan tombol cek ketersediaan via WA.`;
    case 'klinik':
      return `Website resmi & pendaftaran online untuk ${name} di ${city}. Tampilkan jadwal dokter, kebersihan fasilitas medis, layanan unggulan gigi/estetika/umum, testimoni pasien puas, dan tombol pendaftaran appointment cepat via WhatsApp tanpa antre.`;
    case 'kontraktor':
      return `Website portofolio kontraktor & arsitektur untuk ${name} di ${city}. Tampilkan galeri hasil bangun & renovasi rumah, transparansi RAB tanpa biaya tersembunyi, garansi pemeliharaan struktur, dan tombol konsultasi desain/survey lokasi gratis via WhatsApp.`;
    case 'bengkel':
      return `Website bengkel resmi & perawatan otomotif untuk ${name} di ${city}. Tampilkan paket servis berkala, tune-up, ganti oli, transparansi estimasi biaya suku cadang, garansi kerja, dan booking antrean via WhatsApp.`;
    case 'resto':
      return `Website kafe & restoran kekinian untuk ${name} di ${city}. Tampilkan menu makanan & minuman signature terlaris, promo santap hemat, galeri suasana tempat cozy untuk kumpul/nongkrong, dan tombol reservasi meja via WhatsApp.`;
    case 'corporate':
      return `Website profil perusahaan & mitra pengadaan resmi untuk ${name} di ${city}. Tampilkan kapasitas produksi industri, legalitas lengkap, portofolio kerjasama B2B, dan tombol permintaan proposal resmi via WhatsApp.`;
    default:
      return `Website profesional dan konversi tinggi untuk ${name} (${category}) di ${city}. Desain responsif cepat dibuka di HP, katalog layanan unggulan dengan harga jujur, rating terverifikasi Google Maps, dan tombol pemesanan langsung ke WhatsApp.`;
  }
}

export function createDefaultPrototype(params: {
  businessName: string;
  category?: string;
  city?: string;
  phone?: string;
  rating?: number;
  reviewsCount?: number;
  address?: string;
  mapsUrl?: string;
  chatMessage?: string;
}): PrototypeData {
  const businessName = params.businessName || 'Bisnis Anda';
  const category = params.category || 'Layanan Profesional';
  const niche = detectNicheFromCategory(category, businessName);
  const city = params.city || 'Malang / Jawa Timur';
  const phone = normalizeIndonesianPhone(params.phone || '081234567890');
  const rating = params.rating || 4.9;
  const reviewsCount = params.reviewsCount || 48;
  const address = params.address || `Jl. Utama Bisnis No. 12, ${city}`;
  const slug = slugify(businessName) || 'preview-klien';

  const defaultByNiche: Record<
    PrototypeNiche,
    Omit<
      PrototypeData,
      | 'id'
      | 'slug'
      | 'businessName'
      | 'category'
      | 'niche'
      | 'city'
      | 'phone'
      | 'address'
      | 'mapsUrl'
      | 'rating'
      | 'reviewsCount'
      | 'customDomain'
      | 'status'
      | 'viewCount'
      | 'createdAt'
      | 'updatedAt'
    >
  > = {
    florist: {
      badgeText: 'Florist & Studio Rangkaian Bunga Segar Pilihan',
      headline: `Rangkaian Bunga Segar & Buket Eksklusif untuk Setiap Momen di ${city}`,
      subheadline:
        'Pesan buket wisuda, anniversary, hingga karangan bunga papan express. Bunga segar premium, gratis kartu ucapan custom, dan jaminan sampai tepat waktu.',
      heroImage:
        'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#be185d', // Deep Rose / Ruby Florist
      themeStyle: 'luxury',
      promoBanner: '🌸 Promo Spesial: Gratis Kartu Ucapan Custom + Free Delivery Radius 5 Km Hari Ini!',
      services: [
        {
          title: 'Buket Mawar & Fresh Bloom Premium',
          description:
            'Rangkaian mawar segar pilihan grade A dengan wrapping cellophan ala Korea. Cocok untuk wisuda, anniversary & kado spesial.',
          price: 'Mulai Rp 185.000',
          badge: 'Paling Laris',
          image:
            'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Karangan Bunga Papan Ucapan & Duka Cita',
          description:
            'Bunga papan selamat & sukses, grand opening, atau duka cita dengan bunga segar keliling. Express pengerjaan 2-3 jam siap kirim.',
          price: 'Mulai Rp 450.000',
          badge: 'Same Day Delivery',
          image:
            'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Standing Flower & Table Vase Mewah',
          description:
            'Rangkaian standing flower bertingkat dengan kombinasi lily, krisan, mawar & baby breath untuk acara formal dan VIP.',
          price: 'Mulai Rp 650.000',
          badge: 'Eksklusif VIP',
          image:
            'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Bloom Box & Money/Snack Bouquet',
          description:
            'Kado kekinian dalam round box mewah atau buket uang & snack custom dengan sentuhan bunga preserved tahan lama.',
          price: 'Mulai Rp 220.000',
          badge: 'Tren Kekinian',
          image:
            'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        '100% Bunga Segar Pilihan dari Dataran Tinggi Berkualitas',
        'Layanan Kilat Same-Day Delivery Area Kota & Sekitarnya',
        'Gratis Kartu Ucapan Cetak Custom & Foto Hasil Sebelum Dikirim',
        'Konsultasi Desain Ramah Menyesuaikan Budget & Selera Anda',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=600&q=80',
          title: 'Buket Mawar Merah Korean Wrapping',
        },
        {
          url: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80',
          title: 'Karangan Bunga Papan Elegan',
        },
        {
          url: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?auto=format&fit=crop&w=600&q=80',
          title: 'Standing Flower & Meja VIP',
        },
        {
          url: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80',
          title: 'Bloom Box Hadiah Mewah',
        },
      ],
      testimonials: [
        {
          name: 'Amanda Clarissa',
          comment:
            'Pesan buket dadakan H-1 wisuda adik, hasilnya masyaAllah cantik banget! Bunganya segar, wrapping-nya rapi kayak buket Korea, dan diantar tepat waktu ke venue.',
          rating: 5,
          role: 'Pelanggan Buket Wisuda',
        },
        {
          name: 'dr. Bobby Wicaksono',
          comment:
            'Langganan kirim bunga papan ucapan selamat & duka cita rekan dokter di Malang. Fast respon via WA, ada foto bukti sebelum dan sesudah dipajang di lokasi.',
          rating: 5,
          role: 'Pelanggan Korporat / Instansi',
        },
      ],
      faqs: [
        {
          question: 'Apakah bisa pesan dan diantar di hari yang sama (Same-Day Delivery)?',
          answer:
            'Bisa banget! Untuk buket bunga dan standing flower ready stock diproses dalam 1-2 jam. Untuk karangan bunga papan ucapan proses sekitar 2-3 jam siap meluncur ke lokasi penerima.',
        },
        {
          question: 'Apakah ada foto dan video hasil rangkaian sebelum dikirim?',
          answer:
            'Pasti! Tim kami selalu mengirimkan foto dan video hasil rangkaian bunga via WhatsApp untuk approval Anda sebelum kurir berangkat.',
        },
        {
          question: 'Apakah bisa custom warna bunga dan kartu ucapan?',
          answer:
            'Tentu bisa. Anda bisa request warna mawar, jenis wrapping kertas, hingga pesan ucapan personal yang dicetak rapi secara gratis.',
        },
        {
          question: 'Bagaimana cara pembayaran pemesanan?',
          answer:
            'Pembayaran sangat mudah via Transfer Bank (BCA, Mandiri, BRI) atau QRIS otomatis langsung dari chat WhatsApp.',
        },
      ],
      businessHours: 'Buka Setiap Hari: 07.30 - 21.00 WIB (Pemesanan WA 24 Jam)',
    },

    klinik: {
      badgeText: 'Praktek Medis & Pelayanan Terpercaya',
      headline: `Layanan Medis & Perawatan Terbaik untuk Kesehatan Anda di ${city}`,
      subheadline:
        'Konsultasi dokter ramah, fasilitas bersih higienis, dan jadwal temu praktis langsung terhubung ke WhatsApp resmi kami.',
      heroImage:
        'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#059669', // Emerald
      themeStyle: 'clean',
      promoBanner: '✨ Spesial Bulan Ini: Gratis Pemeriksaan & Konsultasi Awal',
      services: [
        {
          title: 'Konsultasi Dokter & Tindakan',
          description: 'Pemeriksaan komprehensif oleh dokter berpengalaman dengan standar higienitas tinggi.',
          price: 'Mulai Rp 75.000',
          badge: 'Paling Populer',
          image:
            'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Paket Perawatan Gigi & Scaling',
          description: 'Pembersihan karang gigi, penambalan estetis, dan perawatan kesehatan mulut menyeluruh.',
          price: 'Mulai Rp 150.000',
          image:
            'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Layanan Cek Lab & Skrining',
          description: 'Pemeriksaan cepat dengan hasil akurat dan konsultasi langsung dengan dokter jaga.',
          price: 'Hasil Hari yang Sama',
          image:
            'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Layanan Obat & Resep Terverifikasi',
          description: 'Apotek lengkap dengan jaminan obat asli dan petunjuk pemakaian transparan.',
          price: 'Tersedia Lengkap',
          image:
            'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Dokter bersertifikat & komunikatif',
        'Ruang tunggu bersih, nyaman & AC',
        'Pendaftaran online tanpa antre lama via WA',
        'Pelayanan ramah untuk seluruh anggota keluarga',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80',
          title: 'Ruang Konsultasi Bersih & Steril',
        },
        {
          url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=600&q=80',
          title: 'Peralatan Modern & Terkalibrasi',
        },
        {
          url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80',
          title: 'Tim Medis Berdedikasi',
        },
      ],
      testimonials: [
        {
          name: 'Ibu Sarah Amelia',
          comment: 'Pelayanannya ramah sekali, tempatnya sangat bersih, dan dokternya menjelaskan dengan detail dan sabar.',
          rating: 5,
          role: 'Pasien Rutin',
        },
        {
          name: 'Pak Hendra Kurniawan',
          comment: 'Daftar via WA sangat cepat, tidak perlu antre berjam-jam. Recommended banget untuk warga sekitar!',
          rating: 5,
          role: 'Pasien Umum',
        },
      ],
      faqs: [
        {
          question: 'Apakah perlu booking terlebih dahulu sebelum datang?',
          answer:
            'Disarankan booking appointment via WhatsApp agar tidak perlu antre lama di ruang tunggu dan dokter sudah siap melayani.',
        },
        {
          question: 'Bagaimana standar sterilisasi alat medis yang digunakan?',
          answer:
            'Semua alat melalui proses autoklaf standar rumah sakit dan alat sekali pakai selalu dibuka di depan pasien.',
        },
      ],
      businessHours: 'Senin - Sabtu: 08.00 - 20.00 WIB (Minggu Libur)',
    },

    villa: {
      badgeText: 'Staycation & Liburan Private Eksklusif',
      headline: `Penginapan Private Nyaman & Asri di Kawasan ${city}`,
      subheadline:
        'Nikmati suasana tenang bersama keluarga dengan pemandangan indah, fasilitas lengkap, dan jaminan harga terbaik tanpa potongan komisi aplikasi.',
      heroImage:
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#0284c7', // Sky Blue
      themeStyle: 'luxury',
      promoBanner: '🏡 Direct Booking Promo: Diskon Spesial Booking Langsung via WhatsApp Tanpa Komisi OTA',
      services: [
        {
          title: 'Sewa Full Villa (Private Pool)',
          description: 'Akses penuh ke seluruh properti termasuk private pool, dapur lengkap, dan ruang santai keluarga.',
          price: 'Mulai Rp 1.500.000 / Malam',
          badge: 'Favorit Tamu',
          image:
            'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Paket Staycation Weekend & BBQ',
          description: 'Paket menginap 2 hari 1 malam lengkap dengan sarapan dan set alat BBQ siap pakai.',
          price: 'Harga Spesial Rombongan',
          image:
            'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Sewa Harian / Transit Keluarga',
          description: 'Kamar nyaman dan bersih dengan fasilitas air hangat, smart TV, dan wifi kencang.',
          price: 'Mulai Rp 450.000 / Malam',
          image:
            'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Event Santai & Gathering Intim',
          description: 'Lokasi pas untuk arisan, perayaan ulang tahun, atau kumpul komunitas kecil.',
          price: 'Kapasitas s/d 25 Orang',
          image:
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Private Swimming Pool & Taman Asri',
        'Dapur Lengkap (Kompor, Kulkas, Dispenser)',
        'Smart TV + Netflix & High-Speed WiFi',
        'Area Parkir Luas & Aman 24 Jam',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
          title: 'Teras & Private Pool View',
        },
        {
          url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=600&q=80',
          title: 'Kamar Tidur Utama Luas & Nyaman',
        },
        {
          url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
          title: 'Ruang Keluarga & Dapur Bersih',
        },
      ],
      testimonials: [
        {
          name: 'Dimas Prasetyo',
          comment: 'Tempatnya jauh lebih bagus dari fotonya! Sangat bersih, udara sejuk, dan pemiliknya ramah sekali.',
          rating: 5,
          role: 'Tamu Keluarga',
        },
        {
          name: 'Nadia Rahmawati',
          comment: 'Anak-anak suka sekali kolam renangnya. Sangat puas booking langsung via WA, prosesnya cepat dan dapat harga lebih murah.',
          rating: 5,
          role: 'Staycation Weekend',
        },
      ],
      faqs: [
        {
          question: 'Bagaimana cara booking dan cek tanggal kosong?',
          answer:
            'Cukup klik tombol WhatsApp, admin kami akan langsung memberikan kalender tanggal yang masih tersedia beserta foto unit terkini.',
        },
        {
          question: 'Apakah diperbolehkan membawa makanan dari luar?',
          answer:
            'Sangat diperbolehkan! Villa dilengkapi dapur lengkap dengan kulkas, kompor, dan alat makan siap pakai.',
        },
      ],
      businessHours: 'Check-in: 14.00 WIB | Check-out: 12.00 WIB (Resepsionis 24 Jam)',
    },

    kontraktor: {
      badgeText: 'Jasa Kontraktor & Renovasi Berpengalaman',
      headline: `Wujudkan Rumah Impian & Bangunan Kokoh di ${city} dengan Hasil Bergaransi`,
      subheadline:
        'Pengerjaan transparan dengan RAB detail, mandor ahli, pemilihan material terbaik, dan garansi pemeliharaan pasca proyek.',
      heroImage:
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#0f172a',
      themeStyle: 'modern',
      promoBanner: '📐 Konsultasi Desain & Survey Lokasi Gratis untuk Wilayah Sekitar',
      services: [
        {
          title: 'Pembangunan Rumah Baru dari Nol',
          description: 'Mulai dari pondasi hingga finishing mewah, terstruktur dengan laporan progres berkala.',
          price: 'RAB Transparan Sesuai Budget',
          badge: 'Garansi Struktur',
          image:
            'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Renovasi Rumah & Penambahan Lantai',
          description: 'Pelebaran ruangan, renovasi atap, dak cor beton, dan peremajaan fasad rumah modern.',
          price: 'Survey Gratis',
          image:
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Desain Interior & Custom Kitchen Set',
          description: 'Pembuatan interior modern minimalis menggunakan bahan HPL premium anti rayap.',
          price: 'Mulai Rp 2.200.000 / meter',
          image:
            'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Pekerjaan Rangka Atap Baja Ringan & Plafon',
          description: 'Instalasi rapi, kuat, presisi, dan tahan terhadap cuaca ekstrem.',
          price: 'Harga Kompetitif',
          image:
            'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Rencana Anggaran Biaya (RAB) Rinci & Tanpa Biaya Tersembunyi',
        'Tenaga Tukang & Mandor Berpengalaman > 10 Tahun',
        'Garansi Pemeliharaan Resmi 3 - 6 Bulan',
        'Surat Perjanjian Kerja (SPK) Legal & Amanah',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
          title: 'Hasil Proyek Rumah Tinggal 2 Lantai',
        },
      ],
      testimonials: [
        {
          name: 'Pak Budi Santoso',
          comment: 'Hasil renovasinya rapi sekali, progres dilaporkan setiap minggu via foto dan video. Sangat amanah!',
          rating: 5,
          role: 'Pemilik Rumah di Malang',
        },
      ],
      faqs: [
        {
          question: 'Apakah survey lokasi dan pembuatan RAB dikenakan biaya?',
          answer: 'Survey lokasi awal dan estimasi RAB pendahuluan 100% gratis tanpa komitmen.',
        },
      ],
      businessHours: 'Senin - Sabtu: 08.00 - 17.00 WIB',
    },

    bengkel: {
      badgeText: 'Bengkel Servis & Perawatan Terpercaya',
      headline: `Performa Kendaraan Prima & Terawat Bersama Montir Ahli di ${city}`,
      subheadline:
        'Penanganan profesional dengan alat diagnostik canggih, suku cadang original, dan transparansi estimasi biaya tanpa akal-akalan.',
      heroImage:
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#b91c1c', // Bold Red Automotive
      themeStyle: 'modern',
      promoBanner: '🚗 Booking Servis Hari Ini: Gratis General Check-Up 21 Titik Kendaraan',
      services: [
        {
          title: 'Tune-Up & Servis Berkala Mesin',
          description: 'Pembersihan ruang bakar, kalibrasi sistem injeksi, dan pengecekan menyeluruh sistem pengapian.',
          price: 'Mulai Rp 150.000',
          badge: 'Wajib Berkala',
          image:
            'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Ganti Oli & Filter Original',
          description: 'Pilihan oli brand ternama dengan jaminan 100% original sesuai spesifikasi pabrikan.',
          price: 'Harga Oli + Free Jasa',
          image:
            'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Perawatan Sistem Rem & Kaki-Kaki',
          description: 'Bubut piringan cakram, ganti kampas rem, dan spooring balancing bergaransi.',
          price: 'Mulai Rp 120.000',
          image:
            'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Servis AC Mobil Dingin Menggigil',
          description: 'Flushing oli kompresor, pembersihan evaporator tanpa bongkar dashboard, dan isi freon.',
          price: 'Mulai Rp 200.000',
          image:
            'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Montir Bersertifikat & Berpengalaman > 8 Tahun',
        'Alat Scanner Komputerisasi Akurat',
        'Garansi Servis & Suku Cadang Resmi',
        'Ruang Tunggu Ber-AC, Free Kopi & WiFi',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80',
          title: 'Peralatan Diagnostik Modern',
        },
      ],
      testimonials: [
        {
          name: 'Agus Pratama',
          comment: 'Montirnya jujur, dikasih tahu mana yang perlu diganti mana yang masih bagus. Gak ada tembak harga.',
          rating: 5,
          role: 'Pelanggan Mobil',
        },
      ],
      faqs: [
        {
          question: 'Apakah bisa booking antrean servis agar tidak menunggu?',
          answer: 'Bisa banget! Cukup chat nomor WhatsApp kami untuk mengunci jam servis kendaraan Anda.',
        },
      ],
      businessHours: 'Senin - Minggu: 08.00 - 17.30 WIB',
    },

    resto: {
      badgeText: 'Cita Rasa Otentik & Suasana Hangat',
      headline: `Nikmati Hidangan Spesial & Momen Bersama di ${city}`,
      subheadline:
        'Resep warisan dengan bahan-bahan segar berkualitas tinggi, suasana nyaman, dan pelayanan ramah untuk santap bersama keluarga maupun rekan kerja.',
      heroImage:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#d97706', // Warm Amber
      themeStyle: 'warm',
      promoBanner: '🍽️ Diskon 15% untuk Reservasi Meja & Pemesanan Gathering via WhatsApp',
      services: [
        {
          title: 'Menu Signature & Rekomendasi Koki',
          description: 'Hidangan andalan dengan paduan rempah istimewa yang digemari pelanggan setia kami.',
          price: 'Mulai Rp 35.000',
          badge: 'Menu Favorit',
          image:
            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Paket Makan Bersama & Keluarga',
          description: 'Porsi hemat lengkap dengan aneka lauk, sayur, sambal segar, dan minuman segar.',
          price: 'Paket Mulai Rp 120.000',
          image:
            'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Reservasi Acara & Ruang VIP',
          description: 'Fasilitas ruang khusus ber-AC dengan sound system untuk arisan, ulang tahun, dan meeting.',
          price: 'Free Booking via WA',
          image:
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Layanan Nasi Kotak & Katering Event',
          description: 'Pengadaan konsumsi higienis, lezat, tepat waktu untuk acara kantor dan syukuran.',
          price: 'Mulai Rp 22.000 / box',
          image:
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Bahan Baku Segar Setiap Hari Tanpa Pengawet',
        'Tempat Bersih, Nyaman, Mushola & Parkir Luas',
        'Penyajian Cepat Tanpa Menunggu Lama',
        'Pelayanan Ramah & Siap Melayani Kebutuhan Acara',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
          title: 'Suasana Restoran Cozy & Hangat',
        },
      ],
      testimonials: [
        {
          name: 'Siti Nurhaliza',
          comment: 'Makanannya enak-enak semua, bumbunya berani dan meresap. Tempatnya nyaman banget buat kumpul keluarga besar.',
          rating: 5,
          role: 'Pengunjung Keluarga',
        },
      ],
      faqs: [
        {
          question: 'Apakah melayani pemesanan katering atau nasi kotak?',
          answer: 'Ya, kami melayani pesanan nasi kotak mulai dari 20 porsi dengan pengiriman tepat waktu.',
        },
      ],
      businessHours: 'Buka Setiap Hari: 10.00 - 22.00 WIB',
    },

    corporate: {
      badgeText: 'Mitra Pengadaan & Suplai Profesional',
      headline: `Solusi Suplai & Kerjasama Bisnis Terpercaya di ${city}`,
      subheadline:
        'Kapasitas produksi andal, legalitas resmi, komitmen mutu standar industri, dan kesiapan kemitraan jangka panjang.',
      heroImage:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#1e3a8a',
      themeStyle: 'modern',
      promoBanner: '💼 Permintaan Penawaran Resmi & Katalog Perusahaan Dapat Dikirim via WhatsApp',
      services: [
        {
          title: 'Suplai Produk Skala Industri & Grosir',
          description: 'Pengadaan berkelanjutan dengan jaminan ketersediaan stok dan harga distributor.',
          price: 'Harga Mitra B2B',
          badge: 'Kapasitas Besar',
          image:
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Kerjasama Kontrak & Tender Resmi',
          description: 'Dukungan dokumen legalitas lengkap, faktur pajak resmi, dan kesepakatan tertulis.',
          price: 'Sesuai SPK / PO',
          image:
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Kustomisasi Produk Sesuai Spesifikasi',
          description: 'Produksi fleksibel menyesuaikan kebutuhan teknis dan standar industri klien.',
          price: 'Konsultasi Teknis',
          image:
            'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Distribusi & Pengiriman Tepat Waktu',
          description: 'Dukungan armada logistik siap menjangkau berbagai wilayah Jawa dan luar pulau.',
          price: 'Jadwal Terjadwal',
          image:
            'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Perusahaan Legal Berizin Resmi (NIB, SIUP, NPWP)',
        'Kapasitas Produksi Teruji & Berkelanjutan',
        'Dukungan Layanan Pelanggan Responsif (Dedicated PIC)',
        'Sistem Pembayaran Fleksibel Sesuai Perjanjian Kontrak',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
          title: 'Gudang & Fasilitas Operasional Modern',
        },
      ],
      testimonials: [
        {
          name: 'Bambang Sudiro',
          comment: 'Sudah 2 tahun menjadi rekanan suplai pabrik kami. Tidak pernah ada kendala pengiriman, komunikasi sangat profesional.',
          rating: 5,
          role: 'Procurement Manager',
        },
      ],
      faqs: [
        {
          question: 'Bagaimana prosedur meminta penawaran harga resmi (RFQ)?',
          answer: 'Kirimkan rincian kebutuhan Anda via WhatsApp atau email, tim sales B2B kami akan mengirim penawaran dalam 1x24 jam.',
        },
      ],
      businessHours: 'Senin - Jumat: 08.30 - 17.00 WIB (Sabtu: 08.30 - 14.00 WIB)',
    },

    general: {
      badgeText: 'Layanan Profesional & Terpercaya',
      headline: `Layanan Terbaik & Berpengalaman untuk Kebutuhan Anda di ${city}`,
      subheadline:
        'Kualitas terjamin, harga transparan, dan kemudahan konsultasi langsung melalui WhatsApp resmi kami.',
      heroImage:
        'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
      primaryColor: '#0f172a',
      themeStyle: 'modern',
      promoBanner: '✨ Dapatkan Informasi Lengkap & Konsultasi Langsung via WhatsApp',
      services: [
        {
          title: 'Paket Layanan Prioritas',
          description: 'Dikerjakan dengan cermat oleh tenaga profesional untuk hasil terbaik.',
          price: 'Harga Kompetitif',
          badge: 'Terbaik',
          image:
            'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Solusi Lengkap & Terpadu',
          description: 'Solusi praktis untuk menghemat waktu dan memberikan hasil maksimal.',
          price: 'Konsultasi Gratis',
          image:
            'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80',
        },
        {
          title: 'Garansi Mutu & Pelayanan Purna Jual',
          description: 'Komitmen pelayanan terbaik demi kepuasan penuh setiap pelanggan.',
          price: 'Bergaransi',
          image:
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
        },
      ],
      features: [
        'Pelayanan Cepat, Ramah & Responsif',
        'Harga Jujur Tanpa Biaya Tersembunyi',
        'Reputasi Bintang 5 Terbukti di Google Maps',
        'Kemudahan Akses Informasi & Pemesanan',
      ],
      gallery: [
        {
          url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80',
          title: 'Fasilitas & Layanan Kami',
        },
      ],
      testimonials: [
        {
          name: 'Pelanggan Setia',
          comment: 'Sangat puas dengan pelayanannya. Cepat tanggap dan hasilnya sesuai ekspektasi.',
          rating: 5,
          role: 'Klien Terverifikasi',
        },
      ],
      faqs: [
        {
          question: 'Bagaimana cara berkonsultasi mengenai layanan ini?',
          answer: 'Anda bisa langsung menekan tombol WhatsApp untuk tersambung ke customer service kami.',
        },
      ],
      businessHours: 'Senin - Sabtu: 08.00 - 18.00 WIB',
    },
  };

  const preset = defaultByNiche[niche] || defaultByNiche.general;

  return {
    id: `proto-${slug}-${Date.now()}`,
    slug,
    businessName,
    category,
    niche,
    city,
    phone,
    address,
    mapsUrl: params.mapsUrl,
    rating,
    reviewsCount,
    customDomain: 'corecraft.my.id',
    subdomainEnabled: true,
    status: 'published',
    publishedAt: new Date().toISOString(),
    viewCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...preset,
  };
}

export function generateFollowUpWhatsAppMessage(data: PrototypeData): string {
  const domain = data.customDomain || 'corecraft.my.id';
  const liveUrl = `https://${domain}/p/${data.slug}`;

  return `Halo selamat siang Kak, salam kenal kembali saya Kevin.

Sesuai obrolan kita tadi, ini saya sudah buatkan pratinjau konsep website kilat untuk *${data.businessName}*:
👉 ${liveUrl}

Halamannya sudah dioptimalkan sangat ringan dibuka di HP, memuat katalog layanan, ulasan bintang 5 dari Google Maps, dan tombol pemesanannya langsung mengarah ke chat WhatsApp ini.

Silakan dilihat-lihat santai yaa Kak. Kira-kira apakah konsep desain dan susunannya sudah cocok dengan karakter ${data.businessName}? Kalau ada yang perlu disesuaikan kabari saya saja yaa 🙏`;
}
