import { normalizeIndonesianPhone, isValidIndonesianWhatsApp } from './defensive-client';

export type LeadStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'IN_PROGRESS'
  | 'LOST_FRANCHISE'
  | 'LOST_REJECTED'
  | 'CLOSED'
  | 'UNQUALIFIED_FRANCHISE'
  | 'UNQUALIFIED_CORPORATE';

export type RejectionReason =
  | 'Franchise'
  | 'No Budget'
  | 'Already Has Vendor'
  | 'No Response'
  | 'Corporate'
  | null;

export type PriorityScore = 'HIGH' | 'MEDIUM' | 'LOW' | 'DISQUALIFIED';

export interface LeadQualificationResult {
  status: LeadStatus;
  priorityScore: PriorityScore;
  rejectionReason: RejectionReason;
  isIdealTarget: boolean;
  qualificationNotes: string;
  isFranchise: boolean;
  isCorporate: boolean;
  hasFreeWebsite: boolean;
}

export interface LeadEntity {
  id: string;
  business_name: string;
  category: string;
  phone_number: string;
  normalized_phone: string;
  maps_url: string;
  rating: number;
  review_count: number;
  website: string | null;
  priority_score: PriorityScore;
  lead_status: LeadStatus;
  rejection_reason: RejectionReason;
  generated_pitch: string;
  last_sync_at: string;
  qualification_notes?: string;
  is_ideal_target: boolean;
}

export const FRANCHISE_BLACKLIST_KEYWORDS = [
  'cabang',
  'unit',
  'franchise',
  'kemitraan',
  'alfamart',
  'indomaret',
  'alfamidi',
  'kimia farma',
  'k24',
  'k-24',
  'apotek k-24',
  'apotek k24',
  'century',
  'guardian',
  'watsons',
  'kumon',
  'sakamoto',
  'mixue',
  'kopi kenangan',
  'spbu',
  'pertamina',
  'shell',
  'bp akr',
  'j&t',
  'jne',
  'lawson',
  'point coffee',
  'janji jiwa',
  'kfc',
  'mcdonald',
  'mcdonalds',
  'richeese',
  'chatime',
  'starbucks',
  'dunkin',
  'hokben',
  'solaria',
  'fore coffee',
  'indomaret point',
  'si cepat',
  'sicepat',
  'anteraja',
  'tiki',
  'pos indonesia',
  'ninja express',
  'wahana express',
  'haus!',
  'teh solo',
  'esteh indonesia',
  'es teh indonesia',
  'mie gacoan',
  'gacoan',
  'optik melawai',
  'optik seis',
  'optik tunggal',
  'pizza hut',
  'dominos',
  'subway',
  'burger king',
  'a&w',
  'jco',
  'roti o',
  "roti'o",
  'bca',
  'mandiri',
  'bni',
  'bri',
  'prudential',
  'allianz',
  'warung madura',
  'toko kelontong',
  'tambal ban',
  'laundry kiloan',
  'cuci helm',
  'counter pulsa',
  'fotocopy',
];

export const FREE_WEBSITE_DOMAINS = [
  'linktr.ee',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'wa.me',
  'api.whatsapp.com',
  'bit.ly',
  'carrd.co',
  'canva.site',
  'bio.link',
  'heylink.me',
  'beacons.ai',
  'lynx.id',
  'desty.page',
  'blogspot.com',
  'wordpress.com',
  'site.google.com',
  'sites.google.com',
  'wixsite.com',
  'myshopify.com',
  'tokoko.id',
  'biolinky.co',
  'page.link',
  'weebly.com',
  'yolasite.com',
  'strikingly.com',
  'shopee.co.id',
  'tokopedia.com',
];

export const CORPORATE_DOMAINS = [
  '.co.id',
  '.ac.id',
  '.go.id',
  '.mil.id',
  '.or.id',
  '.sch.id',
];

export function isFranchiseOrBlacklisted(name?: string | null): {
  isFranchise: boolean;
  matchedKeyword?: string;
} {
  if (!name || typeof name !== 'string') {
    return { isFranchise: false };
  }

  const normalizedName = ` ${name.toLowerCase().replace(/[^\w\s&]/g, ' ')} `;

  for (const keyword of FRANCHISE_BLACKLIST_KEYWORDS) {
    const pattern = new RegExp(`(^|\\s|[^a-zA-Z0-9])${keyword.replace(/&/g, '\\&')}($|\\s|[^a-zA-Z0-9])`, 'i');
    if (pattern.test(normalizedName) || normalizedName.includes(` ${keyword.toLowerCase()} `)) {
      return { isFranchise: true, matchedKeyword: keyword };
    }
  }

  return { isFranchise: false };
}

export function isFreeWebsiteDomain(website?: string | null): boolean {
  if (!website || typeof website !== 'string') return false;
  const lower = website.toLowerCase();
  return FREE_WEBSITE_DOMAINS.some((domain) => lower.includes(domain));
}

export function isCorporateWebsiteDomain(website?: string | null): boolean {
  if (!website || typeof website !== 'string') return false;
  const lower = website.toLowerCase();
  return CORPORATE_DOMAINS.some((domain) => lower.includes(domain));
}

/**
 * Evaluasi Prospek Tier A1 Ketat:
 * 1. Tanpa website resmi (website null/kosong atau hanya medsos/free linktree).
 * 2. Bisnis aktif & berjalan (ulasan minimal 3-5 ulasan atau rating aktif).
 * 3. Nomor WhatsApp seluler Indonesia valid (berawalan 628/08, drop nomor kabel 0341, 031, dll).
 * 4. Bukan jaringan franchise/waralaba multinasional.
 */
