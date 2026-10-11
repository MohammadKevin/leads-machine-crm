export type LeadStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'in_queue'
  | 'sent'
  | 'failed'
  | 'skipped';

export type ClinicCategory =
  | 'Klinik Pratama'
  | 'Klinik Gigi'
  | 'Klinik Kecantikan'
  | 'Apotek & Praktik Dokter';

export interface LeadTarget {
  id: string;
  clinicName: string;
  city: string;
  province: string;
  category: ClinicCategory;
  whatsappNumber: string; // Format bersih: 628xxxxxxxxxx
  painPointNotes: string; // Detail kendala (jadwal dokter manual, belum ada web booking)
  tier: 'A1_PRIORITY'; // Wajib lolos kriteria A1
  generatedMessage?: string;
  status: LeadStatus;
  sentAt?: string;
  lastError?: string;
}

export interface OutreachStats {
  targetTotal: number; // 75
  sentCount: number; // 0 - 75
  failedCount: number;
  isRunning: boolean;
  activeTarget: LeadTarget | null;
  countdown: number;
}

export const BATCH_TARGET_TOTAL = 75;

export const OUTREACH_STORAGE_KEY = 'outreach_leads_75_batch';
