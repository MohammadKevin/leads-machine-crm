'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch, faPaperPlane, faDownload, faCheckCircle, faTimesCircle,
  faSync, faFileExcel, faBullseye, faMagic, faQuoteLeft, faBolt,
  faRobot, faClock, faBars, faTimes, faLock, faSignOutAlt,
  faLayerGroup, faExclamationTriangle, faExternalLinkSquare, faCopy,
  faMapMarkerAlt, faMessage, faShieldAlt, faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import {
  generateOutreachMessage,
  detectCategory,
  OutreachCategory,
  OUTREACH_CATEGORIES,
  sanitizeBusinessName,
} from '@/lib/template-generator';
import type { PlaceLead } from '@/app/api/places/route';
import {
  evaluateLeadQualification,
  LeadStatus,
  RejectionReason,
  PriorityScore,
} from '@/lib/lead-qualification';
import {
  normalizeWhatsAppNumber,
  isPhoneContacted,
} from '@/lib/phone-utils';
import { getRandomDelayMs } from '@/lib/whatsapp-queue';

type ActiveTab = 'search' | 'crm' | 'copilot' | 'templates' | 'export';
type OutreachStatus = 'new' | 'contacted' | 'followup' | 'closed' | 'rejected' | 'in_progress' | 'lost_franchise' | 'lost_rejected';
type CrmFilterStatus = 'all' | 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'INTERESTED' | 'IN_PROGRESS' | 'LOST_FRANCHISE' | 'LOST_REJECTED' | 'CLOSED';

interface LeadWithMeta extends PlaceLead {
  status: OutreachStatus;
  leadStatus: LeadStatus;
  selectedCategory: OutreachCategory;
  aiMessage?: string;
  generatedPitch?: string;
  customNotes?: string;
  addedAt?: string;
  lastSyncAt?: string;
  rejectionReason: RejectionReason;
  website?: string | null;
}

interface ContactedPhoneRecord {
  cleanPhone: string;
  contactedAt: string;
  businessName: string;
  status: OutreachStatus;
}

interface RemoteSheetRecord {
  business_name?: string;
  nama_bisnis?: string;
  name?: string;
  category?: string;
  kategori?: string;
  phone_number?: string;
  no_telepon?: string;
  phone?: string;
  normalized_phone?: string;
  normalizedPhone?: string;
  maps_url?: string;
  link_google_maps?: string;
  address?: string;
  rating?: number | string;
  review_count?: number | string;
  jumlah_ulasan?: number | string;
  website?: string | null;
  website_asli?: string | null;
  lead_status?: string;
  status_lead?: string;
  status?: string;
  rejection_reason?: RejectionReason;
  alasan_penolakan?: RejectionReason;
  rejectionReason?: RejectionReason;
  priority_score?: PriorityScore;
  priorityScore?: PriorityScore;
  generated_pitch?: string;
  draft_pitch_wa?: string;
  pitch?: string;
  last_sync_at?: string;
  terakhir_disinkron?: string;
  contactedAt?: string;
}

export interface RegionGroup {
  region: string;
  cities: string[];
}

export const INDONESIA_REGIONS: RegionGroup[] = [
  { region: 'Jawa Timur', cities: ['Malang', 'Surabaya', 'Sidoarjo', 'Kediri', 'Jember', 'Batu', 'Madiun'] },
  { region: 'Jabodetabek & Jabar', cities: ['Jakarta', 'Bandung', 'Bekasi', 'Tangerang', 'Depok', 'Bogor', 'Cirebon'] },
  { region: 'Jawa Tengah & DIY', cities: ['Semarang', 'Solo', 'Jogja', 'Purwokerto', 'Magelang', 'Kudus', 'Tegal'] },
  { region: 'Sumatera', cities: ['Medan', 'Palembang', 'Pekanbaru', 'Batam', 'Padang', 'Lampung', 'Banda Aceh'] },
  { region: 'Bali & Nusa Tenggara', cities: ['Denpasar', 'Badung', 'Mataram', 'Kupang'] },
  { region: 'Kalimantan', cities: ['Samarinda', 'Balikpapan', 'Banjarmasin', 'Pontianak'] },
  { region: 'Sulawesi & Timur', cities: ['Makassar', 'Manado', 'Palu', 'Kendari', 'Jayapura', 'Ambon'] },
];

