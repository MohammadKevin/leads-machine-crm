import fs from 'fs';
import path from 'path';
import { PrototypeData } from '@/types/prototype';
import { createDefaultPrototype } from '@/lib/prototype-templates';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'prototypes.json');

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

const REDIS_KEY = 'prototypes_list';

function getLocalPrototypes(): PrototypeData[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const seed1 = createDefaultPrototype({
        businessName: 'Klinik Gigi Sehat Bersama',
        category: 'Klinik Gigi & Dental Care',
        city: 'Malang',
        phone: '081234567890',
        rating: 4.9,
        reviewsCount: 84,
        address: 'Jl. Ijen No. 45, Klojen, Kota Malang',
      });
      const seed2 = createDefaultPrototype({
        businessName: 'Villa Asri Bromo Sanctuary',
        category: 'Villa & Homestay',
        city: 'Batu / Bromo',
        phone: '082198765432',
        rating: 5.0,
        reviewsCount: 62,
        address: 'Jl. Oro-Oro Ombo No. 88, Kota Batu',
      });
      const initial = [seed1, seed2];
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content || '[]');
  } catch {
    return [];
  }
}

function saveLocalPrototypes(list: PrototypeData[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // ignore on read-only environments
  }
}

export async function getAllPrototypes(): Promise<PrototypeData[]> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/${REDIS_KEY}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {
      // fallback
    }
  }

  return getLocalPrototypes();
}

export async function getPrototypeBySlug(slug: string): Promise<PrototypeData | null> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/proto_${slug}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          if (parsed && typeof parsed === 'object') return parsed as PrototypeData;
        }
      }
    } catch {
      // fallback to list
    }
  }

  const list = await getAllPrototypes();
  return list.find((p) => p.slug === slug) || null;
}

export async function savePrototype(prototype: PrototypeData): Promise<void> {
  const currentList = await getAllPrototypes();
  const idx = currentList.findIndex((p) => p.slug === prototype.slug);
  if (idx >= 0) {
    currentList[idx] = prototype;
  } else {
    currentList.unshift(prototype);
  }

  saveLocalPrototypes(currentList);

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      await Promise.all([
        fetch(`${UPSTASH_URL}/set/${REDIS_KEY}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(currentList),
        }),
        fetch(`${UPSTASH_URL}/set/proto_${prototype.slug}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(prototype),
        }),
      ]);
    } catch {
      // ignore
    }
  }
}

export async function deletePrototypeBySlug(slug: string): Promise<void> {
  const currentList = await getAllPrototypes();
  const filtered = currentList.filter((p) => p.slug !== slug);
  saveLocalPrototypes(filtered);

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      await Promise.all([
        fetch(`${UPSTASH_URL}/set/${REDIS_KEY}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(filtered),
        }),
        fetch(`${UPSTASH_URL}/del/proto_${slug}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        }),
      ]);
    } catch {
      // ignore
    }
  }
}
