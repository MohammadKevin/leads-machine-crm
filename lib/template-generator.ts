export type OutreachCategory =
  | 'kos'
  | 'wedding'
  | 'properti'
  | 'rental'
  | 'umkm'
  | 'jasa'
  | 'general';

export interface CategoryOption {
  id: OutreachCategory;
  label: string;
  badge: string;
  description: string;
}

export const OUTREACH_CATEGORIES: CategoryOption[] = [
  {
    id: 'umkm',
    label: 'UMKM, Kuliner & Retail (Katalog & Stand QR)',
    badge: 'Katalog & Stand QR Kasir',
    description: 'Katalog visual cepat, order direct-to-WA, plus stand akrilik QR review kasir untuk mendongkrak bintang 5.',
  },
  {
    id: 'kos',
    label: 'Kos-Kosan & Homestay (Booking & Kamar)',
    badge: 'Katalog Kamar & KTP',
    description: 'Katalog ketersediaan live, verifikasi KTP penyewa aman, dan auto-reminder jatuh tempo WA.',
  },
  {
    id: 'jasa',
    label: 'Klinik, Bimbel & Jasa Servis (Reservasi & Profil)',
    badge: 'Reservasi & Stand QR',
    description: 'Jadwal layanan instan tanpa chat manual panjang plus stand akrilik QR Google Maps di meja resepsionis.',
  },
  {
    id: 'wedding',
    label: 'Wedding, Event & Fotografi (Galeri & Jadwal)',
    badge: 'Galeri HD & Booking',
    description: 'Showcase portofolio visual estetik, rincian paket pricelist, dan booking tanggal acara.',
  },
  {
    id: 'properti',
    label: 'Kontraktor, Arsitek & Desain Interior',
    badge: 'Portofolio & Estimasi RAB',
    description: 'Showcase proyek hasil bangun/renovasi, testimoni, dan konsultasi estimasi anggaran proyek.',
  },
  {
    id: 'rental',
    label: 'Rental Mobil, Motor & Sewa Alat',
    badge: 'Katalog Armada & Jadwal',
    description: 'Katalog ketersediaan unit armada, syarat sewa cepat, dan booking langsung ke admin WA.',
  },
  {
    id: 'general',
    label: 'Bisnis Independen Lokal (Value-First)',
    badge: 'Otomasi Alur & Stand QR',
    description: 'Audit ringan, optimasi alur order/reservasi pelanggan, dan stand akrilik QR review kasir.',
  },
];

const KOS_KEYWORDS = [
  'kos',
  'kost',
  'kostan',
  'kosan',
  'homestay',
  'guesthouse',
  'guest house',
  'penginapan',
  'asrama',
  'wisma',
  'residence',
  'boarding house',
  'kontrakan',
  'villa',
];

const WEDDING_KEYWORDS = [
  'wedding',
  'wo',
  'organizer',
  'fotografer',
  'fotografi',
  'photography',
  'videografi',
  'mua',
  'makeup',
  'make up',
  'dekorasi',
  'sewa gaun',
  'jas',
  'kebaya',
  'undangan',
  'event organizer',
  'eo',
];

const PROPERTI_KEYWORDS = [
  'kontraktor',
  'arsitek',
  'interior',
  'renovasi',
  'mebel',
  'furniture',
  'baja ringan',
  'kanopi',
  'aluminium',
  'kusen',
  'tukang',
  'plafon',
  'kitchen set',
];

const RENTAL_KEYWORDS = [
  'rental',
  'sewa mobil',
  'sewa motor',
  'rent car',
  'persewaan',
  'sewa kamera',
  'sewa alat',
  'camping',
  'outdoor',
  'tour',
  'travel',
  'charter',
];

const UMKM_KEYWORDS = [
  'konveksi',
  'florist',
  'bunga',
  'katering',
  'catering',
  'bakery',
  'kue',
  'roti',
  'sablon',
  'kaos',
  'baju',
  'fashion',
  'butik',
  'kerajinan',
  'souvenir',
  'percetakan',
  'printing',
  'toko',
  'distributor',
  'grosir',
  'snack',
  'kuliner',
  'frozen food',
  'hijab',
  'sepatu',
  'tas',
  'cafe',
  'kafe',
  'warung',
  'resto',
  'restoran',
  'kedai',
  'depot',
];

