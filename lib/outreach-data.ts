export type LeadCategory = 'klinik' | 'kost' | 'kafe' | 'lainnya';
export type LeadStatus = 'pending' | 'sent' | 'replied';

export interface Lead {
  id: string;
  name: string;
  category: LeadCategory;
  city: string;
  area: string;
  phone: string;
  status: LeadStatus;
  address?: string;
  rating?: number;
}

export interface KotaJatim {
  name: string;
  label: string;
}

export const KOTA_JATIM: KotaJatim[] = [
  { name: 'malang', label: 'Kota Malang' },
  { name: 'surabaya', label: 'Kota Surabaya' },
  { name: 'batu', label: 'Kota Batu' },
  { name: 'sidoarjo', label: 'Kab. Sidoarjo' },
  { name: 'kediri', label: 'Kota Kediri' },
  { name: 'blitar', label: 'Kota Blitar' },
  { name: 'mojokerto', label: 'Kota Mojokerto' },
  { name: 'pasuruan', label: 'Kota Pasuruan' },
  { name: 'probolinggo', label: 'Kota Probolinggo' },
  { name: 'gresik', label: 'Kab. Gresik' },
  { name: 'bangkalan', label: 'Kab. Bangkalan' },
  { name: 'sampang', label: 'Kab. Sampang' },
  { name: 'pamekasan', label: 'Kab. Pamekasan' },
  { name: 'sumenep', label: 'Kab. Sumenep' },
  { name: 'lamongan', label: 'Kab. Lamongan' },
  { name: 'tuban', label: 'Kab. Tuban' },
  { name: 'bojonegoro', label: 'Kab. Bojonegoro' },
  { name: 'ngawi', label: 'Kab. Ngawi' },
  { name: 'magetan', label: 'Kab. Magetan' },
  { name: 'ponorogo', label: 'Kab. Ponorogo' },
  { name: 'pacitan', label: 'Kab. Pacitan' },
  { name: 'trenggalek', label: 'Kab. Trenggalek' },
  { name: 'tulungagung', label: 'Kab. Tulungagung' },
  { name: 'kediri_kab', label: 'Kab. Kediri' },
  { name: 'blitar_kab', label: 'Kab. Blitar' },
  { name: 'malang_kab', label: 'Kab. Malang' },
  { name: 'lumajang', label: 'Kab. Lumajang' },
  { name: 'jember', label: 'Kab. Jember' },
  { name: 'situbondo', label: 'Kab. Situbondo' },
  { name: 'bondowoso', label: 'Kab. Bondowoso' },
  { name: 'banyuwangi', label: 'Kab. Banyuwangi' },
  { name: 'jombang', label: 'Kab. Jombang' },
  { name: 'nganjuk', label: 'Kab. Nganjuk' },
  { name: 'madiun', label: 'Kota Madiun' },
  { name: 'madiun_kab', label: 'Kab. Madiun' },
  { name: 'nganjuk_kota', label: 'Kota Nganjuk' },
  { name: 'probolinggo_kab', label: 'Kab. Probolinggo' },
  { name: 'pasuruan_kab', label: 'Kab. Pasuruan' },
];

