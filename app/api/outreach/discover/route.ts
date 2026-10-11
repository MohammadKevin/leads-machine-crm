import { NextRequest, NextResponse } from 'next/server';
import { cleanPhoneNumber } from '@/lib/phone-utils';
import { evaluateLeadQualification } from '@/lib/lead-qualification';
import {
  BATCH_TARGET_TOTAL,
  ClinicCategory,
  LeadTarget,
} from '@/types/outreach';
import {
  buildClinicOutreachMessage,
  buildPainPointNotes,
  getCuratedA1Leads,
  inferClinicCategory,
  isA1ClinicCategory,
  sanitizeOutreachPhone,
} from '@/lib/outreach-seed';

const DISCOVERY_CITIES: Array<{ city: string; province: string }> = [
  { city: 'Malang', province: 'Jawa Timur' },
  { city: 'Surabaya', province: 'Jawa Timur' },
  { city: 'Kediri', province: 'Jawa Timur' },
  { city: 'Jakarta', province: 'DKI Jakarta' },
  { city: 'Bandung', province: 'Jawa Barat' },
  { city: 'Semarang', province: 'Jawa Tengah' },
  { city: 'Jogja', province: 'DI Yogyakarta' },
  { city: 'Medan', province: 'Sumatera Utara' },
  { city: 'Makassar', province: 'Sulawesi Selatan' },
  { city: 'Denpasar', province: 'Bali' },
];

const DISCOVERY_QUERIES = [
  'Klinik Pratama',
  'Klinik Gigi Dental',
  'Klinik Kecantikan Estetika',
  'Apotek',
];

interface RawProviderPlace {
  title?: string;
  name?: string;
  address?: string;
  phone?: string;
  phoneNumber?: string;
  website?: string;
  websiteUri?: string;
  category?: string;
}

interface LeadCandidate {
  name: string;
  rawPhone: string;
  website: string | null;
  address: string;
  category: string;
  city: string;
  province: string;
}

function isA1Candidate(candidate: LeadCandidate): boolean {
  if (!isA1ClinicCategory(candidate.name, candidate.category)) return false;

  const phone = cleanPhoneNumber(candidate.rawPhone);
  if (!phone.isValid || !phone.isMobile) return false;

  const qual = evaluateLeadQualification({
    name: candidate.name,
    website: candidate.website,
    rating: 4.6,
    reviewCount: 20,
  });

  if (qual.isFranchise || qual.isCorporate) return false;

  const hasWebsite = Boolean(candidate.website && candidate.website.trim().length > 0);
  const hasFreeWebsite = qual.hasFreeWebsite;
  return !hasWebsite || hasFreeWebsite;
}

function toLeadTarget(candidate: LeadCandidate, index: number): LeadTarget {
  const category: ClinicCategory = inferClinicCategory(candidate.name, candidate.category);
  const cleanPhone = sanitizeOutreachPhone(candidate.rawPhone);
  return {
    id: `live-a1-${index + 1}-${cleanPhone.slice(-4)}`,
    clinicName: candidate.name,
    city: candidate.city,
    province: candidate.province,
    category,
    whatsappNumber: cleanPhone,
    painPointNotes: buildPainPointNotes(category),
    tier: 'A1_PRIORITY',
    generatedMessage: buildClinicOutreachMessage({
      clinicName: candidate.name,
      city: candidate.city,
      category,
    }),
    status: 'ready',
  };
}

async function fetchSerper(query: string, apiKey: string): Promise<LeadCandidate[]> {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'id', hl: 'id' }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.places)) return [];
  return data.places.map((place: RawProviderPlace) => ({
    name: place.title || 'Klinik',
    rawPhone: place.phoneNumber || '',
    website: place.website || null,
    address: place.address || '',
    category: place.category || '',
    city: '',
    province: '',
  }));
}