const JASA_KEYWORDS = [
  'bimbel',
  'bimbingan',
  'les',
  'kursus',
  'daycare',
  'sekolah',
  'klinik',
  'dokter',
  'apotek',
  'dental',
  'gigi',
  'bengkel',
  'servis',
  'service',
  'cuci',
  'carwash',
  'salon',
  'barbershop',
  'spa',
  'laundry',
  'notaris',
  'kantor',
  'konsultan',
  'logistik',
  'ekspedisi',
  'gym',
  'fitness',
  'studio',
  'fisioterapi',
  'terapi',
];

export function detectCategory(businessName: string, query?: string): OutreachCategory {
  const combined = `${businessName} ${query || ''}`.toLowerCase();

  for (const kw of KOS_KEYWORDS) {
    if (combined.includes(kw)) return 'kos';
  }
  for (const kw of WEDDING_KEYWORDS) {
    if (combined.includes(kw)) return 'wedding';
  }
  for (const kw of PROPERTI_KEYWORDS) {
    if (combined.includes(kw)) return 'properti';
  }
  for (const kw of RENTAL_KEYWORDS) {
    if (combined.includes(kw)) return 'rental';
  }
  for (const kw of UMKM_KEYWORDS) {
    if (combined.includes(kw)) return 'umkm';
  }
  for (const kw of JASA_KEYWORDS) {
    if (combined.includes(kw)) return 'jasa';
  }

  return 'general';
}

/**
 * Sanitasi nama bisnis dari Google Maps yang sering mengandung keyword panjang.
 * Contoh: "Family Home Kos: Harian / Bulanan / Tahun" → "Family Home Kos"
 */
export function sanitizeBusinessName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName.trim();

  // Ambil bagian sebelum tanda titik dua (keyword separator umum di Maps)
  const colonIdx = name.indexOf(':');
  if (colonIdx > 0 && colonIdx < name.length - 1) {
    name = name.substring(0, colonIdx).trim();
  }

  // Hapus isi dalam tanda kurung "(...)" atau "[...]"
  name = name.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();

  // Jika masih ada garis miring, ambil segmen pertama saja (contoh: "Kos / Homestay" → "Kos")
  const slashParts = name.split('/').map((s) => s.trim()).filter(Boolean);
  if (slashParts.length > 0) {
    name = slashParts[0];
  }

  // Bersihkan strip (-) di awal/akhir dan spasi berlebih
  name = name.replace(/^-+|-+$/g, '').replace(/\s{2,}/g, ' ').trim();

  return name;
}

export interface GenerateTemplateParams {
  businessName: string;
  category?: OutreachCategory | string;
  senderName?: string;
  senderRole?: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
}

