/**
 * ==============================================================================
 * ZERO-TEMPLATE DYNAMIC GEMINI AI COPYWRITING ENGINE (DEEP VALUE 4-PARAGRAPH)
 * ==============================================================================
 * Menghasilkan pesan cold outreach WhatsApp B2B berbobot, mendalam, dan memiliki
 * alur pesan yang jelas (4 paragraf mengalir) dari nol tanpa template kaku.
 */

import { fetchWithRetry } from './defensive-client';

export interface GeneratePitchParams {
  businessName: string;
  category: string;
  city?: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  highlightReview?: string;
  forcedAngle?: string;
}

/**
 * Pemetaan pain-point mendalam & spesifik berdasarkan kategori usaha.
 */
function getCategorySpecificPainPoint(category: string): {
  coreProblem: string;
  concreteExamples: string;
} {
  const cat = category.toLowerCase();

  if (cat.includes('kos') || cat.includes('homestay') || cat.includes('villa') || cat.includes('guesthouse') || cat.includes('penginapan')) {
    return {
      coreProblem: 'ketergantungan pada komisi potongan platform pihak ketiga (OTA) serta admin yang kewalahan menjawab chat berulang dari calon tamu',
      concreteExamples: 'calon tamu sering bertanya berulang-ulang soal ketersediaan kamar, foto fasilitas, aturan menginap, dan daftar harga/pricelist terbaru yang sebenarnya bisa dilihat mandiri',
    };
  }

  if (cat.includes('klinik') || cat.includes('apotek') || cat.includes('dokter') || cat.includes('gigi') || cat.includes('dental') || cat.includes('estetika') || cat.includes('kecantikan')) {
    return {
      coreProblem: 'calon pasien sering kebingungan mencari kepastian informasi layanan resmi sebelum datang ke lokasi',
      concreteExamples: 'pasien sering kesulitan memastikan jadwal praktik dokter jaga/spesialis, daftar jenis layanan atau poli yang tersedia, maupun daftar obat dan nomor kontak darurat',
    };
  }

  if (cat.includes('bengkel') || cat.includes('otomotif') || cat.includes('kontraktor') || cat.includes('arsitek') || cat.includes('interior') || cat.includes('jasa')) {
    return {
      coreProblem: 'calon klien kesulitan melihat portofolio hasil pengerjaan nyata dan rekam jejak profesional sebelum memutuskan untuk memesan',
      concreteExamples: 'calon pelanggan ragu atau butuh waktu lama karena tidak bisa mengecek galeri hasil kerja sebelumnya, testimoni klien terdahulu, maupun estimasi rincian biaya secara transparan',
    };
  }

  if (cat.includes('bimbel') || cat.includes('kursus') || cat.includes('sekolah') || cat.includes('les') || cat.includes('belajar')) {
    return {
      coreProblem: 'orang tua murid dan calon siswa kesulitan mempelajari program belajar secara mandiri sebelum mendaftar',
      concreteExamples: 'pertanyaan berulang terkait kurikulum belajar, jadwal sesi kelas, kualifikasi pengajar, serta rincian biaya pendaftaran yang harus selalu dijelaskan manual satu per satu',
    };
  }

  if (cat.includes('pabrik') || cat.includes('manufaktur') || cat.includes('perusahaan') || cat.includes('distributor') || cat.includes('suplier') || cat.includes('logistik')) {
    return {
      coreProblem: 'calon mitra bisnis dan buyer B2B mencari profil kapabilitas perusahaan dan legalitas resmi sebelum menjalin kerja sama',
      concreteExamples: 'rekan bisnis kesulitan memvalidasi katalog produk, kapasitas suplai, rekam jejak kerja sama, serta kontak langsung PIC pengadaan/sales korporat secara kredibel',
    };
  }

  return {
    coreProblem: 'calon pelanggan yang menemukan profil di Google Maps tidak menemukan katalog informasi mandiri yang lengkap sehingga harus bertanya berulang-ulang via chat',
    concreteExamples: 'calon pembeli ragu karena belum ada link resmi yang merangkum daftar produk, layanan, jam operasional, dan keunggulan tempat ini secara profesional',
  };
}

/**
 * Ambil jam saat ini di zona waktu WIB (Asia/Jakarta)
 */
