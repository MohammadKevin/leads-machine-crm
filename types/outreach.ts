/**
 * ==============================================================================
 * TYPE DEFINITIONS: LEADS OUTREACH & ANTI-DUPLICATION ENGINE
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

export type ClinicCategory =
  | 'Klinik Pratama'
  | 'Klinik Gigi'
  | 'Klinik Kecantikan'
  | 'Apotek & Praktik Dokter'
  | string;

export interface LeadTarget {
  id: string;
  clinicName: string;
  city: string;
  province: string;
  category: ClinicCategory;
  whatsappNumber: string;
  painPointNotes: string;
  tier: 'A1_PRIORITY';
  generatedMessage?: string;
  status: QueueLeadStatus;
  sentAt?: string;
  lastError?: string;
}

export const BATCH_TARGET_TOTAL = 75;
export const OUTREACH_STORAGE_KEY = 'outreach_leads_75_batch';

export type SheetResponseStatus =
  | 'CONTACTED'
  | 'INTERESTED'
  | 'IN_PROGRESS'
  | 'CLOSED_DEAL'
  | 'REJECTED';

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

/** Lengkap 38 Kota & Kabupaten se-Jawa Timur */
export const ALL_38_JAWA_TIMUR = [
  ...JATIM_KOTA,
  ...JATIM_KABUPATEN,
] as const;

/** Koridor Utama Pulau Jawa */
export const KORIDOR_UTAMA_JAWA = [
  'Solo',
  'Semarang',
  'Yogyakarta',
  'Bandung',
  'Jakarta',
  'Bekasi',
  'Tangerang',
  'Depok',
  'Bogor',
] as const;

export const DEFAULT_CITIES = ['Malang', 'Surabaya', 'Kediri', 'Sidoarjo'];

/** Seluruh opsi wilayah yang dapat dicari */
export const ALL_AVAILABLE_CITIES = [
  ...ALL_38_JAWA_TIMUR,
  ...KORIDOR_UTAMA_JAWA,
];

export const RESPONSE_STATUS_OPTIONS: Array<{
  value: SheetResponseStatus;
  label: string;
  color: string;
}> = [
  { value: 'CONTACTED', label: 'CONTACTED', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'INTERESTED', label: 'INTERESTED', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'CLOSED_DEAL', label: 'CLOSED DEAL', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'REJECTED', label: 'REJECTED', color: 'bg-rose-100 text-rose-800 border-rose-300' },
];
