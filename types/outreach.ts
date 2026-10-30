/**
 * ==============================================================================
 * TYPE DEFINITIONS: LEADS OUTREACH & ANTI-DUPLICATION ENGINE (PRD v4)
 * ==============================================================================
 */

export type QueueLeadStatus =
  | 'pending'
  | 'ready'
  | 'generating'
  | 'in_queue'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';

export type LeadStatus = QueueLeadStatus;

export type StandardLeadStatus =
  | 'Antre'
  | 'Terkirim'
  | 'Hangat'
  | 'Closing'
  | 'Ditolak'
  | 'Tidak merespons';

export type SheetResponseStatus =
  | 'CONTACTED'
  | 'INTERESTED'
  | 'IN_PROGRESS'
  | 'CLOSED_DEAL'
  | 'REJECTED';

/**
 * 8.1 Model Data Prospek Standar (PRD v4)
 */
export interface LeadModel {
  id: string;
  nama_bisnis: string;
  kategori: string;
  kota: string;
  nomor_wa: string; // Ternormalisasi 628xxx, unik
  rating_maps?: number;
  jumlah_ulasan?: number;
  punya_website: boolean;
  estimasi_nilai?: number;
  status: StandardLeadStatus;
  tahap_followup: 0 | 1 | 2;
  terkirim_at?: string;
  jadwal_berikutnya_at?: string;
  balasan_at?: string;
  balasan_terakhir?: string;
  jangan_hubungi: boolean;
  template_id?: string;
  variasi_id?: string;
  saluran?: string;
  catatan?: string;
  sumber?: string;
  dibuat_at: string;
  diubah_at: string;
}

/**
 * Model Pesan Masuk & Keluar (PRD v4)
 */
export interface PesanModel {
  id: string;
  prospek_id: string;
  nomor_wa: string;
  arah: 'masuk' | 'keluar';
  isi: string;
  waktu: string;
  status: 'terkirim' | 'diterima' | 'gagal';
  tahap?: number;
}

/**
 * Model Pengaturan Global & Target (PRD v4)
 */
export interface PengaturanModel {
  target_nominal: number; // default: 100_000_000
  target_tanggal: string; // default: 2028-10-30 (sebelum usia 20)
  target_label: string; // default: "Misi Rp 100 Juta"
  batas_harian: number; // default: 50
  jeda_detik: number; // default: 20
  auto_followup_mode: 'manual' | 'auto'; // default: 'manual' (Manusia di loop)
  fonnte_connected?: boolean;
  last_webhook_at?: string;
  webhook_count_24h?: number;
}

/**
 * Model Log Pengiriman / Penerimaan
 */
export interface LogPengirimanModel {
  id: string;
  prospek_id?: string;
  nomor_disamarkan: string;
  arah: 'kirim' | 'terima';
  waktu: string;
  status: 'sukses' | 'gagal';
  alasan_gagal?: string;
  tahap?: number;
}

export interface OutreachLead {
  id: string;
  businessName: string;
  category: string;
  city: string;
  address: string;
  phone: string; // Format baku 628xxxxxxxxxx
  rawPhone: string;
  rating: number;
  reviewsCount: number;
  hasWebsite: boolean;
  website: string | null;
  status: QueueLeadStatus;
  pitchMessage?: string;
  sentAt?: string;
  error?: string;
  isBlacklisted?: boolean;
}

export interface SheetLeadRecord {
  id: string;
  timestamp?: string;
  businessName: string;
  category: string;
  city?: string;
  phone: string;
  normalizedPhone: string;
  mapsUrl?: string;
  rating: number;
  reviewsCount: number;
  hasWebsite: boolean;
  website: string | null;
  status: SheetResponseStatus;
  rejectionReason?: string | null;
  messageSent?: string;
  lastSyncAt?: string;
}

export interface OutreachMetrics {
  totalUniqueContacted: number;
  interestedCount: number;
  closingDealCount: number;
  inProgressCount: number;
  rejectedCount: number;
  lastSyncTimestamp?: string;
}

export interface BatchLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'skip' | 'success' | 'error' | 'warn';
  message: string;
  phone?: string;
  businessName?: string;
}

export interface SearchFilters {
  cities: string[];
  category: string;
  categories?: string[];
  onlyWithoutWebsite: boolean;
  excludeFranchise: boolean;
  onlyValidWhatsApp: boolean;
}

export const NICHE_CATEGORIES = [
  {
    id: 'klinik',
    label: 'Klinik & Apotek',
    description: 'Klinik Gigi, Medis Umum, Estetika/Kecantikan',
    query: 'Klinik Gigi Dokter Apotek Estetika Kecantikan',
  },
  {
    id: 'perusahaan',
    label: 'Perusahaan & Pabrik / Manufaktur',
    description: 'Distributor, Suplier, Logistik/Ekspedisi',
    query: 'Pabrik Manufaktur Distributor Suplier Logistik Ekspedisi Pergudangan',
  },
  {
    id: 'kontraktor',
    label: 'Kontraktor, Arsitek & Interior',
    description: 'Kontraktor, Desain Interior, Arsitektur',
    query: 'Kontraktor Bangunan Arsitek Desain Interior Konstruksi',
  },
  {
    id: 'bimbel',
    label: 'Bimbel, Kursus & Sekolah Swasta',
    description: 'Bimbel, Kursus Bahasa/Keahlian, Sekolah Swasta',
    query: 'Bimbel Kursus Bimbingan Belajar Les Sekolah Swasta',
  },
  {
    id: 'bengkel',
    label: 'Bengkel Mobil & Otomotif Spesialis',
    description: 'Servis Mobil, Otomotif, Carwash Spesialis',
    query: 'Bengkel Mobil Servis Otomotif Carwash Body Repair Variasi Mobil',
  },
  {
    id: 'kos',
    label: 'Kos-kosan Eksklusif, Homestay & Villa',
    description: 'Kos Eksklusif, Homestay, Villa & Guesthouse',
    query: 'Kos Eksklusif Kost Homestay Villa Guesthouse Penginapan',
  },
  {
    id: 'b2b',
    label: 'Jasa Profesional & B2B',
    description: 'Konsultan, Percetakan Offset, Vendor Event/WO',
    query: 'Konsultan Percetakan Offset Vendor Event Wedding Organizer MUA',
  },
] as const;

export const JATIM_KOTA = [
  'Malang',
  'Surabaya',
  'Batu',
  'Kediri',
  'Blitar',
  'Madiun',
  'Probolinggo',
  'Pasuruan',
  'Mojokerto',
] as const;

export const JATIM_KABUPATEN = [
  'Kabupaten Malang',
  'Sidoarjo',
  'Gresik',
  'Kabupaten Pasuruan',
  'Kabupaten Mojokerto',
  'Jombang',
  'Kabupaten Kediri',
  'Kabupaten Blitar',
  'Tulungagung',
  'Trenggalek',
  'Nganjuk',
  'Kabupaten Madiun',
  'Magetan',
  'Ngawi',
  'Bojonegoro',
  'Tuban',
  'Lamongan',
  'Kabupaten Probolinggo',
  'Lumajang',
  'Jember',
  'Bondowoso',
  'Situbondo',
  'Banyuwangi',
  'Bangkalan',
  'Sampang',
  'Pamekasan',
  'Sumenep',
  'Pacitan',
  'Ponorogo',
] as const;

export const ALL_38_JAWA_TIMUR = [
  ...JATIM_KOTA,
  ...JATIM_KABUPATEN,
] as const;

export const DEFAULT_CITIES = ['Malang', 'Surabaya', 'Kediri', 'Sidoarjo'];