export function generateOutreachMessage({
  businessName,
  category = 'general',
}: GenerateTemplateParams): string {
  const name = sanitizeBusinessName(businessName) || 'Bapak/Ibu';

  if (category === 'kos') {
    return `Halo Kak, salam kenal! Saya lihat ${name} di Google Maps memiliki lokasi yang cukup strategis dan ulasan yang positif.

Saya membayangkan mungkin admin sering kerepotan menjawab chat tanya ketersediaan kamar kosong, syarat sewa, dan verifikasi KTP secara manual satu per satu — apalagi kalau calon penghuni ramai bertanya di jam yang sama.

Saya bisa bantu ringankan dengan:
• Tampilan katalog kamar yang bisa diakses langsung — calon penghuni bisa lihat kamar kosong tanpa perlu tanya dulu
• Alur booking dan upload KTP langsung via WhatsApp tanpa admin harus forward data manual
• Stand akrilik QR review Google Maps di resepsionis agar testimoni positif makin terkumpul otomatis

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
  }

  if (category === 'wedding') {
    return `Halo Kak, salam kenal! Saya melihat portofolio ${name} di Google Maps — hasil karya yang ditampilkan cukup menarik dan berkualitas.

Saya paham di bisnis wedding, calon pengantin biasanya bertanya paket harga berulang kali, minta lihat galeri, dan tanya ketersediaan tanggal secara manual — yang menghabiskan banyak waktu admin.

Saya bisa bantu sederhanakan dengan:
• Galeri portofolio interaktif yang bisa langsung diakses tanpa kirim PDF bolak-balik
• Tampilan paket pricelist dan jadwal booking otomatis yang terhubung ke WhatsApp
• Stand akrilik QR review Google Maps di booth pameran atau studio agar testimoni mudah terkumpul

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
  }

  if (category === 'properti') {
    return `Halo Pak/Bu, salam kenal! Saya lihat pengerjaan proyek ${name} di Google Maps cukup rapi dan meyakinkan.

Saya perhatikan, di bidang properti dan kontraktor, seringkali calon klien bertanya portofolio, minta estimasi RAB, dan tanya jadwal proyek secara manual — yang kadang membuat repot saat sedang banyak penawaran.

Saya bisa bantu rapikan dengan:
• Halaman portofolio interaktif untuk show hasil renovasi atau bangunan yang sudah dikerjakan
• Alur konsultasi dan permintaan estimasi RAB yang langsung terhubung ke WhatsApp
• Integrasi QR review Google Maps di showroom atau kantor agar testimoni proyek mudah terkumpul

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Pak/Bu? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
  }

  if (category === 'rental') {
    return `Halo Kak, salam kenal! Saya lihat ${name} di Google Maps memiliki rating yang cukup baik.

Bisnis rental biasanya punya kendala klasik: calon penyewa bertanya unit yang tersedia, syarat sewa, dan harga berulang kali — belum lagi tanya ketersediaan jadwal yang harus di-cek manual dulu ke buku.

Saya bisa bantu atasi dengan:
• Katalog armada/unit interaktif yang bisa diakses langsung — calon penyewa lihat unit ready tanpa nanya dulu
• Alur booking dan syarat sewa otomatis yang langsung masuk ke WhatsApp operasional
• Stand akrilik QR review Google Maps di lokasi agar ulasan positif makin banyak dan otomatis

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
  }

  if (category === 'umkm') {
    return `Halo Kak, salam kenal! Saya lihat ulasan ${name} di Google Maps cukup ramai — artinya bisnisnya sudah punya tempat di hati pelanggan.

Yang sering saya dengar dari pengusaha kuliner dan retail, admin sering kewalahan membalas chat menanyakan menu, harga, dan stok berulang kali — bahkan sampai ada calon pelanggan yang kabur karena respon lambat.

Saya bisa bantu dengan:
• Katalog menu/produk interaktif langsung via link — pelanggan bisa lihat sendiri tanpa perlu tanya
• Alur order otomatis yang terhubung ke WhatsApp operasional, mengurangi chat manual
• Stand akrilik QR review Google Maps di meja kasir agar pelanggan mudah meninggalkan ulasan bintang 5

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
  }

  if (category === 'jasa') {
    return `Halo Kak, salam kenal! Saya lihat reputasi layanan ${name} di Google Maps cukup baik dan banyak ulasan positif.

Bisnis jasa seperti klinik, bimbel, atau bengkel sering menghadapi tantangan yang mirip: jadwal harus di-cek manual, pasien/siswa harus chat dulu untuk booking, dan seringkali ada informasi dasar yang ditanyakan berulang kali.

Saya bisa bantu sederhanakan dengan:
• Tampilan jadwal layanan yang bisa diakses langsung tanpa perlu tanya-tanya dulu
• Alur reservasi/booking otomatis yang terhubung ke WhatsApp operasional
• Stand akrilik QR review Google Maps di meja resepsionis agar testimoni positif pelanggan mudah terkumpul

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
  }

  return `Halo Kak, salam kenal! Saya lihat profil ${name} di Google Maps memiliki reputasi yang cukup baik di area sekitar.

Banyak bisnis lokal menghadapi masalah yang serupa: admin sibuk membalas chat pertanyaan berulang, pelanggan harus menunggu lama untuk info sederhana, dan promosi dari mulut ke mulut susah berkembang karena testimoni tidak terkumpul dengan rapi.

Saya bisa bantu dengan:
• Tampilan profil bisnis interaktif dan katalog produk/layanan yang bisa diakses langsung
• Alur pemesanan atau pertanyaan yang otomatis terhubung ke WhatsApp admin
• Stand akrilik QR review Google Maps untuk meja kasir agar ulasan bintang 5 mudah terkumpul

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
}

export function createWhatsAppOutreachUrl(
  phone: string,
  params: GenerateTemplateParams
): string {
  const message = generateOutreachMessage(params);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedText}`;
}