export function getTimeOfDayWIB(): 'pagi' | 'siang' | 'sore' | 'malam' {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false,
  };
  const hour = parseInt(new Intl.DateTimeFormat('id-ID', options).format(now), 10);

  if (hour >= 5 && hour < 11) {
    return 'pagi';
  } else if (hour >= 11 && hour < 15) {
    return 'siang';
  } else if (hour >= 15 && hour < 18) {
    return 'sore';
  } else {
    return 'malam'; // Pukul 18.00 sampai 04.59 WIB
  }
}

/**
 * Variasi pembuka santun sesuai waktu lokal WIB dan konteks Jawa Timur.
 */
function getGreetingByTime(timeGreeting: 'pagi' | 'siang' | 'sore' | 'malam', businessName?: string): string {
  if (timeGreeting === 'malam') {
    const nightGreetings = [
      'Selamat malam Kak, mohon maaf mengganggu waktu istirahatnya sebentar.',
      `Halo selamat malam tim ${businessName || 'bisnis'}, salam kenal dan mohon maaf menghubungi di waktu istirahat malam.`,
      'Selamat malam Kak, salam kenal dan mohon maaf menyapa di malam hari.',
    ];
    return nightGreetings[Math.floor(Math.random() * nightGreetings.length)];
  }

  const greetingsMap: Record<'pagi' | 'siang' | 'sore', string[]> = {
    pagi: [
      'Selamat pagi Kak, salam kenal.',
      `Halo, selamat pagi tim ${businessName || 'bisnis'}, salam kenal.`,
      'Selamat pagi Kak, semoga harinya diawali dengan lancar.',
    ],
    siang: [
      'Selamat siang Kak, semoga harinya lancar selalu.',
      `Halo, selamat siang tim ${businessName || 'bisnis'}, salam kenal.`,
      'Selamat siang Kak, salam hangat dari kami.',
    ],
    sore: [
      'Selamat sore Kak, salam kenal ya.',
      `Halo, selamat sore tim ${businessName || 'bisnis'}, salam kenal.`,
      'Selamat sore Kak, salam hangat dari kami.',
    ],
  };

  const options = greetingsMap[timeGreeting] || greetingsMap.pagi;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Fallback dinamis 4 paragraf lengkap jika Gemini API offline / batas kuota.
 */
export function getDynamicFallbackPitch(params: GeneratePitchParams): string {
  const {
    businessName,
    category,
    city = 'Jawa Timur',
    rating = 0,
    reviewsCount = 0,
  } = params;

  const cleanName = businessName.replace(/[:\-–].*$/, '').trim() || businessName;
  const timeGreeting = getTimeOfDayWIB();
  const greeting = getGreetingByTime(timeGreeting, cleanName);
  const pain = getCategorySpecificPainPoint(category);

  const ratingPhrase =
    rating > 0
      ? `dengan rating ${rating}★${reviewsCount > 0 ? ` dari ${reviewsCount} ulasan` : ''} yang sangat baik dan terlihat aktif melayani pelanggan`
      : 'yang terlihat sangat aktif dan memiliki reputasi bagus melayani pelanggan';

  return `${greeting} Perkenalkan saya Kevin, web developer lokal dari Malang / Jawa Timur. Tadi saya sempat melihat profil ${cleanName} di Google Maps daerah ${city}, ${ratingPhrase}.

Sayang sekali tempat sebagus dan seaktif ini belum memiliki link katalog atau web profil resmi mandiri yang bisa langsung diakses calon pelanggan di Google. Banyak pelaku usaha di bidang ${category} sering menghadapi kendala di mana ${pain.coreProblem} — terutama ${pain.concreteExamples}.

Oleh karena itu, kami ingin membantu membuatkan halaman website profil kilat yang bersih, sangat ringan dibuka di HP, memuat galeri foto/layanan/fasilitas lengkap, dan tombolnya langsung mengarah ke chat WhatsApp ini untuk pemesanan atau tanya jawab. Dengan begitu, pertanyaan berulang bisa terjawab otomatis dan bisnis terlihat jauh lebih profesional serta terpercaya di mata calon pelanggan baru.

Kebetulan kami sedang menyiapkan beberapa contoh konsep desain untuk pelaku usaha di ${city}. Kira-kira kalau kami buatkan pratinjau atau demonya dulu tanpa biaya, apakah berkenan kami kirimkan tautannya ke nomor ini untuk dilihat-lihat santai, Kak?`;
}

/**
 * Generate personal B2B outreach pitch via Gemini API dengan struktur 4 paragraf mendalam.
 */
export async function generatePersonalizedPitch(params: GeneratePitchParams): Promise<{
  message: string;
  source: 'gemini' | 'fallback';
  angleUsed?: string;
  timeGreeting?: 'pagi' | 'siang' | 'sore' | 'malam';
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  const timeGreeting = getTimeOfDayWIB();

  if (!apiKey) {
    return {
      message: getDynamicFallbackPitch(params),
      source: 'fallback',
      angleUsed: 'DeepValue_Fallback',
      timeGreeting,
    };
  }

  const {
    businessName,
    category,
    city = 'Jawa Timur',
    address = '',
    rating = 0,
    reviewsCount = 0,
    highlightReview = '',
  } = params;

  const cleanName = businessName.replace(/[:\-–].*$/, '').trim() || businessName;
  const targetCity = city || address || 'Jawa Timur';
  const pain = getCategorySpecificPainPoint(category);

  const nightInstruction =
    timeGreeting === 'malam'
      ? `\n- NADA BICARA KHUSUS MALAM HARI: Karena saat ini terdeteksi waktu MALAM di Indonesia, WAJIB gunakan nada bicara ekstra santun dan meminta maaf secara halus jika menghubungi di malam hari / waktu istirahat (contoh pembuka: "Selamat malam kak, mohon maaf mengganggu waktu istirahatnya sebentar..." atau "Halo selamat malam tim ${cleanName}, salam kenal...").`
      : '';

  const systemPrompt = `Anda adalah Kevin, seorang konsultan web dan otomasi bisnis lokal dari Malang / Jawa Timur. Anda sedang menulis pesan WhatsApp cold outreach B2B yang mendalam, berbobot, santun, dan mengalir secara alami kepada pemilik atau pengelola bisnis "${cleanName}" (${category}) di ${targetCity}.

INSTRUKSI WAKTU LOKAL (WIB / GMT+7):
Saat ini adalah waktu ${timeGreeting} di Indonesia. Sapaan pembuka WAJIB menyesuaikan waktu ini (misalnya: Selamat ${timeGreeting} kak... atau Halo, selamat ${timeGreeting} tim [Nama Bisnis]...). DILARANG menggunakan sapaan selain '${timeGreeting}'.${nightInstruction}

DATA PROSPEK BISNIS:
- Nama Tempat: ${cleanName}
- Kategori Niche: ${category}
- Lokasi / Kota: ${targetCity}
- Rating Google Maps: ${rating > 0 ? `${rating} bintang` : 'Aktif & Positif'} (${reviewsCount} ulasan)
${highlightReview ? `- Contoh Ulasan Pelanggan: "${highlightReview}"` : ''}
- Problem Khas Bidang Ini: ${pain.coreProblem} (${pain.concreteExamples})

STRUKTUR WAJIB PESAN (4 PARAGRAF MENGALIR SECARA NATURAL):
Setiap pesan WAJIB memiliki 4 paragraf utuh yang dipisahkan oleh pemisah baris ganda (\\n\\n). Jangan dibuat terburu-buru atau terlalu pendek.

PARAGRAF 1 — Salam Hangat & Apresiasi Nyata (Basa-basi Kontekstual):
- Sapaan pembuka WAJIB menggunakan waktu "${timeGreeting}" (misalnya: Selamat ${timeGreeting} kak... atau Halo, selamat ${timeGreeting} tim [Nama Bisnis]...). DILARANG menggunakan sapaan selain '${timeGreeting}'.${timeGreeting === 'malam' ? ' Wajib minta maaf secara halus jika menghubungi di malam hari.' : ''}
- Perkenalkan diri secara santun: "Saya Kevin, web developer lokal dari Malang / Jawa Timur."
- Puji bisnis mereka secara spesifik berdasarkan profil Google Maps mereka: sebutkan nama tempat "${cleanName}", lokasi kota "${targetCity}", serta ulasan positif/keaktifannya melayani pelanggan dengan tulus.

PARAGRAF 2 — Identifikasi Masalah Nyata (Pain Point Spesifik Sesuai Kategori):
- Sampaikan dengan nada masukan konstruktif yang tulus bahwa sayang sekali tempat sebagus ini belum memiliki link katalog atau web profil resmi mandiri yang bisa langsung diakses calon pelanggan di Google.
- Bedah problem nyata sesuai kategori ${category}:
  * Jika Kos / Homestay / Villa: sering menjawab pertanyaan yang sama berulang-ulang via chat (ketersediaan kamar, foto fasilitas, aturan, pricelist), atau ketergantungan komisi potongan OTA.
  * Jika Klinik / Apotek: calon pasien bingung mencari kepastian jadwal dokter, jenis layanan/poli, atau daftar obat dan kontak darurat.
  * Jika Bengkel / Kontraktor / Jasa: calon klien kesulitan melihat rekam jejak, portofolio hasil kerja, dan daftar estimasi biaya sebelum memutuskan memesan.
  * Jika Bimbel / Kursus: orang tua/siswa bingung mengecek kurikulum, jadwal les, fasilitas, dan biaya pendaftaran.
  * Jika Perusahaan / Manufaktur / Logistik: calon buyer/mitra mencari profil kapabilitas perusahaan, legalitas, katalog produk dan kontak PIC.

PARAGRAF 3 — Solusi Praktis yang Membantu:
- Jelaskan solusi konkret: kami membantu membuatkan halaman website profil kilat yang bersih, ringan dibuka di HP, memuat foto/layanan/fasilitas lengkap, dan tombolnya langsung mengarah ke chat WhatsApp ini untuk pemesanan atau konsultasi.
- Efek nyata: menjawab pertanyaan berulang secara otomatis serta membuat bisnis terlihat jauh lebih profesional, kredibel, dan terpercaya di mata calon pelanggan baru.

PARAGRAF 4 — Call to Action (CTA) Santai & Rendah Hambatan:
- Jangan jualan agresif. Tawarkan bantuan pembuatan pratinjau desain atau demo cuma-cuma terlebih dahulu.
- Contoh penutup: "Kebetulan kami sedang menyiapkan beberapa contoh konsep desain untuk pelaku usaha di ${targetCity}. Kira-kira kalau kami buatkan pratinjau atau demonya dulu tanpa biaya, apakah berkenan kami kirimkan tautannya ke nomor ini untuk dilihat-lihat santai, Kak?"

ATURAN KETAT COPYWRITING & FORMAT:
- WAJIB gunakan pemisah baris ganda (\\n\\n) antar paragraf agar mudah dibaca di layar HP (tepat 4 paragraf terpisah).
- Sapaan pembuka WAJIB menggunakan '${timeGreeting}'. DILARANG menggunakan selain '${timeGreeting}'.
- Nada bicara: Ramah, santun, profesional, rendah hati (seperti obrolan konsultatif antar pelaku usaha, BUKAN sales robotik).
- DILARANG menggunakan kata-kata spam seperti: "DISKON 50%", "PROMO SPESIAL", "MURAH MERIAH", atau simbol tanda seru berlebihan.
- Variasikan kalimat pembuka dan kata hubung di setiap nomor target agar alami dan aman dari deteksi spam WhatsApp.
- HANYA keluarkan isi teks pesan WhatsApp yang siap kirim. Tanpa tanda kutip di awal/akhir, tanpa teks pengantar ("Tentu, ini pesannya:"), dan tanpa tanda tangan formal.`;

  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
  ];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Tuliskan pesan WhatsApp cold outreach B2B untuk ${cleanName} (${category}) di ${targetCity} sekarang sesuai seluruh aturan di atas. HANYA keluarkan teks pesan akhir.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.72,
            maxOutputTokens: 2500,
          },
        }),
        timeoutMs: 9000,
        retries: 1,
      });

      if (response.ok) {
        const json = await response.json();
        const parts = json.candidates?.[0]?.content?.parts || [];
        const textPart =
          parts.find((p: { text?: string; thought?: boolean }) => !p.thought && typeof p.text === 'string')?.text ||
          parts[parts.length - 1]?.text ||
          parts[0]?.text;

        if (textPart && typeof textPart === 'string') {
          const cleanedText = textPart
            .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
            .trim()
            .replace(/^["']|["']$/g, '');

          if (cleanedText.length > 150) {
            return {
              message: cleanedText,
              source: 'gemini',
              angleUsed: 'DeepValue_B2B_4Para',
              timeGreeting,
            };
          }
        }
      }
    } catch {
      // Coba model berikutnya jika model gagal
    }
  }

  return {
    message: getDynamicFallbackPitch(params),
    source: 'fallback',
    angleUsed: 'DeepValue_Fallback',
    timeGreeting,
  };
}
