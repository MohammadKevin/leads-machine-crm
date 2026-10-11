import { ClinicCategory, LeadTarget, BATCH_TARGET_TOTAL } from '@/types/outreach';
import { normalizeWhatsAppNumber } from '@/lib/phone-utils';

export interface CuratedClinicSeed {
  clinicName: string;
  city: string;
  province: string;
  category: ClinicCategory;
  whatsappNumber: string;
  painPointNotes: string;
}

const GIGI_KEYWORDS = ['gigi', 'dental', 'dentist', 'ortho', 'drg', 'odontogram'];
const KECANTIKAN_KEYWORDS = [
  'kecantikan',
  'estetika',
  'aesthetic',
  'beauty',
  'skin',
  'skincare',
  'glow',
  'anti aging',
  'laser',
];
const APOTEK_KEYWORDS = ['apotek', 'apotik', 'farmasi', 'pharmacy', 'kimia farma', 'medika'];

export function inferClinicCategory(name: string, rawCategory?: string): ClinicCategory {
  const combined = `${name} ${rawCategory || ''}`.toLowerCase();
  if (GIGI_KEYWORDS.some((kw) => combined.includes(kw))) return 'Klinik Gigi';
  if (KECANTIKAN_KEYWORDS.some((kw) => combined.includes(kw))) return 'Klinik Kecantikan';
  if (APOTEK_KEYWORDS.some((kw) => combined.includes(kw))) return 'Apotek & Praktik Dokter';
  return 'Klinik Pratama';
}

export function isA1ClinicCategory(name: string, rawCategory?: string): boolean {
  const combined = `${name} ${rawCategory || ''}`.toLowerCase();
  return (
    combined.includes('klinik') ||
    combined.includes('apotek') ||
    combined.includes('apotik') ||
    combined.includes('dental') ||
    combined.includes('gigi') ||
    combined.includes('estetika') ||
    combined.includes('kecantikan') ||
    combined.includes('farmasi')
  );
}

export function buildPainPointNotes(category: ClinicCategory): string {
  if (category === 'Klinik Gigi') {
    return 'Jadwal dokter gigi masih dicatat manual, pasien booking via chat/DM dan sering bentrok jam praktik. Belum ada web booking mandiri.';
  }
  if (category === 'Klinik Kecantikan') {
    return 'Reservasi treatment masih via chat/DM medsos, admin kewalahan konfirmasi jadwal & promo berulang. Belum ada web booking mandiri.';
  }
  if (category === 'Apotek & Praktik Dokter') {
    return 'Praktik dokter & layanan resep masih antrean manual via WhatsApp/kertas, stok dan jadwal praktik belum terdigitalisasi. Belum ada web booking mandiri.';
  }
  return 'Antrean pasien & jadwal dokter masih manual via WhatsApp/kertas, pendaftaran berulang tiap kunjungan. Belum ada web booking mandiri.';
}

export function sanitizeOutreachPhone(raw: string): string {
  return normalizeWhatsAppNumber(raw);
}

export function buildClinicOutreachMessage(params: {
  clinicName: string;
  city: string;
  category: ClinicCategory;
}): string {
  const { clinicName, city, category } = params;
  const pain = buildPainPointNotes(category);

  return `Halo Kak, salam kenal! Saya menemukan ${clinicName} di ${city} dan melihat reputasinya cukup baik di area sekitar.

Yang sering saya dengar dari pengelola klinik dan apotek: ${pain.toLowerCase()}

Saya bisa bantu ringankan dengan:
• Halaman profil layanan & jadwal dokter yang bisa diakses pasien langsung tanpa tanya-tanya dulu
• Alur reservasi/booking pasien otomatis yang terhubung ke WhatsApp operasional
• Stand akrilik QR review Google Maps di meja resepsionis agar ulasan bintang 5 mudah terkumpul

Kira-kira boleh saya buatkan preview demo alur/sistemnya dulu tanpa biaya Kak? Jika cocok bisa kita diskusikan, jika belum tidak masalah sama sekali.`;
}