export const GLOBAL_REGIONS: RegionGroup[] = [
  { region: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Edinburgh', 'Glasgow'] },
  { region: 'Europe (DE, FR, NL)', cities: ['Berlin', 'Munich', 'Paris', 'Amsterdam', 'Rotterdam', 'Dublin', 'Frankfurt'] },
  { region: 'United States & Canada', cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Toronto', 'Vancouver'] },
  { region: 'Australia & APAC', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Singapore', 'Auckland'] },
  { region: 'Middle East', cities: ['Dubai', 'Abu Dhabi', 'Doha', 'Riyadh'] },
];

export const PRESET_CATEGORIES = [
  { label: 'Semua Kategori', query: 'ALL' },
  { label: 'Kos-Kosan & Homestay', query: 'Kos Kosan Homestay' },
  { label: 'Bimbel & Kursus Les', query: 'Bimbel Kursus Bimbingan Belajar' },
  { label: 'Klinik Dokter Gigi & Medis', query: 'Klinik Dokter Gigi' },
  { label: 'Wedding Organizer & MUA', query: 'Wedding Organizer MUA' },
  { label: 'Kontraktor & Arsitek', query: 'Kontraktor Arsitek Desain Interior' },
  { label: 'Konveksi & Percetakan', query: 'Konveksi Sablon Percetakan' },
  { label: 'Rental Mobil & Motor', query: 'Rental Mobil Persewaan Motor' },
  { label: 'Cafe & Resto Kuliner', query: 'Cafe Resto Kuliner Kedai' },
  { label: 'Bengkel & Cuci Mobil', query: 'Bengkel Mobil Carwash Motor' },
];

export const GLOBAL_PRESET_CATEGORIES = [
  { label: 'All Global Categories', query: 'ALL' },
  { label: 'Emergency Plumbers & Heating', query: 'Plumber Heating Emergency' },
  { label: 'Dental & Orthodontic Clinics', query: 'Dentist Dental Clinic' },
  { label: 'Roofing & Solar Contractors', query: 'Roofing Solar Contractor' },
  { label: 'Electricians & Smart Home', query: 'Electrician Contractor' },
  { label: 'Auto Detailing & Ceramic Coating', query: 'Auto Detailing Ceramic' },
  { label: 'Artisan Bakery & Specialty Cafe', query: 'Artisan Bakery Cafe' },
  { label: 'Law Firms & Solicitors', query: 'Law Firm Solicitor' },
  { label: 'Landscaping & Tree Surgery', query: 'Landscaping Garden Tree' },
  { label: 'Veterinary Clinics', query: 'Veterinary Clinic Vet' },
];

export const RECOMMENDATIONS = [
  { id: 'kos-malang', title: 'Kos Mahasiswa & Homestay', city: 'Malang', query: 'Kos Kosan di Malang', category: 'kos', categoryName: 'Properti & Hunian', tag: 'Tinggi Mahasiswa', opportunityBadge: 'Katalog Kamar & KTP', description: 'Pemilik kos butuh alur booking online aman dengan upload KTP penyewa dan auto-reminder tagihan WA.' },
  { id: 'konveksi-surabaya', title: 'Konveksi & Sablon Kaos', city: 'Surabaya', query: 'Konveksi Kaos di Surabaya', category: 'umkm', categoryName: 'Industri Kreatif', tag: 'Pusat Bisnis', opportunityBadge: 'Katalog Visual WA', description: 'Konveksi butuh katalog visual instan dan daftar harga.' },
  { id: 'wedding-solo', title: 'Wedding Organizer & MUA', city: 'Solo', query: 'Wedding Organizer di Solo', category: 'wedding', categoryName: 'Jasa Pernikahan', tag: 'Portofolio Mewah', opportunityBadge: 'Showcase Portofolio', description: 'WO butuh galeri foto/video HD dan rincian paket pricelist.' },
  { id: 'klinik-jogja', title: 'Klinik Dokter Gigi & Estetika', city: 'Jogja', query: 'Klinik Dokter Gigi di Jogja', category: 'jasa', categoryName: 'Kesehatan & Medis', tag: 'Tinggi Kepercayaan', opportunityBadge: 'Profil & Jadwal Dokter', description: 'Klinik butuh landing page resmi dengan jadwal praktek.' },
  { id: 'rental-bandung', title: 'Rental Mobil & Sewa Motor', city: 'Bandung', query: 'Rental Mobil di Bandung', category: 'rental', categoryName: 'Pariwisata & Transportasi', tag: 'Wisata Ramai', opportunityBadge: 'Katalog Armada & Jadwal', description: 'Rental butuh katalog unit kendaraan live dengan tarif harian.' },
  { id: 'arsitek-semarang', title: 'Kontraktor & Desain Interior', city: 'Semarang', query: 'Kontraktor Bangun Rumah di Semarang', category: 'properti', categoryName: 'Properti & Konstruksi', tag: 'Tiket Proyek Besar', opportunityBadge: 'Portofolio & Estimasi RAB', description: 'Kontraktor butuh galeri proyek Before & After.' },
];

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  NEW: { label: 'NEW', bg: 'bg-amber-50 text-amber-800', text: 'text-amber-800', border: 'border-amber-200', icon: faMagic },
  QUALIFIED: { label: 'QUALIFIED', bg: 'bg-sky-50 text-sky-800', text: 'text-sky-800', border: 'border-sky-200', icon: faBullseye },
  CONTACTED: { label: 'CONTACTED', bg: 'bg-emerald-50 text-emerald-800', text: 'text-emerald-800', border: 'border-emerald-200', icon: faPaperPlane },
  INTERESTED: { label: 'INTERESTED', bg: 'bg-indigo-50 text-indigo-800', text: 'text-indigo-800', border: 'border-indigo-200', icon: faBolt },
  LOST_FRANCHISE: { label: 'LOST_FRANCHISE', bg: 'bg-rose-50 text-rose-800', text: 'text-rose-800', border: 'border-rose-200', icon: faTimesCircle },
  CLOSED: { label: 'CLOSED', bg: 'bg-purple-50 text-purple-800', text: 'text-purple-800', border: 'border-purple-200', icon: faCheckCircle },
  IN_PROGRESS: { label: 'IN_PROGRESS', bg: 'bg-cyan-50 text-cyan-800', text: 'text-cyan-800', border: 'border-cyan-200', icon: faClock },
  LOST_REJECTED: { label: 'LOST_REJECTED', bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', border: 'border-slate-300', icon: faTimesCircle },
};

const cleanBizName = (name: string) => sanitizeBusinessName(name);

function validatePitchMessage(message: string, businessName: string): string {
  if (!message || message.length < 40) {
    return generateOutreachMessage({ businessName, category: 'general' });
  }
  return message.replace(/\n{3,}/g, '\n\n').trim();
}

export default function LeadFinderApp() {
  const hasMounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInputs, setPinInputs] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const [isAppLoading, setIsAppLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [marketMode, setMarketMode] = useState<'indo' | 'global'>('indo');

  const [query, setQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Malang');
  const [selectedCities, setSelectedCities] = useState<string[]>(['Malang']);
  const [selectedCategoryPreset, setSelectedCategoryPreset] = useState(PRESET_CATEGORIES[1].query);
  const [filterNoWebsiteOnly, setFilterNoWebsiteOnly] = useState(false);
  const [filterValidWaOnly, setFilterValidWaOnly] = useState(false);
  const [filterIdealOnly, setFilterIdealOnly] = useState(false);
  const [excludeFranchiseToggle, setExcludeFranchiseToggle] = useState(true);
  const [minRatingFilter] = useState<number>(0);

  const [phoneRegistry, setPhoneRegistry] = useState<Record<string, ContactedPhoneRecord>>({});

  const [googleSheetsUrl] = useState(() => process.env.NEXT_PUBLIC_LEADS_SHEET_API || '');
  const [serpApiKey] = useState(process.env.SERPAPI_API_KEY || '');
  const [geminiApiKey] = useState(process.env.GEMINI_API_KEY || '');
  const [fonnteToken] = useState(process.env.FONNTE_TOKEN || '');
  const [senderName] = useState(process.env.SENDER_NAME || 'Mohammad Kevin');
  const [senderRole] = useState(process.env.SENDER_ROLE || 'freelance web developer');

  const [isLoading, setIsLoading] = useState(false);
  const [, setGeneratingAiId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [leads, setLeads] = useState<LeadWithMeta[]>([]);
  const [savedStatuses, setSavedStatuses] = useState<Record<string, OutreachStatus>>({});
  const [savedLeadsCrm, setSavedLeadsCrm] = useState<LeadWithMeta[]>([]);

  const [crmStatusFilter, setCrmStatusFilter] = useState<CrmFilterStatus>('all');
  const [isSyncingCrm, setIsSyncingCrm] = useState(false);

  const [copilotIncomingMessage, setCopilotIncomingMessage] = useState('');
  const [copilotClientName, setCopilotClientName] = useState('');
  const [copilotCategory, setCopilotCategory] = useState<OutreachCategory>('general');
  const [copilotPhone, setCopilotPhone] = useState('');
  const [copilotGeneratedReply, setCopilotGeneratedReply] = useState('');
  const [copilotIntent, setCopilotIntent] = useState<string | null>(null);
  const [isGeneratingCopilot, setIsGeneratingCopilot] = useState(false);
  const [isSendingCopilot, setIsSendingCopilot] = useState(false);

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentDelay?: number } | null>(null);

  const [existingCrmPhones, setExistingCrmPhones] = useState<Set<string>>(new Set());

  // ---------- PITCH MODAL ----------
  const [pitchModalLead, setPitchModalLead] = useState<LeadWithMeta | null>(null);
  const [pitchModalLoading, setPitchModalLoading] = useState(false);
  const [pitchModalMessage, setPitchModalMessage] = useState('');
  const [pitchModalError, setPitchModalError] = useState('');
  const [, setPitchModalLeadId] = useState<string | null>(null);

  const handlePinInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pinInputs];
    newPin[index] = value;
    setPinInputs(newPin);
    setPinError(false);
    if (value && index < 3) pinInputRefs[index + 1].current?.focus();
    const currentPin = newPin.join('');
    if (currentPin.length === 4) {
      if (currentPin === '1992') {
        sessionStorage.setItem('leadfinder_auth_pin', '1992');
        setIsAppLoading(true);
        setIsAuthenticated(true);
        setTimeout(() => setIsAppLoading(false), 400);
      } else {
        setPinError(true);
        setTimeout(() => setPinInputs(['', '', '', '']), 500);
        pinInputRefs[0].current?.focus();
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinInputs[index] && index > 0) pinInputRefs[index - 1].current?.focus();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('leadfinder_auth_pin');
    setPinInputs(['', '', '', '']);
    setIsAuthenticated(false);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    try {
      const pin = sessionStorage.getItem('leadfinder_auth_pin');
      if (pin === '1992') setIsAuthenticated(true);
      const storedRegistry = localStorage.getItem('lead_phone_registry');
      if (storedRegistry) setPhoneRegistry(JSON.parse(storedRegistry));
      const storedCrm = localStorage.getItem('lead_saved_crm_records');
      if (storedCrm) setSavedLeadsCrm(JSON.parse(storedCrm));
    } catch {}
  }, []);

  const mapRemoteRecordToLead = (record: RemoteSheetRecord, idx: number): LeadWithMeta => {
    const name = record.business_name || record.nama_bisnis || record.name || `Prospek ${idx + 1}`;
    const rawPhone = record.phone_number || record.no_telepon || record.phone || '';
    const clean = normalizeWhatsAppNumber(record.normalized_phone || record.normalizedPhone || rawPhone);
    const rawStatus = (record.lead_status || record.status_lead || record.status || 'QUALIFIED').toUpperCase();

    let statusUpper: LeadStatus = 'QUALIFIED';
    let statusResolved: OutreachStatus = 'new';

    if (rawStatus === 'CONTACTED' || rawStatus === 'SENT' || rawStatus === 'SUDAH' || rawStatus === 'SUDAH DI-CHAT') {
      statusUpper = 'CONTACTED'; statusResolved = 'contacted';
    } else if (rawStatus === 'INTERESTED' || rawStatus === 'FOLLOWUP' || rawStatus === 'PERLU FOLLOW-UP') {
      statusUpper = 'INTERESTED'; statusResolved = 'followup';
    } else if (rawStatus === 'CLOSED' || rawStatus === 'DEAL' || rawStatus === 'DEAL / SELESAI') {
      statusUpper = 'CLOSED'; statusResolved = 'closed';
    } else if (rawStatus === 'IN_PROGRESS') {
      statusUpper = 'IN_PROGRESS'; statusResolved = 'in_progress';
    } else if (rawStatus === 'LOST_REJECTED') {
      statusUpper = 'LOST_REJECTED'; statusResolved = 'lost_rejected';
    } else if (rawStatus === 'LOST_FRANCHISE' || rawStatus === 'DITOLAK' || rawStatus === 'REJECTED' || rawStatus === 'UNQUALIFIED_FRANCHISE' || rawStatus === 'UNQUALIFIED_CORPORATE') {
      statusUpper = rawStatus === 'UNQUALIFIED_CORPORATE' ? 'UNQUALIFIED_CORPORATE' : 'LOST_FRANCHISE';
      statusResolved = 'rejected';
    } else if (rawStatus === 'NEW') {
      statusUpper = 'NEW'; statusResolved = 'new';
    }

    const website = record.website || record.website_asli || null;
    const rating = Number(record.rating || 0);
    const reviewCount = Number(record.review_count || record.jumlah_ulasan || 0);
    const qual = evaluateLeadQualification({ name, website, rating, reviewCount });

    return {
      id: `sheet-${clean || idx}`,
      name,
      formattedAddress: record.maps_url || record.link_google_maps || record.address || 'Alamat Google Maps',
      nationalPhoneNumber: rawPhone || clean,
      internationalPhoneNumber: rawPhone || clean,
      websiteUri: website,
      website,
      hasWebsite: Boolean(website && website.trim().length > 0),
      rating,
      userRatingCount: reviewCount,
      types: [],
      primaryType: record.category || record.kategori || 'business',
      phoneAnalysis: { raw: rawPhone, cleaned: clean, isValid: Boolean(clean), isMobile: true, type: 'mobile', formattedDisplay: rawPhone || clean },
      qualification: qual,
      priorityScore: (record.priority_score || record.priorityScore || qual.priorityScore) as PriorityScore,
      leadStatus: statusUpper,
      rejectionReason: record.rejection_reason || record.alasan_penolakan || record.rejectionReason || null,
      isIdealTarget: qual.isIdealTarget,
      status: statusResolved,
      selectedCategory: ((record.category || record.kategori) as OutreachCategory) || 'general',
      aiMessage: record.generated_pitch || record.draft_pitch_wa || record.pitch || '',
      generatedPitch: record.generated_pitch || record.draft_pitch_wa || record.pitch || '',
      lastSyncAt: record.last_sync_at || record.terakhir_disinkron || record.contactedAt || '',
      addedAt: record.last_sync_at || record.terakhir_disinkron || record.contactedAt || new Date().toLocaleDateString('id-ID'),
    };
  };

  const syncCrmFromSheet = async () => {
    setIsSyncingCrm(true);
    try {
      const res = await fetch(`/api/sheets${googleSheetsUrl ? `?sheetUrl=${encodeURIComponent(googleSheetsUrl)}` : ''}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const nextRegistry: Record<string, ContactedPhoneRecord> = {};
        if (Array.isArray(data.contactedNumbers)) {
          data.contactedNumbers.forEach((p: string) => {
            nextRegistry[p] = { cleanPhone: p, contactedAt: new Date().toISOString(), businessName: 'Database Google Sheets', status: 'contacted' };
          });
        }
        setPhoneRegistry(nextRegistry);
        try { localStorage.setItem('lead_phone_registry', JSON.stringify(nextRegistry)); } catch {}

        if (Array.isArray(data.remoteRecords)) {
          const sheetLeads: LeadWithMeta[] = data.remoteRecords.map((record: RemoteSheetRecord, idx: number) => mapRemoteRecordToLead(record, idx));
          setSavedLeadsCrm(sheetLeads);
          const phoneSet = new Set<string>();
          sheetLeads.forEach((l) => { const p = l.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(l.nationalPhoneNumber); if (p) phoneSet.add(p); });
          setExistingCrmPhones(phoneSet);
          try { localStorage.setItem('lead_saved_crm_records', JSON.stringify(sheetLeads)); } catch {}
          showToast('success', `Berhasil memuat ${sheetLeads.length} data dari Google Sheets.`);
        }
      } else {
        showToast('error', data.error || 'Gagal tersambung ke Google Sheets.');
      }
    } catch { showToast('error', 'Gagal sinkronisasi.'); }
    finally { setIsSyncingCrm(false); }
  };

  const resetCacheAndSyncSheet = async () => {
    try {
      localStorage.removeItem('lead_saved_crm_records');
      localStorage.removeItem('lead_phone_registry');
      localStorage.removeItem('lead_outreach_statuses');
      setSavedLeadsCrm([]);
      setPhoneRegistry({});
      setSavedStatuses({});
    } catch {}
    await syncCrmFromSheet();
  };

  useEffect(() => {
    let isMounted = true;
    const initialSync = async () => {
      try {
        const res = await fetch(`/api/sheets${googleSheetsUrl ? `?sheetUrl=${encodeURIComponent(googleSheetsUrl)}` : ''}`);
        const data = await res.json();
        if (isMounted && res.ok && data.success) {
          const nextRegistry: Record<string, ContactedPhoneRecord> = {};
          if (Array.isArray(data.contactedNumbers)) {
            data.contactedNumbers.forEach((p: string) => { nextRegistry[p] = { cleanPhone: p, contactedAt: new Date().toISOString(), businessName: 'Database Google Sheets', status: 'contacted' }; });
          }
          setPhoneRegistry(nextRegistry);
          try { localStorage.setItem('lead_phone_registry', JSON.stringify(nextRegistry)); } catch {}
          if (Array.isArray(data.remoteRecords)) {
            const sheetLeads: LeadWithMeta[] = data.remoteRecords.map((record: RemoteSheetRecord, idx: number) => mapRemoteRecordToLead(record, idx));
            setSavedLeadsCrm(sheetLeads);
            const phoneSet = new Set<string>();
            sheetLeads.forEach((l) => { const p = l.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(l.nationalPhoneNumber); if (p) phoneSet.add(p); });
            setExistingCrmPhones(phoneSet);
            try { localStorage.setItem('lead_saved_crm_records', JSON.stringify(sheetLeads)); } catch {}
          }
        }
      } catch {}
    };
    initialSync();
    return () => { isMounted = false; };
  }, [googleSheetsUrl]);

  const updateLeadStatus = (placeId: string, newStatus: string, rejectionReason?: RejectionReason) => {
    const statusUpper = newStatus.toUpperCase() as LeadStatus;
    const outreachMapped: OutreachStatus = statusUpper === 'CONTACTED' ? 'contacted' : statusUpper === 'INTERESTED' ? 'followup' : statusUpper === 'CLOSED' ? 'closed' : statusUpper === 'LOST_FRANCHISE' || statusUpper === 'UNQUALIFIED_FRANCHISE' || statusUpper === 'UNQUALIFIED_CORPORATE' ? 'rejected' : 'new';

    const updatedStatuses = { ...savedStatuses, [placeId]: outreachMapped };
    setSavedStatuses(updatedStatuses);
    try { localStorage.setItem('lead_outreach_statuses', JSON.stringify(updatedStatuses)); } catch {}

    let targetLeadToSync: LeadWithMeta | null = null;
    setSavedLeadsCrm((prev) => {
      const updated = prev.map((l) => {
        if (l.id === placeId) {
          const updatedLead: LeadWithMeta = { ...l, leadStatus: statusUpper, status: outreachMapped, rejectionReason: rejectionReason !== undefined ? rejectionReason : (statusUpper === 'LOST_FRANCHISE' ? 'Franchise' : l.rejectionReason), lastSyncAt: new Date().toISOString() };
          targetLeadToSync = updatedLead;
          return updatedLead;
        }
        return l;
      });
      try { localStorage.setItem('lead_saved_crm_records', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setLeads((prev) => prev.map((lead) => { if (lead.id === placeId) { const updated = { ...lead, leadStatus: statusUpper, status: outreachMapped, rejectionReason: rejectionReason !== undefined ? rejectionReason : lead.rejectionReason }; if (!targetLeadToSync) targetLeadToSync = updated; return updated; } return lead; }));

    if (targetLeadToSync) {
      const l: LeadWithMeta = targetLeadToSync;
      const cleanPhone = l.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(l.nationalPhoneNumber);
      fetch('/api/sheets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: l.nationalPhoneNumber || cleanPhone, normalizedPhone: cleanPhone, business_name: l.name,
          category: l.selectedCategory || 'general', maps_url: l.formattedAddress || '', rating: l.rating || 0,
          review_count: l.userRatingCount || 0, website: l.websiteUri || l.website || null,
          lead_status: statusUpper, rejection_reason: l.rejectionReason || null,
          generated_pitch: l.generatedPitch || l.aiMessage || '', last_sync_at: new Date().toISOString(),
          sheetUrl: googleSheetsUrl || undefined,
        }),
      }).catch(() => {});
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const citiesToSearch = selectedCities.length > 0 ? selectedCities : [selectedCity];
    const isAllCategories = selectedCategoryPreset === 'ALL';
    const hasKeyword = Boolean(query.trim());

    if (!isAllCategories && !hasKeyword) {
      showToast('error', 'Isi kata kunci atau pilih kategori terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const fallbackKeyword = 'bisnis';
    let allPlaces: PlaceLead[] = [];
    let totalFranchiseBlocked = 0;
    let errors: string[] = [];

    for (let ci = 0; ci < citiesToSearch.length; ci++) {
      const city = citiesToSearch[ci];
      const keyword = query.trim() || (isAllCategories ? fallbackKeyword : selectedCategoryPreset);
      const finalQuery = `${keyword} di ${city}`;
      setBatchProgress({ current: ci + 1, total: citiesToSearch.length });

      try {
        const res = await fetch('/api/places', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: finalQuery, apiKey: serpApiKey || undefined, marketMode, excludeFranchise: excludeFranchiseToggle }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.places)) {
          allPlaces.push(...data.places);
          totalFranchiseBlocked += data.excludedFranchiseCount || 0;
        } else if (!res.ok) {
          errors.push(`${city}: ${data.error || 'Gagal'}`);
        }
      } catch {
        errors.push(`${city}: Network error`);
      }

      if (ci < citiesToSearch.length - 1) await new Promise((r) => setTimeout(r, 800));
    }

    setBatchProgress(null);

    if (allPlaces.length === 0) {
      setErrorMessage(errors.length > 0 ? `Gagal mencari: ${errors.join('; ')}` : 'Tidak ada hasil ditemukan.');
      setIsLoading(false);
      return;
    }

    // Deduplicate across all cities + existing CRM
    const seenPhones = new Set<string>();
    const dedupedPlaces = allPlaces.filter((place) => {
      const p = place.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(place.nationalPhoneNumber);
      if (!p) return true;
      if (seenPhones.has(p)) return false;
      if (existingCrmPhones.has(p)) return false;
      if (leads.some((l) => l.phoneAnalysis?.cleaned === p)) return false;
      seenPhones.add(p);
      return true;
    });

    const dupCount = allPlaces.length - dedupedPlaces.length;
    if (dupCount > 0) showToast('success', `${dupCount} prospek duplikat dilewati.`);

    const enhanced: LeadWithMeta[] = dedupedPlaces.map((place: PlaceLead) => {
      const detectedCat = detectCategory(place.name, place.formattedAddress);
      const currentStatus: OutreachStatus = isPhoneContacted(place.phoneAnalysis?.cleaned, phoneRegistry) ? 'contacted' : 'new';
      return { ...place, status: currentStatus, leadStatus: place.leadStatus || 'QUALIFIED', selectedCategory: detectedCat, rejectionReason: place.rejectionReason || null };
    });

    setLeads(enhanced);
    const cityLabel = citiesToSearch.length > 1 ? `${citiesToSearch.length} kota` : citiesToSearch[0];
    showToast('success', `Menemukan ${enhanced.length} prospek dari ${cityLabel} (${totalFranchiseBlocked} franchise diblokir).`);
    setIsLoading(false);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      if (filterNoWebsiteOnly && item.hasWebsite) return false;
      if (filterValidWaOnly && (!item.phoneAnalysis.isValid || !item.phoneAnalysis.isMobile)) return false;
      if (filterIdealOnly && !item.isIdealTarget) return false;
      if (minRatingFilter > 0 && item.rating < minRatingFilter) return false;
      return true;
    });
  }, [leads, filterNoWebsiteOnly, filterValidWaOnly, filterIdealOnly, minRatingFilter]);

  const handleOpenWhatsAppManual = (lead: LeadWithMeta) => {
    const cleanP = lead.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(lead.nationalPhoneNumber);
    if (!cleanP) return;
    const pitch = validatePitchMessage(lead.generatedPitch || lead.aiMessage || '', cleanBizName(lead.name));
    updateLeadStatus(lead.id, 'CONTACTED');
    window.open(`https://wa.me/${cleanP}?text=${encodeURIComponent(pitch)}`, '_blank');
  };

  const handleOpenPitchModal = (lead: LeadWithMeta) => {
    const leadId = lead.id;

    const fallbackMsg = generateOutreachMessage({
      businessName: cleanBizName(lead.name),
      category: lead.selectedCategory,
      senderName,
      senderRole,
      rating: lead.rating,
      userRatingCount: lead.userRatingCount,
      address: lead.formattedAddress,
    });

    setPitchModalLead(lead);
    setPitchModalLeadId(leadId);
    setPitchModalMessage(fallbackMsg);
    setPitchModalError('');
    setPitchModalLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch('/api/generate-pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: cleanBizName(lead.name),
        category: lead.selectedCategory,
        address: lead.formattedAddress,
        rating: lead.rating,
        userRatingCount: lead.userRatingCount,
        senderName,
        senderRole,
        marketMode,
        geminiKey: geminiApiKey || undefined,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        clearTimeout(timeoutId);
        if (data.success && data.message) {
          setPitchModalLeadId((currentLeadId) => {
            if (currentLeadId !== leadId) return currentLeadId;
            setPitchModalMessage((currentMsg) => {
              if (currentMsg === fallbackMsg) return data.message;
              return currentMsg;
            });
            return currentLeadId;
          });
        } else {
          setPitchModalLeadId((currentLeadId) => {
            if (currentLeadId !== leadId) return currentLeadId;
            setPitchModalError('AI gagal menghasilkan pesan, template otomatis digunakan.');
            return currentLeadId;
          });
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        setPitchModalLeadId((currentLeadId) => {
          if (currentLeadId !== leadId) return currentLeadId;
          setPitchModalError('Koneksi terputus atau timeout, template otomatis digunakan.');
          return currentLeadId;
        });
      })
      .finally(() => {
        setPitchModalLoading(false);
      });
  };

  const handlePitchModalSendWa = () => {
    if (!pitchModalLead || !pitchModalMessage.trim()) return;
    const rawPhone = pitchModalLead.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(pitchModalLead.nationalPhoneNumber);
    if (!rawPhone) return;
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const cleanP = digitsOnly.startsWith('0') ? '62' + digitsOnly.slice(1) : digitsOnly.startsWith('62') ? digitsOnly : '62' + digitsOnly;
    const waUrl = `https://wa.me/${cleanP}?text=${encodeURIComponent(pitchModalMessage.trim())}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    updateLeadStatus(pitchModalLead.id, 'CONTACTED');
    setPitchModalLead(null);
  };

  const handleGenerateAiPitch = async (lead: LeadWithMeta) => {
    setGeneratingAiId(lead.id);
    try {
      const res = await fetch('/api/generate-pitch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: cleanBizName(lead.name), category: lead.selectedCategory, address: lead.formattedAddress, rating: lead.rating, userRatingCount: lead.userRatingCount, senderName, senderRole, marketMode, geminiKey: geminiApiKey || undefined }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, generatedPitch: data.message, aiMessage: data.message } : l)));
        showToast('success', `Draf pitch AI untuk "${lead.name}" selesai.`);
      }
    } catch { showToast('error', 'Gagal membuat pitch AI.'); }
    finally { setGeneratingAiId(null); }
  };

  const handleSendSingleWhatsApp = async (lead: LeadWithMeta) => {
    const cleanP = lead.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(lead.nationalPhoneNumber);
    if (!cleanP) return;
    const message = validatePitchMessage(lead.generatedPitch || lead.aiMessage || '', cleanBizName(lead.name));
    try {
      const res = await fetch('/api/send-wa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: cleanP, message, token: fonnteToken || undefined }) });
      const data = await res.json();
      if (res.ok && data.success) {
        updateLeadStatus(lead.id, 'CONTACTED');
        showToast('success', `Pesan terkirim ke ${lead.name} (${cleanP}).`);
      } else {
        showToast('error', data.error || 'Gagal mengirim.');
      }
    } catch {
      showToast('error', 'Kesalahan jaringan.');
    }
  };

  const handleBatchGenerateAi = async () => {
    const targetLeads = leads.filter((l) => selectedLeadIds.includes(l.id));
    if (targetLeads.length === 0) return;
    setIsBatchGenerating(true);
    let done = 0;
    for (const lead of targetLeads) {
      setBatchProgress({ current: done + 1, total: targetLeads.length });
      await handleGenerateAiPitch(lead);
      done++;
    }
    setIsBatchGenerating(false);
    setBatchProgress(null);
    showToast('success', `Selesai ${done} draf pitch AI.`);
  };

  const handleBatchSendWhatsApp = async () => {
    const targetLeads = leads.filter((l) => selectedLeadIds.includes(l.id) && l.phoneAnalysis.isValid && l.phoneAnalysis.isMobile);
    if (targetLeads.length === 0) return;
    setIsBatchSending(true);
    for (let i = 0; i < targetLeads.length; i++) {
      const lead = targetLeads[i];
      const randomDelay = i === 0 ? 0 : getRandomDelayMs(45, 120);
      setBatchProgress({ current: i + 1, total: targetLeads.length, currentDelay: Math.round(randomDelay / 1000) });
      if (randomDelay > 0) await new Promise((r) => setTimeout(r, randomDelay));
      await handleSendSingleWhatsApp(lead);
    }
    setIsBatchSending(false);
    setBatchProgress(null);
    setSelectedLeadIds([]);
    showToast('success', 'Pengiriman batch selesai.');
  };

  const handleGenerateCopilotReply = async () => {
    if (!copilotIncomingMessage.trim()) return;
    setIsGeneratingCopilot(true);
    try {
      const res = await fetch('/api/ai-reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incomingMessage: copilotIncomingMessage, businessName: copilotClientName || 'Klien', category: copilotCategory, senderName, senderRole, geminiKey: geminiApiKey || undefined }),
      });
      const data = await res.json();
      if (data.success) { setCopilotGeneratedReply(data.reply); setCopilotIntent(data.intent || null); showToast('success', 'Balasan AI berhasil dibuat.'); }
    } catch { showToast('error', 'Gagal membuat balasan AI.'); }
    finally { setIsGeneratingCopilot(false); }
  };

  const handleSendCopilotReply = async () => {
    const cleanPhone = normalizeWhatsAppNumber(copilotPhone);
    if (!cleanPhone || !copilotGeneratedReply) { showToast('error', 'Nomor atau draf kosong.'); return; }
    setIsSendingCopilot(true);
    try {
      const res = await fetch('/api/send-wa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: cleanPhone, message: copilotGeneratedReply, token: fonnteToken || undefined }) });
      const data = await res.json();
      if (res.ok && data.success) { showToast('success', `Balasan terkirim ke ${cleanPhone}!`); setCopilotIncomingMessage(''); setCopilotGeneratedReply(''); }
      else { showToast('error', data.error || 'Gagal mengirim.'); }
    } catch { showToast('error', 'Kesalahan jaringan.'); }
    finally { setIsSendingCopilot(false); }
  };

  const handleDownloadCsv = () => {
    const listToExport = activeTab === 'crm' ? savedLeadsCrm : filteredLeads;
    if (listToExport.length === 0) { showToast('error', 'Tidak ada data.'); return; }
    const headers = ['Nama_Bisnis', 'Kategori', 'No_Telepon', 'Link_Maps', 'Rating', 'Jumlah_Ulasan', 'Website_Asli', 'Status_Lead', 'Alasan_Penolakan', 'Draft_Pitch_WA', 'Terakhir_Disinkron'];
    const rows = listToExport.map((l) => [`"${(l.name || '').replace(/"/g, '""')}"`, `"${l.selectedCategory || l.primaryType || 'general'}"`, `"${l.phoneAnalysis?.cleaned || l.nationalPhoneNumber || ''}"`, `"${(l.formattedAddress || '').replace(/"/g, '""')}"`, l.rating || 0, l.userRatingCount || 0, `"${l.websiteUri || l.website || ''}"`, `"${l.leadStatus || 'NEW'}"`, `"${l.rejectionReason || ''}"`, `"${(l.generatedPitch || l.aiMessage || '').replace(/"/g, '""')}"`, `"${l.lastSyncAt || new Date().toISOString()}"`]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Leads_CRM_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Ekspor ${listToExport.length} baris CSV berhasil.`);
  };

  const handleDownloadWaList = () => {
    const listToExport = activeTab === 'crm' ? savedLeadsCrm : filteredLeads;
    const phoneList = listToExport.filter((l) => l.phoneAnalysis.isValid && l.phoneAnalysis.isMobile).map((l) => l.phoneAnalysis.cleaned);
    if (phoneList.length === 0) { showToast('error', 'Tidak ada nomor WA valid.'); return; }
    const textContent = Array.from(new Set(phoneList)).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daftar_WhatsApp_${phoneList.length}_Nomor.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', `Unduh ${phoneList.length} nomor WA.`);
  };

  if (!hasMounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 antialiased">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <FontAwesomeIcon icon={faLock} className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Leads Machine CRM</h1>
            <p className="text-xs text-slate-500 mt-1">Masukkan 4-digit PIN keamanan operator</p>
          </div>
          <div className="flex justify-center gap-3">
            {pinInputs.map((val, idx) => (
              <input key={idx} ref={pinInputRefs[idx]} type="password" maxLength={1} value={val}
                onChange={(e) => handlePinInput(idx, e.target.value)} onKeyDown={(e) => handlePinKeyDown(idx, e)}
                className={`w-12 h-14 text-center text-xl font-mono font-bold rounded-xl border transition outline-none ${pinError ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'}`} />
            ))}
          </div>
          {pinError ? <p className="text-xs text-rose-600 font-medium">PIN tidak cocok.</p> : <p className="text-[11px] text-slate-400 font-mono">Default: 1992</p>}
        </div>
      </div>
    );
  }

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs animate-pulse">
            <FontAwesomeIcon icon={faBullseye} className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-800">Menyiapkan CRM Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-[#FAFAFA] flex text-slate-900 antialiased font-sans">
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-3 duration-150">
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium ${notification.type === 'success' ? 'bg-emerald-950 text-emerald-100 border-emerald-800' : 'bg-rose-950 text-rose-100 border-rose-800'}`}>
            {notification.type === 'success' ? <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 text-emerald-400 shrink-0" /> : <FontAwesomeIcon icon={faTimesCircle} className="h-4 w-4 text-rose-400 shrink-0" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <aside className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-150 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
                <FontAwesomeIcon icon={faBullseye} className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-xs tracking-tight text-slate-900">Leads Machine <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">v3.0</span></h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-500 font-medium">Sheets Sync Live</span>
                </div>
              </div>
            </div>
            <button onClick={() => setMobileSidebarOpen(false)} className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 p-1 bg-slate-100 rounded-lg flex items-center text-[11px] font-semibold">
            <button onClick={() => { setMarketMode('indo'); setSelectedCity('Malang'); }} className={`flex-1 py-1.5 rounded-md transition text-center cursor-pointer ${marketMode === 'indo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>🇮🇩 Indonesia</button>
            <button onClick={() => { setMarketMode('global'); setSelectedCity('London'); }} className={`flex-1 py-1.5 rounded-md transition text-center cursor-pointer ${marketMode === 'global' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}>🌍 Global B2B</button>
          </div>

          <nav className="mt-4 space-y-1 flex-1">
            <button onClick={() => { setActiveTab('search'); setMobileSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'search' ? 'bg-slate-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <div className="flex items-center gap-2.5"><FontAwesomeIcon icon={faSearch} className={`h-4 w-4 ${activeTab === 'search' ? 'text-emerald-400' : 'text-slate-500'}`} /><span>Discovery & Search</span></div>
              {leads.length > 0 && <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${activeTab === 'search' ? 'bg-slate-800 text-emerald-300' : 'bg-slate-200 text-slate-700'}`}>{leads.length}</span>}
            </button>
            <button onClick={() => { setActiveTab('crm'); setMobileSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'crm' ? 'bg-slate-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <div className="flex items-center gap-2.5"><FontAwesomeIcon icon={faLayerGroup} className={`h-4 w-4 ${activeTab === 'crm' ? 'text-emerald-400' : 'text-slate-500'}`} /><span>Pipeline CRM</span></div>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${activeTab === 'crm' ? 'bg-slate-800 text-emerald-300' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>{savedLeadsCrm.length}</span>
            </button>
            <button onClick={() => { setActiveTab('copilot'); setMobileSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'copilot' ? 'bg-slate-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <div className="flex items-center gap-2.5"><FontAwesomeIcon icon={faQuoteLeft} className={`h-4 w-4 ${activeTab === 'copilot' ? 'text-emerald-400' : 'text-slate-500'}`} /><span>AI Copilot</span></div>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">AI</span>
            </button>
            <button onClick={() => { setActiveTab('templates'); setMobileSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'templates' ? 'bg-slate-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <div className="flex items-center gap-2.5"><FontAwesomeIcon icon={faMagic} className={`h-4 w-4 ${activeTab === 'templates' ? 'text-emerald-400' : 'text-slate-500'}`} /><span>Pitch Templates</span></div>
            </button>
            <button onClick={() => { setActiveTab('export'); setMobileSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === 'export' ? 'bg-slate-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <div className="flex items-center gap-2.5"><FontAwesomeIcon icon={faDownload} className={`h-4 w-4 ${activeTab === 'export' ? 'text-emerald-400' : 'text-slate-500'}`} /><span>Export & Database</span></div>
            </button>
          </nav>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">MK</div>
                <div className="text-left"><p className="text-xs font-semibold text-slate-900 leading-tight">Mohammad Kevin</p><p className="text-[10px] text-slate-400">Operator</p></div>
              </div>
              <button onClick={handleLogout} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Logout"><FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"><FontAwesomeIcon icon={faBars} className="h-5 w-5" /></button>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight capitalize truncate">
                {activeTab === 'search' && (marketMode === 'global' ? 'Global Prospecting' : 'Discovery & Lead Qualification')}
                {activeTab === 'crm' && 'Pipeline CRM'}
                {activeTab === 'copilot' && 'AI Copilot'}
                {activeTab === 'templates' && 'Pitch Templates'}
                {activeTab === 'export' && 'Export & Database'}
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                {activeTab === 'search' && 'Cari bisnis target dengan filter franchise, website, rating'}
                {activeTab === 'crm' && 'Sinkron realtime ke Google Sheets'}
                {activeTab === 'copilot' && 'Balas chat masuk dengan AI'}
                {activeTab === 'templates' && 'Koleksi template value-first'}
                {activeTab === 'export' && 'Unduh CSV & daftar WA'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'crm' && (
              <button onClick={() => syncCrmFromSheet()} disabled={isSyncingCrm} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs cursor-pointer">
                <FontAwesomeIcon icon={faSync} className={`h-3.5 w-3.5 text-slate-500 ${isSyncingCrm ? 'animate-spin' : ''}`} />
                <span>{isSyncingCrm ? 'Syncing...' : 'Sync Sheet'}</span>
              </button>
            )}
          </div>
        </header>

        <div className="p-6 flex-1 space-y-6 max-w-7xl w-full mx-auto">

          {/* ===================== SEARCH ===================== */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <form onSubmit={handleSearch} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kota / Wilayah (bisa pilih banyak)</label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-1.5">
                        {(marketMode === 'indo' ? INDONESIA_REGIONS : GLOBAL_REGIONS).map((grp) => (
                          <div key={grp.region}>
                            <p className="text-[9px] font-bold text-slate-400 uppercase px-1 pt-1">{grp.region}</p>
                            {grp.cities.map((city) => {
                              const isSelected = selectedCities.includes(city);
                              return (
                                <label key={city} className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer text-[11px] hover:bg-slate-50 ${isSelected ? 'bg-emerald-50 font-semibold text-slate-900' : 'text-slate-600'}`}>
                                  <input type="checkbox" checked={isSelected} onChange={() => { setSelectedCities((prev) => prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]); }} className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer" />
                                  {city}
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <button type="button" onClick={() => {
                          const all = (marketMode === 'indo' ? INDONESIA_REGIONS : GLOBAL_REGIONS).flatMap((g) => g.cities);
                          setSelectedCities(all);
                        }} className="text-[9px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Pilih Semua</button>
                        <button type="button" onClick={() => setSelectedCities([])} className="text-[9px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">Reset</button>
                        <span className="text-[9px] text-slate-400 ml-auto">{selectedCities.length} kota</span>
                      </div>
                    </div>
                    <div className="md:col-span-8">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kata Kunci</label>
                      <div className="relative flex items-center">
                        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Misal: ${selectedCategoryPreset !== 'ALL' ? selectedCategoryPreset : 'Kos'} di ${selectedCities[0] || 'Kota'}`} className="w-full text-xs font-medium py-2 pl-3 pr-24 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900" />
                        <button type="submit" disabled={isLoading || selectedCities.length === 0} className="absolute right-1 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faSearch} className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} /><span>{isLoading ? 'Mencari...' : 'Cari Bulk'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {isLoading && batchProgress && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center gap-2">
                      <FontAwesomeIcon icon={faSpinner} className="h-3 w-3 animate-spin" />
                      <span>Mencari di {batchProgress.current}/{batchProgress.total} kota...</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Kategori:</span>
                    {(marketMode === 'indo' ? PRESET_CATEGORIES : GLOBAL_PRESET_CATEGORIES).map((cat) => (
                      <button key={cat.label} type="button" onClick={() => {
                        setSelectedCategoryPreset(cat.query);
                        if (cat.query !== 'ALL') {
                          setQuery(`${cat.query} di ${selectedCities[0] || ''}`);
                        }
                      }} className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${selectedCategoryPreset === cat.query ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat.label}</button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={excludeFranchiseToggle} onChange={(e) => setExcludeFranchiseToggle(e.target.checked)} className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer" /><span className="font-semibold text-slate-800 flex items-center gap-1"><FontAwesomeIcon icon={faShieldAlt} className="h-3.5 w-3.5 text-emerald-600" /> Blokir Franchise</span></label>
                    <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={filterIdealOnly} onChange={(e) => setFilterIdealOnly(e.target.checked)} className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer" /><span className="font-medium text-slate-700">Target Ideal (10-100 review & no web)</span></label>
                    <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={filterNoWebsiteOnly} onChange={(e) => setFilterNoWebsiteOnly(e.target.checked)} className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer" /><span className="font-medium text-slate-700">Tanpa Website</span></label>
                    <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={filterValidWaOnly} onChange={(e) => setFilterValidWaOnly(e.target.checked)} className="rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer" /><span className="font-medium text-slate-700">WA Valid Saja</span></label>
                  </div>
                </form>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {leads.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Hasil ({filteredLeads.length}/{leads.length})</span>
                      {selectedLeadIds.length > 0 && <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">{selectedLeadIds.length} dipilih</span>}
                    </div>
                    <button onClick={() => { if (selectedLeadIds.length === filteredLeads.length) setSelectedLeadIds([]); else setSelectedLeadIds(filteredLeads.map((l) => l.id)); }} className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">{selectedLeadIds.length === filteredLeads.length ? 'Batal Pilih' : 'Pilih Semua'}</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredLeads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      const cleanP = lead.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(lead.nationalPhoneNumber);
                      const isContacted = lead.status === 'contacted';
                      return (
                        <div key={lead.id} className={`bg-white border rounded-xl p-4 transition shadow-xs flex flex-col justify-between ${lead.isIdealTarget ? 'border-emerald-300 ring-1 ring-emerald-100' : isSelected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'}`}>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2.5">
                              <input type="checkbox" checked={isSelected} onChange={() => setSelectedLeadIds((prev) => prev.includes(lead.id) ? prev.filter((i) => i !== lead.id) : [...prev, lead.id])} className="mt-1 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-bold text-xs text-slate-900 truncate" title={lead.name}>{lead.name}</h3>
                                  {lead.isIdealTarget && <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Target Ideal</span>}
                                  {isContacted && <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Sudah Di-Chat</span>}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5" title={lead.formattedAddress}>{lead.formattedAddress}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-[11px]">
                              <div><span className="block text-[9px] font-bold text-slate-400 uppercase">WA</span><span className="font-mono font-medium text-slate-800 truncate block">{cleanP || '-'}</span></div>
                              <div><span className="block text-[9px] font-bold text-slate-400 uppercase">Website</span><span className="truncate block font-medium">{lead.websiteUri ? <a href={lead.websiteUri} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5"><span>Ada</span><FontAwesomeIcon icon={faExternalLinkSquare} className="h-2 w-2" /></a> : <span className="text-amber-800">Tanpa Web</span>}</span></div>
                              <div><span className="block text-[9px] font-bold text-slate-400 uppercase">Rating</span><span className="font-mono font-medium text-slate-800">{lead.rating > 0 ? `${lead.rating} ★ (${lead.userRatingCount || 0})` : '-'}</span></div>
                            </div>
                            {lead.generatedPitch && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-sans line-clamp-2">&quot;{lead.generatedPitch}&quot;</div>}
                          </div>
                          <div className="pt-3">
                            <button onClick={() => handleOpenPitchModal(lead)} disabled={pitchModalLoading && pitchModalLead?.id === lead.id} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs">
                              {pitchModalLoading && pitchModalLead?.id === lead.id ? (
                                <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span>Memproses...</span></>
                              ) : (
                                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg><span>Buat Pesan</span></>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedLeadIds.length > 0 && (
                <div className="sticky bottom-4 z-30 bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-150">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[11px] flex items-center justify-center font-mono">{selectedLeadIds.length}</span>
                    <span className="text-xs font-semibold">Terpilih</span>
                    {batchProgress && <span className="text-[11px] text-emerald-400 font-mono">(Proses {batchProgress.current}/{batchProgress.total} {batchProgress.currentDelay ? `| ${batchProgress.currentDelay}s` : ''})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleBatchGenerateAi} disabled={isBatchGenerating || isBatchSending} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer">
                      <FontAwesomeIcon icon={faRobot} className="h-3.5 w-3.5" /><span>Draf AI Semua</span>
                    </button>
                    <button onClick={handleBatchSendWhatsApp} disabled={isBatchGenerating || isBatchSending} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer">
                      <FontAwesomeIcon icon={faBolt} className="h-3.5 w-3.5" /><span>Kirim WA Semua</span>
                    </button>
                    <button onClick={() => setSelectedLeadIds([])} className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs cursor-pointer">Batal</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== CRM PIPELINE ===================== */}
          {activeTab === 'crm' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pipeline CRM</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Single Source of Truth — sinkron realtime ke Google Sheets</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => syncCrmFromSheet()} disabled={isSyncingCrm} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs cursor-pointer">
                    <FontAwesomeIcon icon={faSync} className={`h-3.5 w-3.5 ${isSyncingCrm ? 'animate-spin' : ''}`} /><span>{isSyncingCrm ? 'Syncing...' : 'Sync'}</span>
                  </button>
                  <button onClick={resetCacheAndSyncSheet} disabled={isSyncingCrm} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold cursor-pointer">
                    <FontAwesomeIcon icon={faSync} className="h-3.5 w-3.5 text-rose-600" /><span>Reset & Sync</span>
                  </button>
                  <button onClick={handleDownloadWaList} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer">
                    <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" /><span>WA List</span>
                  </button>
                  <button onClick={handleDownloadCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer">
                    <FontAwesomeIcon icon={faFileExcel} className="h-3.5 w-3.5 text-slate-400" /><span>CSV</span>
                  </button>
                </div>
              </div>

              {/* FUNNEL VISUALIZATION */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Funnel & Konversi</h4>
                <div className="space-y-2">
                  {(() => {
                    const total = savedLeadsCrm.length || 1;
                    const stages = [
                      { key: 'NEW', label: 'NEW', color: 'bg-amber-400' },
                      { key: 'QUALIFIED', label: 'QUALIFIED', color: 'bg-blue-400' },
                      { key: 'CONTACTED', label: 'CONTACTED', color: 'bg-emerald-400' },
                      { key: 'INTERESTED', label: 'INTERESTED', color: 'bg-indigo-400' },
                      { key: 'IN_PROGRESS', label: 'IN_PROGRESS', color: 'bg-cyan-400' },
                      { key: 'CLOSED', label: 'CLOSED (DEAL)', color: 'bg-purple-400' },
                    ];
                    return stages.map((stage, idx) => {
                      const count = savedLeadsCrm.filter((l) => (l.leadStatus || 'NEW').toUpperCase() === stage.key).length;
                      const pct = Math.round((count / total) * 100);
                      const prevCount = idx === 0 ? total : savedLeadsCrm.filter((l) => { const s = (l.leadStatus || 'NEW').toUpperCase(); return stages.slice(0, idx).some((st) => st.key === s); }).length || 1;
                      const convRate = count > 0 ? Math.round((count / prevCount) * 100) : 0;
                      return (
                        <div key={stage.key} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-800 w-32">{stage.label}</span>
                            <span className="font-mono text-slate-600">{count} prospek</span>
                            <span className="font-mono text-slate-400 w-16 text-right">{pct}%</span>
                            <span className="font-mono text-emerald-600 w-20 text-right">{idx === 0 ? '-' : `${convRate}%`}</span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${stage.color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                {savedLeadsCrm.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                    <p className="text-slate-700"><span className="font-bold">Conversion Rate:</span> {(() => { const c = savedLeadsCrm.filter((l) => (l.leadStatus || '').toUpperCase() === 'CLOSED').length; const ct = savedLeadsCrm.filter((l) => { const s = (l.leadStatus || '').toUpperCase(); return s === 'CONTACTED' || s === 'INTERESTED' || s === 'IN_PROGRESS' || s === 'CLOSED'; }).length; return ct > 0 ? Math.round((c / ct) * 100) + '%' : '0%'; })()} (CLOSED / CONTACTED)</p>
                    <p className="text-slate-700"><span className="font-bold">Estimasi Revenue:</span> Rp {(savedLeadsCrm.filter(l => { const s = (l.leadStatus || '').toUpperCase(); return s === 'INTERESTED' || s === 'IN_PROGRESS'; }).length * 2500000).toLocaleString('id-ID')}</p>
                    <p className="text-slate-500 italic">{(() => { const totalLeads = savedLeadsCrm.length; if (totalLeads === 0) return 'Belum ada data.'; const closed = savedLeadsCrm.filter((l) => (l.leadStatus || '').toUpperCase() === 'CLOSED').length; const contacted = savedLeadsCrm.filter((l) => { const s = (l.leadStatus || '').toUpperCase(); return s === 'CONTACTED' || s === 'INTERESTED' || s === 'IN_PROGRESS' || s === 'CLOSED'; }).length; const closeRate = closed / Math.max(1, totalLeads); const needed = closeRate > 0 ? Math.ceil(1 / closeRate) - totalLeads : 7 - contacted; return `Estimasi butuh ${Math.max(0, needed)} prospek lagi untuk 1 klien.`; })()}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button onClick={() => setCrmStatusFilter('all')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'all' ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Semua ({savedLeadsCrm.length})</button>
                <button onClick={() => setCrmStatusFilter('NEW')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'NEW' ? 'bg-amber-600 text-white font-semibold' : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'}`}>NEW ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'NEW').length})</button>
                <button onClick={() => setCrmStatusFilter('QUALIFIED')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'QUALIFIED' ? 'bg-blue-600 text-white font-semibold' : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'}`}>QUALIFIED ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'QUALIFIED').length})</button>
                <button onClick={() => setCrmStatusFilter('CONTACTED')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'CONTACTED' ? 'bg-emerald-600 text-white font-semibold' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'}`}>CONTACTED ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'CONTACTED').length})</button>
                <button onClick={() => setCrmStatusFilter('INTERESTED')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'INTERESTED' ? 'bg-indigo-600 text-white font-semibold' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'}`}>INTERESTED ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'INTERESTED').length})</button>
                <button onClick={() => setCrmStatusFilter('IN_PROGRESS')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'IN_PROGRESS' ? 'bg-cyan-600 text-white font-semibold' : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200'}`}>IN PROGRESS ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'IN_PROGRESS').length})</button>
                <button onClick={() => setCrmStatusFilter('LOST_FRANCHISE')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'LOST_FRANCHISE' ? 'bg-rose-600 text-white font-semibold' : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'}`}>FRANCHISE ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'LOST_FRANCHISE' || (l.leadStatus || '').toUpperCase() === 'UNQUALIFIED_FRANCHISE').length})</button>
                <button onClick={() => setCrmStatusFilter('LOST_REJECTED')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'LOST_REJECTED' ? 'bg-slate-600 text-white font-semibold' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'}`}>REJECTED ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'LOST_REJECTED').length})</button>
                <button onClick={() => setCrmStatusFilter('CLOSED')} className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer text-[11px] ${crmStatusFilter === 'CLOSED' ? 'bg-purple-600 text-white font-semibold' : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'}`}>CLOSED ({savedLeadsCrm.filter(l => (l.leadStatus || '').toUpperCase() === 'CLOSED').length})</button>
              </div>

              {savedLeadsCrm.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <FontAwesomeIcon icon={faFileExcel} className="h-6 w-6 text-slate-400" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Belum ada prospek</h4>
                  <p className="text-xs text-slate-500 mt-1">Sync dari Google Sheets atau cari prospek baru.</p>
                  <div className="mt-4 flex gap-2 justify-center">
                    <button onClick={() => syncCrmFromSheet()} className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"><FontAwesomeIcon icon={faSync} className="h-3 w-3 mr-1" />Sync Sheet</button>
                    <button onClick={() => setActiveTab('search')} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"><FontAwesomeIcon icon={faSearch} className="h-3 w-3 mr-1" />Cari Prospek</button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                        <tr><th className="px-3 py-3">Nama Bisnis</th><th className="px-3 py-3">Kategori</th><th className="px-3 py-3">No Telepon</th><th className="px-3 py-3">Maps</th><th className="px-3 py-3">Rating</th><th className="px-3 py-3">Website</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Alasan</th><th className="px-3 py-3">Pitch</th><th className="px-3 py-3">Sync</th><th className="px-3 py-3 text-right">Aksi</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {savedLeadsCrm.filter((l) => {
                          const cs = (l.leadStatus || 'NEW').toUpperCase();
                          if (crmStatusFilter === 'all') return true;
                          if (crmStatusFilter === 'NEW') return cs === 'NEW';
                          if (crmStatusFilter === 'CONTACTED') return cs === 'CONTACTED';
                          if (crmStatusFilter === 'INTERESTED') return cs === 'INTERESTED';
                          if (crmStatusFilter === 'IN_PROGRESS') return cs === 'IN_PROGRESS';
                          if (crmStatusFilter === 'CLOSED') return cs === 'CLOSED';
                          if (crmStatusFilter === 'LOST_FRANCHISE') return cs === 'LOST_FRANCHISE' || cs === 'UNQUALIFIED_FRANCHISE';
                          if (crmStatusFilter === 'LOST_REJECTED') return cs === 'LOST_REJECTED';
                          return cs === crmStatusFilter;
                        }).map((lead) => {
                          const cleanP = lead.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(lead.nationalPhoneNumber);
                          const cs = (lead.leadStatus || 'NEW').toUpperCase();
                          return (
                            <tr key={lead.id} className="hover:bg-slate-50/70 transition text-[11px]">
                              <td className="px-3 py-2.5 font-semibold text-slate-900 max-w-[180px]">
                                <div className="font-semibold text-slate-900 truncate" title={lead.name}>{lead.name}</div>
                                <div className="text-[10px] text-slate-400 font-normal truncate">{lead.formattedAddress}</div>
                              </td>
                              <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded bg-slate-100 font-medium text-[10px]">{lead.selectedCategory || lead.primaryType || 'general'}</span></td>
                              <td className="px-3 py-2.5 font-mono">{cleanP ? <span className="text-emerald-700 font-medium">{cleanP}</span> : <span className="text-slate-400">-</span>}</td>
                              <td className="px-3 py-2.5"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.formattedAddress}`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800" title="Buka Maps"><FontAwesomeIcon icon={faMapMarkerAlt} className="h-3 w-3" /><span>Maps</span></a></td>
                              <td className="px-3 py-2.5 font-mono">{lead.rating > 0 ? `${lead.rating}★ (${lead.userRatingCount || 0})` : '-'}</td>
                              <td className="px-3 py-2.5">{lead.websiteUri || lead.website ? <a href={lead.websiteUri || lead.website || '#'} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 truncate max-w-[100px]"><span className="truncate">{lead.websiteUri || lead.website}</span><FontAwesomeIcon icon={faExternalLinkSquare} className="h-2.5 w-2.5 shrink-0" /></a> : <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-medium text-[10px] border border-amber-200">Tanpa Web</span>}</td>
                              <td className="px-3 py-2.5">
                                <select aria-label="Status" value={cs} onChange={(e) => updateLeadStatus(lead.id, e.target.value)} className={`text-[10px] font-semibold py-1 px-1.5 rounded border focus:outline-none cursor-pointer ${STATUS_CONFIG[cs]?.bg || 'bg-slate-50'} ${STATUS_CONFIG[cs]?.border || 'border-slate-200'}`}>
                                  <option value="NEW">NEW</option><option value="QUALIFIED">QUALIFIED</option><option value="CONTACTED">CONTACTED</option><option value="INTERESTED">INTERESTED</option><option value="IN_PROGRESS">IN PROGRESS</option><option value="LOST_FRANCHISE">LOST FRANCHISE</option><option value="LOST_REJECTED">LOST REJECTED</option><option value="CLOSED">CLOSED</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <select aria-label="Alasan" value={lead.rejectionReason || ''} onChange={(e) => updateLeadStatus(lead.id, cs, (e.target.value as RejectionReason) || null)} className="text-[10px] py-1 px-1.5 rounded border border-slate-200 bg-white text-slate-700 cursor-pointer">
                                  <option value="">-</option><option value="Franchise">Franchise</option><option value="No Budget">No Budget</option><option value="Already Has Vendor">Already Has Vendor</option><option value="No Response">No Response</option><option value="Corporate">Corporate</option>
                                </select>
                              </td>
                              <td className="px-3 py-2.5">
                                <button onClick={() => { const p = lead.generatedPitch || lead.aiMessage || generateOutreachMessage({ businessName: lead.name, category: lead.selectedCategory, rating: lead.rating, userRatingCount: lead.userRatingCount, address: lead.formattedAddress }); navigator.clipboard.writeText(p); showToast('success', `Pitch ${lead.name} disalin!`); }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium border border-slate-200 cursor-pointer" title="Salin pitch"><FontAwesomeIcon icon={faCopy} className="h-2.5 w-2.5" /><span>Salin</span></button>
                              </td>
                              <td className="px-3 py-2.5 text-[10px] text-slate-400">{lead.lastSyncAt ? new Date(lead.lastSyncAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button onClick={() => handleOpenWhatsAppManual(lead)} disabled={!cleanP} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[10px] border border-emerald-300 cursor-pointer"><FontAwesomeIcon icon={faPaperPlane} className="h-2.5 w-2.5" /><span>WA</span></button>
                                  <button onClick={() => { setCopilotClientName(lead.name); setCopilotPhone(cleanP || ''); setCopilotCategory(lead.selectedCategory); setActiveTab('copilot'); }} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-[10px] border border-purple-200 cursor-pointer"><FontAwesomeIcon icon={faQuoteLeft} className="h-2.5 w-2.5" /><span>AI</span></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================== COPILOT ===================== */}
          {activeTab === 'copilot' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5"><FontAwesomeIcon icon={faMessage} className="h-4 w-4 text-purple-600" />Pesan Masuk</h3>
                  {copilotIntent && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${copilotIntent === 'LOST_FRANCHISE' ? 'bg-rose-50 text-rose-700 border-rose-200' : copilotIntent === 'INTERESTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>Intent: {copilotIntent}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Klien</label><input type="text" value={copilotClientName} onChange={(e) => setCopilotClientName(e.target.value)} placeholder="Nama bisnis" className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-slate-900" /></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No WhatsApp</label><input type="text" value={copilotPhone} onChange={(e) => setCopilotPhone(e.target.value)} placeholder="08123456789" className="w-full text-xs font-mono py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-slate-900" /></div>
                </div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Chat dari Klien</label><textarea rows={6} value={copilotIncomingMessage} onChange={(e) => setCopilotIncomingMessage(e.target.value)} placeholder="Tempel chat dari klien di sini..." className="w-full text-xs py-2.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 resize-none" /></div>
                <button onClick={handleGenerateCopilotReply} disabled={isGeneratingCopilot || !copilotIncomingMessage.trim()} className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                  <FontAwesomeIcon icon={faRobot} className={`h-4 w-4 ${isGeneratingCopilot ? 'animate-spin text-purple-400' : ''}`} />
                  <span>{isGeneratingCopilot ? 'Menganalisis & Draf...' : 'Buat Balasan AI'}</span>
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5"><FontAwesomeIcon icon={faMagic} className="h-4 w-4 text-emerald-600" />Draf Balasan</h3>
                  </div>
                  <textarea rows={9} value={copilotGeneratedReply} onChange={(e) => setCopilotGeneratedReply(e.target.value)} placeholder="Hasil balasan AI akan muncul di sini. Edit sebelum kirim." className="w-full text-xs font-sans py-2.5 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:border-slate-900 resize-none leading-relaxed" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={() => { if (!copilotGeneratedReply) return; navigator.clipboard.writeText(copilotGeneratedReply); showToast('success', 'Disalin!'); }} disabled={!copilotGeneratedReply} className="flex-1 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                    <FontAwesomeIcon icon={faCopy} className="h-3.5 w-3.5" /><span>Salin</span>
                  </button>
                  <button onClick={handleSendCopilotReply} disabled={isSendingCopilot || !copilotGeneratedReply || !copilotPhone} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                    <FontAwesomeIcon icon={faPaperPlane} className={`h-3.5 w-3.5 ${isSendingCopilot ? 'animate-spin' : ''}`} /><span>{isSendingCopilot ? 'Mengirim...' : 'Kirim WA'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TEMPLATES ===================== */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Koleksi Template Value-First</h3>
                <p className="text-xs text-slate-500 mt-0.5">Template 60-80 kata tanpa klise sales untuk outreach WA efektif.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {OUTREACH_CATEGORIES.map((cat) => {
                  const samplePitch = generateOutreachMessage({ businessName: `Contoh Bisnis ${cat.label.split(' ')[0]}`, category: cat.id });
                  return (
                    <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">{cat.badge}</span><span className="text-[10px] font-mono text-slate-400">~65 kata</span></div>
                        <h4 className="text-xs font-bold text-slate-900 mt-2">{cat.label}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">{cat.description}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 font-sans leading-relaxed whitespace-pre-wrap">{samplePitch}</div>
                      <button onClick={() => { navigator.clipboard.writeText(samplePitch); showToast('success', `Template "${cat.label}" disalin!`); }} className="w-full py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                        <FontAwesomeIcon icon={faCopy} className="h-3 w-3" /><span>Salin Template</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================== EXPORT ===================== */}
          {activeTab === 'export' && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ekspor Data Prospek</h3>
                  <p className="text-xs text-slate-500 mt-1">Unduh database prospek yang sudah difilter.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100">
                  <div className="p-3 bg-slate-50 rounded-lg text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Pipeline CRM</span><p className="text-xl font-mono font-bold text-slate-900 mt-0.5">{savedLeadsCrm.length}</p></div>
                  <div className="p-3 bg-slate-50 rounded-lg text-center"><span className="text-[10px] font-bold text-slate-400 uppercase">Hasil Pencarian</span><p className="text-xl font-mono font-bold text-slate-900 mt-0.5">{filteredLeads.length}</p></div>
                </div>
                <div className="space-y-2.5">
                  <button onClick={handleDownloadCsv} className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                    <FontAwesomeIcon icon={faFileExcel} className="h-4 w-4 text-emerald-400" /><span>Unduh CSV Lengkap (11 Kolom)</span>
                  </button>
                  <button onClick={handleDownloadWaList} className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                    <FontAwesomeIcon icon={faDownload} className="h-4 w-4" /><span>Unduh Daftar WA (.txt)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>

    {pitchModalLead && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPitchModalLead(null)}>
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Buat Pesan Penawaran</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{pitchModalLead.name} — {pitchModalLead.selectedCategory}</p>
            </div>
            <button onClick={() => setPitchModalLead(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-6 py-4 min-h-[180px]">
            {pitchModalError && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-[11px] text-amber-700 font-medium">{pitchModalError}</p>
              </div>
            )}
            {pitchModalLoading && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-blue-50 border border-blue-200">
                <svg className="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-[11px] text-blue-700 font-medium">AI sedang menyempurnakan pesan...</p>
              </div>
            )}
            <textarea
              value={pitchModalMessage}
              onChange={(e) => setPitchModalMessage(e.target.value)}
              className="w-full h-40 p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Draf pesan akan muncul di sini..."
            />
          </div>
          {!pitchModalLoading && (
            <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-2 border-t border-slate-100">
              <button onClick={() => setPitchModalLead(null)} className="px-4 py-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">Batal</button>
              {(() => {
                const rawPhone = pitchModalLead?.phoneAnalysis?.cleaned || normalizeWhatsAppNumber(pitchModalLead?.nationalPhoneNumber || '');
                const hasValidPhone = Boolean(rawPhone && rawPhone.replace(/\D/g, '').length >= 6);
                return hasValidPhone ? (
                  <button onClick={handlePitchModalSendWa} disabled={!pitchModalMessage.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    Kirim via WhatsApp
                  </button>
                ) : (
                  <span className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-400 border border-slate-200">Nomor WhatsApp tidak tersedia</span>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}