export const AREA_MALANG = ['Suhat', 'Klojen', 'Blimbing', 'Lowokwaru', 'Kedungkandang', 'Tlogomas', 'Dinoyo', 'Sawojajar', 'Bunul', 'Celaket'];
export const AREA_SURABAYA = ['Wonokromo', 'Gubeng', 'Tegalsari', 'Genteng', 'Bubutan', 'Rungkut', 'Sukolilo', 'Mulyorejo'];
export const AREA_SIDOARJO = ['Krian', 'Taman', 'Waru', 'Gedangan', 'Buduran', 'Candi', 'Porong', 'Tanggulangin'];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function generateMockLeads(count: number = 40): Lead[] {
  const bases: Array<{ name: string; cat: LeadCategory; city: string; area: string }> = [
    // Klinik — Malang majority
    ...Array(6).fill(null).map((_, i) => ({ name: `Klinik Sehat ${['Medika', 'Alam', 'Bunda', 'Ananda', 'Keluarga', 'Prima'][i]}`, cat: 'klinik' as const, city: 'malang', area: pick(AREA_MALANG) })),
    { name: 'Klinik Gigi Clemensia', cat: 'klinik', city: 'malang', area: 'Sawojajar' },
    { name: 'Klinik Estetika Damai', cat: 'klinik', city: 'surabaya', area: 'Wonokromo' },
    { name: 'Klinik Pratama Sidoarjo', cat: 'klinik', city: 'sidoarjo', area: 'Candi' },
    { name: 'Klinik Bidan Lestari', cat: 'klinik', city: 'batu', area: 'Oro-oro Ombo' },
    { name: 'Poli Dokter Umum Griya', cat: 'klinik', city: 'kediri', area: 'Kota Kediri' },
    // Kost — Malang majority
    ...Array(6).fill(null).map((_, i) => ({ name: `Kost Putri ${['Mawar', 'Melati', 'Kenanga', 'Anggrek', 'Flamboyan', 'Bougenville'][i]}`, cat: 'kost' as const, city: 'malang', area: pick(AREA_MALANG) })),
    { name: 'Kost Putra Wijaya', cat: 'kost', city: 'malang', area: 'Blimbing' },
    { name: 'Homestay Griya Tamansari', cat: 'kost', city: 'batu', area: 'Junrejo' },
    { name: 'Kost Mahasiswa Dinoyo', cat: 'kost', city: 'malang', area: 'Dinoyo' },
    { name: 'Kost Murah Sunan Kalijaga', cat: 'kost', city: 'malang_kab', area: 'Tumpang' },
    { name: 'Kost Eksklusif Gubeng', cat: 'kost', city: 'surabaya', area: 'Gubeng' },
    { name: 'Kost Putri Sidoarjo', cat: 'kost', city: 'sidoarjo', area: 'Taman' },
    { name: 'Kost Harapan Jombang', cat: 'kost', city: 'jombang', area: 'Jombang Kota' },
    // Kafe — Malang majority
    ...Array(5).fill(null).map((_, i) => ({ name: `${['Kopi', 'Kopi', 'Coffee', 'Ngopi', 'Warkop'][i]} ${['Nusantara', 'Suhat', 'Klasik', 'Sunyi', 'Sore'][i]}`, cat: 'kafe' as const, city: 'malang', area: pick(AREA_MALANG) })),
    { name: 'Kafe Dst. Malang', cat: 'kafe', city: 'malang', area: 'Celaket' },
    { name: 'Milk & Honey Cafe', cat: 'kafe', city: 'malang', area: 'Lowokwaru' },
    { name: 'Kedai Mie & Kopi Surabaya', cat: 'kafe', city: 'surabaya', area: 'Tegalsari' },
    { name: 'Warkop Sidoarjo Mantab', cat: 'kafe', city: 'sidoarjo', area: 'Krian' },
    { name: 'Bakso & Coffee Batu', cat: 'kafe', city: 'batu', area: 'Batu Kota' },
    { name: 'Angkringan Cemara Kediri', cat: 'kafe', city: 'kediri', area: 'Kota Kediri' },
    // Lainnya — mixed
    { name: 'Salon Cantik Malang', cat: 'lainnya', city: 'malang', area: 'Bunul' },
    { name: 'Bengkel Jaya Motor', cat: 'lainnya', city: 'malang', area: 'Tlogomas' },
    { name: 'Studio Fitness Malang', cat: 'lainnya', city: 'malang', area: 'Suhat' },
    { name: 'Persewaan Alat Pesta', cat: 'lainnya', city: 'sidoarjo', area: 'Waru' },
    { name: 'Percetakan Murah Surabaya', cat: 'lainnya', city: 'surabaya', area: 'Rungkut' },
    { name: 'Toko Roti & Kue Blitar', cat: 'lainnya', city: 'blitar', area: 'Kota Blitar' },
    { name: 'Laundry Kiloan Malang', cat: 'lainnya', city: 'malang', area: 'Kedungkandang' },
    { name: 'Drone Fotografi Jember', cat: 'lainnya', city: 'jember', area: 'Kota Jember' },
    { name: 'Kursus Bimbingan Belajar', cat: 'lainnya', city: 'madiun', area: 'Kota Madiun' },
    { name: 'Sablon & Konveksi Gresik', cat: 'lainnya', city: 'gresik', area: 'Gresik Kota' },
  ];

  const statuses: LeadStatus[] = ['pending', 'pending', 'pending', 'sent', 'replied', 'pending'];

  return bases.slice(0, count).map((b, i) => ({
    id: `lead-${i + 1}`,
    name: b.name,
    category: b.cat,
    city: b.city,
    area: b.area,
    phone: `628${String(78000000000 + Math.floor(Math.random() * 90000000)).slice(2, 12)}`,
    status: statuses[i % statuses.length],
    rating: +(4 + Math.random()).toFixed(1),
  }));
}

export const DEFAULT_LEADS = generateMockLeads(40);