export function checkStrictA1Qualification(params: {
  businessName: string;
  rawPhone?: string | null;
  website?: string | null;
  rating?: number;
  reviewsCount?: number;
}): {
  isA1: boolean;
  cleanPhone: string;
  hasOfficialWebsite: boolean;
  isFreeOrSocialLink: boolean;
  rejectionReason?: string;
} {
  const { businessName, rawPhone, website, rating = 0, reviewsCount = 0 } = params;

  // 1. Validasi Telepon Seluler (WhatsApp Valid 628)
  const cleanPhone = normalizeIndonesianPhone(rawPhone);
  if (!cleanPhone || !isValidIndonesianWhatsApp(cleanPhone)) {
    return {
      isA1: false,
      cleanPhone: cleanPhone || '',
      hasOfficialWebsite: false,
      isFreeOrSocialLink: false,
      rejectionReason: 'Bukan nomor WhatsApp seluler Indonesia (08/628)',
    };
  }

  // 2. Filter Franchise
  const franchiseCheck = isFranchiseOrBlacklisted(businessName);
  if (franchiseCheck.isFranchise) {
    return {
      isA1: false,
      cleanPhone,
      hasOfficialWebsite: false,
      isFreeOrSocialLink: false,
      rejectionReason: `Waralaba/Franchise terdeteksi (${franchiseCheck.matchedKeyword})`,
    };
  }

  // 3. Website Check
  const cleanWebsite = typeof website === 'string' ? website.trim() : '';
  const isFreeOrSocial = Boolean(cleanWebsite && isFreeWebsiteDomain(cleanWebsite));
  const hasOfficialWebsite = Boolean(cleanWebsite && !isFreeOrSocial);

  if (hasOfficialWebsite) {
    return {
      isA1: false,
      cleanPhone,
      hasOfficialWebsite: true,
      isFreeOrSocialLink: false,
      rejectionReason: 'Sudah memiliki website resmi mandiri',
    };
  }

  // 4. Bisnis Aktif & Berjalan (Reviews >= 3 atau Rating >= 3.5)
  const isActivelyOperating = reviewsCount >= 3 || rating >= 3.5;
  if (!isActivelyOperating) {
    return {
      isA1: false,
      cleanPhone,
      hasOfficialWebsite: false,
      isFreeOrSocialLink: isFreeOrSocial,
      rejectionReason: 'Kurang dari 3 ulasan atau reputasi tidak aktif',
    };
  }

  return {
    isA1: true,
    cleanPhone,
    hasOfficialWebsite: false,
    isFreeOrSocialLink: isFreeOrSocial,
  };
}

export function evaluateLeadQualification(params: {
  name: string;
  website?: string | null;
  rating?: number;
  reviewCount?: number;
}): LeadQualificationResult {
  const { name, website, rating = 0, reviewCount = 0 } = params;

  const franchiseCheck = isFranchiseOrBlacklisted(name);
  if (franchiseCheck.isFranchise) {
    return {
      status: 'UNQUALIFIED_FRANCHISE',
      priorityScore: 'DISQUALIFIED',
      rejectionReason: 'Franchise',
      isIdealTarget: false,
      qualificationNotes: `Terdeteksi jaringan franchise/cabang (${franchiseCheck.matchedKeyword})`,
      isFranchise: true,
      isCorporate: false,
      hasFreeWebsite: false,
    };
  }

  const cleanWebsite = typeof website === 'string' ? website.trim() : '';
  const hasWebsite = Boolean(cleanWebsite && cleanWebsite.length > 0);
  const isCorporate = hasWebsite && isCorporateWebsiteDomain(cleanWebsite);

  if (isCorporate) {
    return {
      status: 'UNQUALIFIED_CORPORATE',
      priorityScore: 'DISQUALIFIED',
      rejectionReason: 'Corporate',
      isIdealTarget: false,
      qualificationNotes: 'Domain korporat/institusi nasional (.co.id/.ac.id)',
      isFranchise: false,
      isCorporate: true,
      hasFreeWebsite: false,
    };
  }

  const isFreeWeb = hasWebsite && isFreeWebsiteDomain(cleanWebsite);
  const noWebsiteOrFree = !hasWebsite || isFreeWeb;

  const isIdealReviewCount = reviewCount >= 5 && reviewCount <= 100;
  const isGrowingBusiness = reviewCount >= 3 && reviewCount <= 250;

  let priorityScore: PriorityScore = 'LOW';
  let isIdealTarget = false;
  let notes = '';

  if (noWebsiteOrFree && isIdealReviewCount) {
    priorityScore = 'HIGH';
    isIdealTarget = true;
    notes = `Target Ideal A1: ${!hasWebsite ? 'Tanpa Website' : 'Hanya Link Medsos/Free'} + ${reviewCount} ulasan (${rating}★)`;
  } else if (noWebsiteOrFree && isGrowingBusiness) {
    priorityScore = 'HIGH';
    isIdealTarget = true;
    notes = `Prioritas Tinggi A1: ${!hasWebsite ? 'Belum Ada Website' : 'Link Medsos/Free'} & bisnis aktif (${reviewCount} ulasan)`;
  } else if (noWebsiteOrFree) {
    priorityScore = 'HIGH';
    isIdealTarget = false;
    notes = `A1: ${!hasWebsite ? 'Belum Memiliki Website' : 'Link Medsos/Free'}`;
  } else {
    priorityScore = 'LOW';
    isIdealTarget = false;
    notes = `Sudah memiliki website resmi dan ${reviewCount} ulasan`;
  }

  return {
    status: 'QUALIFIED',
    priorityScore,
    rejectionReason: null,
    isIdealTarget,
    qualificationNotes: notes,
    isFranchise: false,
    isCorporate: false,
    hasFreeWebsite: isFreeWeb,
  };
}
