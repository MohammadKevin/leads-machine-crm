import fs from 'fs';
import path from 'path';
import {
  LeadModel,
  PesanModel,
  PengaturanModel,
  LogPengirimanModel,
  StandardLeadStatus,
  SheetLeadRecord,
} from '@/types/outreach';
import { normalizeIndonesianPhone } from './defensive-client';

const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads_v4.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages_v4.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings_v4.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs_v4.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function maskPhoneNumber(phone: string): string {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 4)}****${clean.slice(-3)}`;
}

export function cleanBusinessName(rawName: string, category: string, city: string, phone: string): string {
  let name = (rawName || '').trim();
  if (!name || name.includes('+62') || name.startsWith('Prospek Bisnis') || name.startsWith('Layanan Bisnis')) {
    const loc = city || 'Jatim';
    if (category.toLowerCase().includes('kesehatan') || category.toLowerCase().includes('klinik') || category.toLowerCase().includes('medika')) {
      return `Layanan Medika (${loc})`;
    }
    if (category.toLowerCase().includes('roti') || category.toLowerCase().includes('hamper')) {
      return `Usaha Roti & Hampers (${loc})`;
    }
    if (category.toLowerCase().includes('interior') || category.toLowerCase().includes('mebel') || category.toLowerCase().includes('furniture')) {
      return `Mebel & Interior (${loc})`;
    }
    const lastDigits = phone.slice(-4);
    return `Klien Bisnis ${loc} · ${lastDigits}`;
  }
  return name;
}

export function mapSheetStatusToStandard(rawStatus: string): StandardLeadStatus {
  const s = (rawStatus || '').toUpperCase();
  if (s === 'CLOSED_DEAL' || s === 'CLOSING') return 'Closing';
  if (s === 'INTERESTED' || s === 'IN_PROGRESS' || s === 'HANGAT' || s === 'FOLLOWUP') return 'Hangat';
  if (s === 'REJECTED' || s === 'DITOLAK') return 'Ditolak';
  if (s === 'TIDAK_MERESPONS') return 'Tidak merespons';
  if (s === 'READY' || s === 'ANTRE') return 'Antre';
  return 'Terkirim';
}

export function mapStandardStatusToSheet(status: StandardLeadStatus): SheetLeadRecord['status'] {
  switch (status) {
    case 'Closing':
      return 'CLOSED_DEAL';
    case 'Hangat':
      return 'INTERESTED';
    case 'Ditolak':
      return 'REJECTED';
    case 'Antre':
      return 'CONTACTED';
    default:
      return 'CONTACTED';
  }
}

export const DEFAULT_SETTINGS: PengaturanModel = {
  target_nominal: 100_000_000,
  target_tanggal: '2028-10-30', // Sebelum usia 20 tahun
  target_label: 'Target Menuju Rp 100 Jt',
  batas_harian: 50,
  jeda_detik: 20,
  auto_followup_mode: 'manual', // Manusia di loop dulu
  fonnte_connected: true,
  last_webhook_at: undefined,
  webhook_count_24h: 0,
};

// ── Lead Store API ──

export function getLeads(): LeadModel[] {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeads(leads: LeadModel[]): void {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
}

export function getSettings(): PengaturanModel {
  ensureDataDir();
  if (!fs.existsSync(SETTINGS_FILE)) {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<PengaturanModel>): PengaturanModel {
  ensureDataDir();
  const current = getSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function getMessages(prospekId?: string): PesanModel[] {
  ensureDataDir();
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    const all: PesanModel[] = JSON.parse(raw);
    if (prospekId) {
      return all.filter((m) => m.prospek_id === prospekId);
    }
    return all;
  } catch {
    return [];
  }
}

export function addMessage(msg: Omit<PesanModel, 'id' | 'waktu'> & { waktu?: string }): PesanModel {
  ensureDataDir();
  const messages = getMessages();
  const newMsg: PesanModel = {
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    waktu: msg.waktu || new Date().toISOString(),
  };
  messages.unshift(newMsg);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages.slice(0, 5000), null, 2), 'utf-8');
  return newMsg;
}

export function addLog(log: Omit<LogPengirimanModel, 'id' | 'waktu'> & { waktu?: string }): void {
  ensureDataDir();
  let logs: LogPengirimanModel[] = [];
  if (fs.existsSync(LOGS_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch {}
  }
  const entry: LogPengirimanModel = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    waktu: log.waktu || new Date().toISOString(),
  };
  logs.unshift(entry);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 1000), null, 2), 'utf-8');
}

/**
 * Normalisasi & Dedup Data Prospek
 */
export function normalizeAndDedupLeads(rawList: Array<Record<string, any>>): {
  leads: LeadModel[];
  stats: { total: number; unique: number; merged: number; cleanedNames: number };
} {
  const map = new Map<string, LeadModel>();
  let cleanedNamesCount = 0;
  let mergedCount = 0;

  for (const item of rawList) {
    const rawPhone = String(item.phone_number || item.phone || item.nomor_wa || item.no_telepon || '');
    const cleanPhone = normalizeIndonesianPhone(String(item.normalized_phone || item.normalizedPhone || rawPhone));
    if (!cleanPhone || cleanPhone.length < 9) continue;

    const rawName = String(item.business_name || item.nama_bisnis || item.businessName || item.name || '');
    const category = String(item.category || item.kategori || 'Bisnis Lokal');
    const city = String(item.city || item.kota || 'Jawa Timur');
    const cleanedName = cleanBusinessName(rawName, category, city, cleanPhone);

    if (cleanedName !== rawName) {
      cleanedNamesCount++;
    }

    const status = mapSheetStatusToStandard(String(item.status || item.lead_status || item.status_lead || 'Terkirim'));
    const dibuatAt = item.timestamp || item.dibuat_at || new Date().toISOString();
    const diubahAt = item.lastSyncAt || item.diubah_at || dibuatAt;

    const existing = map.get(cleanPhone);
    if (existing) {
      mergedCount++;
      // Latest status or higher priority status wins
      const priorityOrder: Record<StandardLeadStatus, number> = {
        Closing: 5,
        Hangat: 4,
        Terkirim: 3,
        Antre: 2,
        'Tidak merespons': 1,
        Ditolak: 0,
      };
      if (priorityOrder[status] > priorityOrder[existing.status]) {
        existing.status = status;
      }
      if (!existing.catatan && item.messageSent) {
        existing.catatan = item.messageSent;
      }
      continue;
    }

    const lead: LeadModel = {
      id: item.id || `lead-${cleanPhone}`,
      nama_bisnis: cleanedName,
      kategori: category,
      kota: city,
      nomor_wa: cleanPhone,
      rating_maps: typeof item.rating === 'number' ? item.rating : item.rating_maps || 0,
      jumlah_ulasan: typeof item.reviewsCount === 'number' ? item.reviewsCount : item.jumlah_ulasan || 0,
      punya_website: Boolean(item.hasWebsite || item.punya_website || false),
      estimasi_nilai: item.estimasi_nilai || (category.toLowerCase().includes('villa') ? 3500000 : 2833333),
      status,
      tahap_followup: item.tahap_followup || 0,
      terkirim_at: item.terkirim_at || item.sentAt || (status === 'Terkirim' ? dibuatAt : undefined),
      jadwal_berikutnya_at: item.jadwal_berikutnya_at,
      balasan_at: item.balasan_at,
      balasan_terakhir: item.balasan_terakhir,
      jangan_hubungi: Boolean(item.jangan_hubungi || status === 'Ditolak'),
      template_id: item.template_id,
      variasi_id: item.variasi_id,
      saluran: item.saluran || 'WhatsApp Fonnte',
      catatan: item.messageSent || item.catatan || '',
      sumber: item.sumber || 'Google Maps',
      dibuat_at: dibuatAt,
      diubah_at: diubahAt,
    };

    map.set(cleanPhone, lead);
  }

  const leads = Array.from(map.values());
  return {
    leads,
    stats: {
      total: rawList.length,
      unique: leads.length,
      merged: mergedCount,
      cleanedNames: cleanedNamesCount,
    },
  };
}