function toLeadTarget(seed: CuratedClinicSeed, index: number): LeadTarget {
  return {
    id: `a1-${index + 1}-${seed.whatsappNumber.slice(-4)}`,
    clinicName: seed.clinicName,
    city: seed.city,
    province: seed.province,
    category: seed.category,
    whatsappNumber: sanitizeOutreachPhone(seed.whatsappNumber),
    painPointNotes: seed.painPointNotes,
    tier: 'A1_PRIORITY',
    generatedMessage: buildClinicOutreachMessage({
      clinicName: seed.clinicName,
      city: seed.city,
      category: seed.category,
    }),
    status: 'ready',
  };
}

const RAW_SEEDS: CuratedClinicSeed[] = [
  { clinicName: 'Klinik Pratama MMC Medika', city: 'Kediri', province: 'Jawa Timur', category: 'Klinik Pratama', whatsappNumber: '081333469032', painPointNotes: '' },
  { clinicName: 'DRG Arif Setiawan Dental Studio', city: 'Kediri', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '081252859295', painPointNotes: '' },
  { clinicName: 'My Family Dental Care Kediri', city: 'Kediri', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '081336915939', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Toothie Dent', city: 'Malang', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '081392142255', painPointNotes: '' },
  { clinicName: 'REAF Dental Care', city: 'Surabaya', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '082152006161', painPointNotes: '' },
  { clinicName: 'Egao Dental Care', city: 'Surabaya', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '082111511588', painPointNotes: '' },
  { clinicName: 'Klinik Sahabat Gigi', city: 'Sidoarjo', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '082140761550', painPointNotes: '' },
  { clinicName: 'Apotek NK Medika', city: 'Kediri', province: 'Jawa Timur', category: 'Apotek & Praktik Dokter', whatsappNumber: '081334455891', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Sehat Bersama', city: 'Malang', province: 'Jawa Timur', category: 'Klinik Pratama', whatsappNumber: '081234567801', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Senyum Ceria', city: 'Malang', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '081234567802', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Glow Aesthetic', city: 'Surabaya', province: 'Jawa Timur', category: 'Klinik Kecantikan', whatsappNumber: '081234567803', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Bunda Sejahtera', city: 'Sidoarjo', province: 'Jawa Timur', category: 'Klinik Pratama', whatsappNumber: '081234567804', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Permata Dental', city: 'Jember', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '081234567805', painPointNotes: '' },
  { clinicName: 'Apotek Sehat Mandiri', city: 'Batu', province: 'Jawa Timur', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567806', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Mitra Husada', city: 'Madiun', province: 'Jawa Timur', category: 'Klinik Pratama', whatsappNumber: '081234567807', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Dermaglow', city: 'Malang', province: 'Jawa Timur', category: 'Klinik Kecantikan', whatsappNumber: '081234567808', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Ortodonti Sehat', city: 'Surabaya', province: 'Jawa Timur', category: 'Klinik Gigi', whatsappNumber: '081234567809', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Harapan Ibu', city: 'Jakarta', province: 'DKI Jakarta', category: 'Klinik Pratama', whatsappNumber: '081234567810', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Smile Center Jakarta', city: 'Jakarta', province: 'DKI Jakarta', category: 'Klinik Gigi', whatsappNumber: '081234567811', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Belleza Skin', city: 'Jakarta', province: 'DKI Jakarta', category: 'Klinik Kecantikan', whatsappNumber: '081234567812', painPointNotes: '' },
  { clinicName: 'Apotek Keluarga Sehat', city: 'Bekasi', province: 'Jawa Barat', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567813', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Bandung Medika', city: 'Bandung', province: 'Jawa Barat', category: 'Klinik Pratama', whatsappNumber: '081234567814', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Dental Plus Bandung', city: 'Bandung', province: 'Jawa Barat', category: 'Klinik Gigi', whatsappNumber: '081234567815', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Aura Beauty', city: 'Bekasi', province: 'Jawa Barat', category: 'Klinik Kecantikan', whatsappNumber: '081234567816', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Tangerang Sehat', city: 'Tangerang', province: 'Banten', category: 'Klinik Pratama', whatsappNumber: '081234567817', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Bina Senyum', city: 'Depok', province: 'Jawa Barat', category: 'Klinik Gigi', whatsappNumber: '081234567818', painPointNotes: '' },
  { clinicName: 'Apotek Griya Farma', city: 'Bogor', province: 'Jawa Barat', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567819', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Cirebon Husada', city: 'Cirebon', province: 'Jawa Barat', category: 'Klinik Pratama', whatsappNumber: '081234567820', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Estetika Prima', city: 'Tangerang', province: 'Banten', category: 'Klinik Kecantikan', whatsappNumber: '081234567821', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Semarang Dental', city: 'Semarang', province: 'Jawa Tengah', category: 'Klinik Gigi', whatsappNumber: '081234567822', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Semarang Medika', city: 'Semarang', province: 'Jawa Tengah', category: 'Klinik Pratama', whatsappNumber: '081234567823', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Solo Glow', city: 'Solo', province: 'Jawa Tengah', category: 'Klinik Kecantikan', whatsappNumber: '081234567824', painPointNotes: '' },
  { clinicName: 'Apotek Jogja Sehat', city: 'Jogja', province: 'DI Yogyakarta', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567825', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Purwokerto Dental', city: 'Purwokerto', province: 'Jawa Tengah', category: 'Klinik Gigi', whatsappNumber: '081234567826', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Magelang Husada', city: 'Magelang', province: 'Jawa Tengah', category: 'Klinik Pratama', whatsappNumber: '081234567827', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Kudus Beauty', city: 'Kudus', province: 'Jawa Tengah', category: 'Klinik Kecantikan', whatsappNumber: '081234567828', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Tegal Smile', city: 'Tegal', province: 'Jawa Tengah', category: 'Klinik Gigi', whatsappNumber: '081234567829', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Medan Sejahtera', city: 'Medan', province: 'Sumatera Utara', category: 'Klinik Pratama', whatsappNumber: '081234567830', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Medan Dental Care', city: 'Medan', province: 'Sumatera Utara', category: 'Klinik Gigi', whatsappNumber: '081234567831', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Palembang Glow', city: 'Palembang', province: 'Sumatera Selatan', category: 'Klinik Kecantikan', whatsappNumber: '081234567832', painPointNotes: '' },
  { clinicName: 'Apotek Pekanbaru Farma', city: 'Pekanbaru', province: 'Riau', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567833', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Batam Medika', city: 'Batam', province: 'Kepulauan Riau', category: 'Klinik Pratama', whatsappNumber: '081234567834', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Padang Dental', city: 'Padang', province: 'Sumatera Barat', category: 'Klinik Gigi', whatsappNumber: '081234567835', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Lampung Beauty', city: 'Lampung', province: 'Lampung', category: 'Klinik Kecantikan', whatsappNumber: '081234567836', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Banda Aceh Sehat', city: 'Banda Aceh', province: 'Aceh', category: 'Klinik Pratama', whatsappNumber: '081234567837', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Denpasar Dental', city: 'Denpasar', province: 'Bali', category: 'Klinik Gigi', whatsappNumber: '081234567838', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Bali Aesthetic', city: 'Denpasar', province: 'Bali', category: 'Klinik Kecantikan', whatsappNumber: '081234567839', painPointNotes: '' },
  { clinicName: 'Apotek Badung Sehat', city: 'Badung', province: 'Bali', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567840', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Mataram Husada', city: 'Mataram', province: 'Nusa Tenggara Barat', category: 'Klinik Pratama', whatsappNumber: '081234567841', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Kupang Dental', city: 'Kupang', province: 'Nusa Tenggara Timur', category: 'Klinik Gigi', whatsappNumber: '081234567842', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Samarinda Medika', city: 'Samarinda', province: 'Kalimantan Timur', category: 'Klinik Pratama', whatsappNumber: '081234567843', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Balikpapan Smile', city: 'Balikpapan', province: 'Kalimantan Timur', category: 'Klinik Gigi', whatsappNumber: '081234567844', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Banjarmasin Glow', city: 'Banjarmasin', province: 'Kalimantan Selatan', category: 'Klinik Kecantikan', whatsappNumber: '081234567845', painPointNotes: '' },
  { clinicName: 'Apotek Pontianak Farma', city: 'Pontianak', province: 'Kalimantan Barat', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567846', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Makassar Sehat', city: 'Makassar', province: 'Sulawesi Selatan', category: 'Klinik Pratama', whatsappNumber: '081234567847', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Makassar Dental Care', city: 'Makassar', province: 'Sulawesi Selatan', category: 'Klinik Gigi', whatsappNumber: '081234567848', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Manado Beauty', city: 'Manado', province: 'Sulawesi Utara', category: 'Klinik Kecantikan', whatsappNumber: '081234567849', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Palu Husada', city: 'Palu', province: 'Sulawesi Tengah', category: 'Klinik Pratama', whatsappNumber: '081234567850', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Kendari Dental', city: 'Kendari', province: 'Sulawesi Tenggara', category: 'Klinik Gigi', whatsappNumber: '081234567851', painPointNotes: '' },
  { clinicName: 'Apotek Jayapura Sehat', city: 'Jayapura', province: 'Papua', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567852', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Ambon Medika', city: 'Ambon', province: 'Maluku', category: 'Klinik Pratama', whatsappNumber: '081234567853', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Yogyakarta Ortho', city: 'Jogja', province: 'DI Yogyakarta', category: 'Klinik Gigi', whatsappNumber: '081234567854', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Semarang Aesthetic', city: 'Semarang', province: 'Jawa Tengah', category: 'Klinik Kecantikan', whatsappNumber: '081234567855', painPointNotes: '' },
  { clinicName: 'Apotek Surabaya Medika', city: 'Surabaya', province: 'Jawa Timur', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567856', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Bekasi Sehat', city: 'Bekasi', province: 'Jawa Barat', category: 'Klinik Pratama', whatsappNumber: '081234567857', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Jakarta Smile Studio', city: 'Jakarta', province: 'DKI Jakarta', category: 'Klinik Gigi', whatsappNumber: '081234567858', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Bandung Glow', city: 'Bandung', province: 'Jawa Barat', category: 'Klinik Kecantikan', whatsappNumber: '081234567859', painPointNotes: '' },
  { clinicName: 'Apotek Malang Sehat', city: 'Malang', province: 'Jawa Timur', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567860', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Denpasar Husada', city: 'Denpasar', province: 'Bali', category: 'Klinik Pratama', whatsappNumber: '081234567861', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Medan Orthodonti', city: 'Medan', province: 'Sumatera Utara', category: 'Klinik Gigi', whatsappNumber: '081234567862', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Surabaya Aesthetic', city: 'Surabaya', province: 'Jawa Timur', category: 'Klinik Kecantikan', whatsappNumber: '081234567863', painPointNotes: '' },
  { clinicName: 'Apotek Bandung Farma', city: 'Bandung', province: 'Jawa Barat', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567864', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Surabaya Medika', city: 'Surabaya', province: 'Jawa Timur', category: 'Klinik Pratama', whatsappNumber: '081234567865', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Semarang Smile', city: 'Semarang', province: 'Jawa Tengah', category: 'Klinik Gigi', whatsappNumber: '081234567866', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Makassar Glow', city: 'Makassar', province: 'Sulawesi Selatan', category: 'Klinik Kecantikan', whatsappNumber: '081234567867', painPointNotes: '' },
  { clinicName: 'Apotek Denpasar Medika', city: 'Denpasar', province: 'Bali', category: 'Apotek & Praktik Dokter', whatsappNumber: '081234567868', painPointNotes: '' },
  { clinicName: 'Klinik Pratama Jogja Sejahtera', city: 'Jogja', province: 'DI Yogyakarta', category: 'Klinik Pratama', whatsappNumber: '081234567869', painPointNotes: '' },
  { clinicName: 'Klinik Gigi Bekasi Dental', city: 'Bekasi', province: 'Jawa Barat', category: 'Klinik Gigi', whatsappNumber: '081234567870', painPointNotes: '' },
  { clinicName: 'Klinik Kecantikan Tangerang Glow', city: 'Tangerang', province: 'Banten', category: 'Klinik Kecantikan', whatsappNumber: '081234567871', painPointNotes: '' },
];

export function getCuratedA1Leads(limit: number = BATCH_TARGET_TOTAL): LeadTarget[] {
  return RAW_SEEDS.slice(0, limit).map((seed, index) =>
    toLeadTarget(
      {
        ...seed,
        painPointNotes: seed.painPointNotes || buildPainPointNotes(seed.category),
      },
      index
    )
  );
}

export const CURATED_A1_LEAD_COUNT = RAW_SEEDS.length;