async function fetchSerpApi(query: string, apiKey: string): Promise<LeadCandidate[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'id');
  url.searchParams.set('gl', 'id');
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data || data.error) return [];
  const raw = Array.isArray(data.local_results)
    ? data.local_results
    : data.place_results
    ? [data.place_results]
    : [];
  return raw.map((place: RawProviderPlace) => ({
    name: place.title || place.name || 'Klinik',
    rawPhone: place.phone || '',
    website: place.website || null,
    address: place.address || '',
    category: place.category || '',
    city: '',
    province: '',
  }));
}

async function fetchOpenStreetMap(query: string): Promise<LeadCandidate[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&addressdetails=1&extratags=1&limit=20`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'LeadsMachineBot/1.0 (B2B Prospecting Tool)',
      'Accept-Language': 'id,en;q=0.9',
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) return [];
  return data.map((item: { name?: string; display_name?: string; extratags?: Record<string, string> }) => {
    const extra = item.extratags || {};
    return {
      name: item.name || item.display_name?.split(',')[0] || 'Klinik',
      rawPhone: extra.phone || extra['contact:phone'] || extra['contact:whatsapp'] || '',
      website: extra.website || extra['contact:website'] || null,
      address: item.display_name || '',
      category: 'klinik',
      city: '',
      province: '',
    };
  });
}

async function discoverLiveCandidates(limit: number): Promise<LeadTarget[]> {
  const serperKey = process.env.SERPER_API_KEY;
  const serpApiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;

  const results: LeadTarget[] = [];
  const seen = new Set<string>();
  const cities = DISCOVERY_CITIES.slice(0, 5);
  const deadline = Date.now() + 12000;

  for (const { city, province } of cities) {
    if (results.length >= limit || Date.now() > deadline) break;

    for (const query of DISCOVERY_QUERIES) {
      if (results.length >= limit || Date.now() > deadline) break;

      const fullQuery = `${query} di ${city}`;
      let candidates: LeadCandidate[] = [];

      try {
        if (serperKey) {
          candidates = await fetchSerper(fullQuery, serperKey);
        }
        if (candidates.length === 0 && serpApiKey && Date.now() < deadline) {
          candidates = await fetchSerpApi(fullQuery, serpApiKey);
        }
        if (candidates.length === 0 && Date.now() < deadline) {
          candidates = await fetchOpenStreetMap(fullQuery);
        }
      } catch {
        candidates = [];
      }

      for (const candidate of candidates) {
        if (results.length >= limit) break;
        const enriched: LeadCandidate = { ...candidate, city: candidate.city || city, province: candidate.province || province };
        if (!isA1Candidate(enriched)) continue;
        const cleanPhone = sanitizeOutreachPhone(enriched.rawPhone);
        if (!cleanPhone || seen.has(cleanPhone)) continue;
        seen.add(cleanPhone);
        results.push(toLeadTarget(enriched, results.length));
      }
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedTotal =
      typeof body?.total === 'number' && body.total > 0
        ? Math.floor(body.total)
        : BATCH_TARGET_TOTAL;

    const curated = getCuratedA1Leads(requestedTotal);
    const seen = new Set(curated.map((lead) => lead.whatsappNumber));

    let liveLeads: LeadTarget[] = [];
    try {
      liveLeads = await discoverLiveCandidates(requestedTotal);
    } catch {
      liveLeads = [];
    }

    const merged: LeadTarget[] = [];
    for (const lead of liveLeads) {
      if (merged.length >= requestedTotal) break;
      if (seen.has(lead.whatsappNumber)) continue;
      seen.add(lead.whatsappNumber);
      merged.push(lead);
    }

    for (const lead of curated) {
      if (merged.length >= requestedTotal) break;
      merged.push(lead);
    }

    const data = merged.map((lead, index) => ({ ...lead, id: `a1-${index + 1}-${lead.whatsappNumber.slice(-4)}` }));

    return NextResponse.json({
      success: true,
      count: data.length,
      source: liveLeads.length > 0 ? 'live_plus_curated' : 'curated_fallback',
      data,
    });
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'Terjadi kesalahan pada server saat auto-discovery.';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
