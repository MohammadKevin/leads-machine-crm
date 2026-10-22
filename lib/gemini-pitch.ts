/**
 * ==============================================================================
 * HIGH-CONVERTING WHATSAPP OUTREACH ENGINE (ADMIN GATEKEEPER & OWNER MODES)
 * ==============================================================================
 * Menghasilkan pesan cold outreach WhatsApp B2B ringkas, ramah layar HP,
 * menembus tembok admin/CS toko, dan menawarkan teaser prototype instan.
 */

import { fetchWithRetry } from './defensive-client';

export type PitchTargetMode = 'admin_gatekeeper' | 'owner_direct';

export interface GeneratePitchParams {
  businessName: string;
  category: string;
  city?: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  highlightReview?: string;
  forcedAngle?: string;
  targetMode?: PitchTargetMode;
}

/**
 * Pemetaan pain-point mendalam & spesifik berdasarkan kategori usaha.
 */
function getCategorySpecificPainPoint(category: string): {
  adminPain: string;
  ownerPain: string;
} {
  const cat = category.toLowerCase();

  if (cat.includes('kos') || cat.includes('homestay') || cat.includes('villa') || cat.includes('guesthouse') || cat.includes('penginapan')) {
    return {
      adminPain: 'capek menjawab pertanyaan berulang soal ketersediaan kamar, foto fasilitas, pricelist, dan aturan menginap',
      ownerPain: 'ketergantungan potongan komisi aplikasi OTA 15-20% dan hilangnya calon tamu yang ingin pesan langsung',
    };
  }

  if (cat.includes('klinik') || cat.includes('apotek') || cat.includes('dokter') || cat.includes('gigi') || cat.includes('dental') || cat.includes('estetika') || cat.includes('kecantikan')) {
    return {
      adminPain: 'menjawab berulang kali jadwal praktik dokter, daftar jenis tindakan, estimasi biaya, dan nomor darurat',
      ownerPain: 'calon pasien ragu datang karena tidak menemukan profil dokter resmi dan daftar layanan yang jelas di Google',
    };
  }

  if (cat.includes('bengkel') || cat.includes('otomotif') || cat.includes('kontraktor') || cat.includes('arsitek') || cat.includes('interior') || cat.includes('jasa')) {
    return {
      adminPain: 'mengirimkan foto portofolio dan rincian harga satu per satu secara manual ke calon pelanggan baru',
      ownerPain: 'calon klien ragu bertransaksi karena belum ada website portofolio profesional untuk membuktikan hasil kerja nyata',
    };
  }

  if (cat.includes('cafe') || cat.includes('resto') || cat.includes('kopi') || cat.includes('bakso') || cat.includes('makan') || cat.includes('kuliner')) {
    return {
      adminPain: 'mengirimkan foto buku menu dan daftar harga berulang kali tiap ada yang tanya reservasi via chat',
      ownerPain: 'kehilangan potensi pesanan katering dan rombongan karena informasi menu belum terangkum rapi di Google',
    };
  }

  return {
    adminPain: 'menjawab chat pertanyaan umum yang sama berulang-ulang dari calon pembeli baru di Google Maps',
    ownerPain: 'belum adanya katalog informasi resmi mandiri sehingga bisnis kalah kredibel dibanding kompetitor',
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

  if (hour >= 5 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
}

/**
 * Variasi pembuka santun ramah manusia
 */
function getGreetingByTime(timeGreeting: 'pagi' | 'siang' | 'sore' | 'malam', targetMode: PitchTargetMode): string {
  if (timeGreeting === 'malam') {
    return targetMode === 'admin_gatekeeper'
      ? 'Selamat malam Kak admin, salam kenal dan mohon maaf menyapa di malam hari.'
      : 'Selamat malam Kak, salam kenal dan mohon maaf mengganggu waktu istirahatnya sebentar.';
  }

  if (targetMode === 'admin_gatekeeper') {
    const list = [
      `Halo selamat ${timeGreeting} Kak admin, salam kenal yaa.`,
      `Selamat ${timeGreeting} Kak admin, semoga harinya lancar selalu.`,
      `Halo, selamat ${timeGreeting} tim admin, salam kenal.`,
    ];
    return list[Math.floor(Math.random() * list.length)];
  }

  const list = [
    `Halo selamat ${timeGreeting} Kak, salam kenal saya Kevin.`,
    `Selamat ${timeGreeting} Kak, salam kenal dari Kevin di Jawa Timur.`,
    `Halo, selamat ${timeGreeting} tim manajemen, salam hangat.`,
  ];
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Fallback Ringkas & Terstruktur (3 Paragraf: Pujian, Masalah, Tawaran Pratinjau)
 */
export function getDynamicFallbackPitch(params: GeneratePitchParams): string {
  const {
    businessName,
    category,
    city = 'Jawa Timur',
    rating = 0,
    reviewsCount = 0,
    targetMode = 'admin_gatekeeper',
  } = params;

  const cleanName = businessName.replace(/[:\-–].*$/, '').trim() || businessName;
  const timeGreeting = getTimeOfDayWIB();
  const greeting = getGreetingByTime(timeGreeting, targetMode);
  const pain = getCategorySpecificPainPoint(category);

  const ratingPhrase =
    rating > 0
      ? `dengan rating ${rating}★${reviewsCount > 0 ? ` (${reviewsCount} ulasan)` : ''}`
      : 'yang ulasannya sangat positif';

  // ── Opsi 1: Mode Admin (Menembus Gatekeeper) ───────────────────────────────
  if (targetMode === 'admin_gatekeeper') {
    return `${greeting} Tadi saya sempat melihat profil ${cleanName} di Google Maps daerah ${city}, ${ratingPhrase} yang ramai dan banyak pelanggan puas. Mau tanya Kak admin, untuk penanggung jawab operasional atau Owner biasanya pegang nomor ini langsung atau ada kontak khusus ya?

Saya perhatikan bisnis sebagus ${cleanName} pasti aktif melayani banyak calon pelanggan tiap hari. Biasanya tim admin cukup kewalahan karena harus ${pain.adminPain} satu per satu secara manual via chat.

Maka dari itu, kami sempat merancang *sampel pratinjau konsep katalog/website interaktif* khusus untuk ${cleanName} agar pelanggan bisa langsung cek info lengkap mandiri. Sampel rancangan ini murni kami siapkan cuma-cuma sekadar untuk diintip/dilihat tampilannya di HP, tanpa ada ikatan komitmen atau biaya apapun.

Kira-kira berkenan kalau saya kirimkan tautan sampel pratinjaunya ke nomor ini untuk dicek santai atau diteruskan ke Owner, Kak? 🙏`;
  }

  // ── Opsi 2: Mode Owner (Langsung ke Decision Maker) ────────────────────────
  return `${greeting} Saya Kevin, web developer lokal dari Malang, Jawa Timur. Tadi saya sempat melihat profil ${cleanName} di Google Maps daerah ${city}, ${ratingPhrase} yang sangat bagus dan aktif melayani pelanggan.

Sebagai sesama pelaku usaha, sayang sekali bisnis dengan reputasi sebaik ini belum memiliki website profil resmi mandiri di Google Maps. Padahal di bidang ${category}, banyak pemilik usaha menghadapi kendala ${pain.ownerPain}.

Maka dari itu, saya sudah sempat menyiapkan *1 sampel pratinjau konsep website modern* yang sangat ringan dibuka di HP khusus untuk ${cleanName}. Sampel rancangan awal ini murni saya buatkan cuma-cuma sekadar untuk dilihat dan dinilai terlebih dahulu tanpa ikatan komitmen apapun.

Boleh izin saya bagikan tautan sampel pratinjaunya di sini untuk dilihat-lihat santai, Kak? 🙏`;
}

/**
 * Riset otomatis online tentang profil bisnis calon klien via Google Serper Search API
 */
export async function researchBusinessOnline(businessName: string, city?: string): Promise<{
  snippets: string[];
  knowledgeGraphText?: string;
  summaryContext: string;
}> {
  const apiKey = process.env.SERPER_API_KEY;
  const cleanName = businessName.replace(/[:\-–].*$/, '').trim() || businessName;
  const searchQuery = city ? `${cleanName} ${city}` : cleanName;

  if (!apiKey) {
    return {
      snippets: [],
      summaryContext: 'Riset live Google tidak tersedia (SERPER_API_KEY tidak dikonfigurasi). Mengandalkan analisis nama dan profil Maps.',
    };
  }

  try {
    const response = await fetchWithRetry('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: searchQuery,
        gl: 'id',
        hl: 'id',
      }),
      timeoutMs: 6000,
      retries: 1,
    });

    if (!response.ok) {
      return {
        snippets: [],
        summaryContext: `Pencarian web Serper menghasilkan status ${response.status}.`,
      };
    }

    const data = await response.json();
    const organic = Array.isArray(data.organic) ? data.organic : [];
    const snippets: string[] = [];

    // Ambil maksimal 4 snippet paling relevan
    for (const item of organic.slice(0, 4)) {
      if (item.title && item.snippet) {
        snippets.push(`- [${item.title}]: ${item.snippet}`);
      }
    }

    let kgText = '';
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      kgText = [
        kg.title ? `Nama Resmi: ${kg.title}` : '',
        kg.type ? `Jenis: ${kg.type}` : '',
        kg.description ? `Deskripsi: ${kg.description}` : '',
        kg.attributes ? JSON.stringify(kg.attributes) : '',
      ].filter(Boolean).join(' | ');
    }

    const summaryContext = [
      kgText ? `Knowledge Graph Google: ${kgText}` : '',
      snippets.length > 0 ? `Temuan Web Organik:\n${snippets.join('\n')}` : '',
    ].filter(Boolean).join('\n\n') || 'Tidak ada data web spesifik yang ditemukan di Google.';

    return {
      snippets,
      knowledgeGraphText: kgText,
      summaryContext,
    };
  } catch {
    return {
      snippets: [],
      summaryContext: 'Pencarian web dilewati karena timeout jaringan.',
    };
  }
}

/**
 * Generate personal B2B outreach pitch via Claude 3.5 / Gemini API dengan kontrol Mode Admin vs Owner.
 * Menggunakan pendekatan "Riset Dulu Baru Susun Pesan" (Research-First Copywriting).
 */
export async function generatePersonalizedPitch(params: GeneratePitchParams): Promise<{
  message: string;
  source: 'gemini' | 'fallback' | 'claude';
  angleUsed?: string;
  timeGreeting?: 'pagi' | 'siang' | 'sore' | 'malam';
  tokensUsed?: number;
  researchSnippets?: string[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  const timeGreeting = getTimeOfDayWIB();
  const targetMode = params.targetMode || 'admin_gatekeeper';

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

  // ── Jalankan Riset Live Web Terlebih Dahulu ───────────────────────────────
  const research = await researchBusinessOnline(cleanName, targetCity);

  const nightInstruction =
    timeGreeting === 'malam'
      ? `\n- NADA BICARA MALAM HARI: Wajib gunakan nada bicara ekstra santun dan meminta maaf secara halus jika menghubungi di waktu istirahat malam.`
      : '';

  const systemPrompt = `Anda adalah Kevin, seorang web developer lokal profesional dari Jawa Timur yang santun, ramah, dan sangat cerdas dalam memahami model bisnis lokal.
Tugas Anda adalah meriset dan memahami calon klien terlebih dahulu, lalu menuliskan pesan cold outreach WhatsApp pembuka B2B (minimal 3 paragraf terpisah) yang 100% UNIK, PERSONAL, dan ANTI-TEMPLATE.

PRINSIP WAJIB:
1. DILARANG MENGGUNAKAN TEMPLATE KLISE ATAU POLA HAFALAN!
   Setiap usaha memiliki keunikan, lokasi, fasilitas, produk unggulan, dan masalah operasional yang BERBEDA. Dilarang memakai kalimat seragam.
2. ANALISIS & REKONSTRUKSI MASALAH BISNIS SECARA NYATA:
   Berdasarkan profil usaha dan hasil temuan riset web di bawah, tebak dan angkat 2-3 contoh pertanyaan berulang atau kerepotan operasional yang PALING MENGURAS WAKTU admin/owner bisnis ini setiap hari.
   (Contoh kos: ketersediaan kamar AC/pasutri, parkir mobil, foto kamar mandi dalam. Contoh klinik: jadwal dokter, biaya tambal/scaling, antrean. Contoh interior: estimasi biaya per meter, survey lokasi, portofolio rumah 2 lantai).
3. STRUKTUR 3 PARAGRAF BERMUTU TINGGI:
   - Paragraf 1 (Pembuka & Pujian Spesifik): Sapaan '${timeGreeting}' santun. Sebutkan fakta spesifik yang Anda temukan dari riset (nama jalan/lokasi, fasilitas, akses strategis, atau reputasi nyata dari ulasan pelanggan) yang membuktikan Anda benar-benar meriset tempat mereka. Tanyakan penanggung jawab secara sopan.
   - Paragraf 2 (Empati Masalah & Analisis Riil): Mengulas tuntas kerepotan admin mengulang-ulang jawaban pertanyaan yang sama lewat chat secara manual, atau risiko kehilangan calon pelanggan yang tanya di luar jam operasional karena belum ada katalog informasi resmi mandiri.
   - Paragraf 3 (Tawaran Sampel Pratinjau Desain & CTA Santun): Sampaikan bahwa Anda sudah mencoba merancang *sampel pratinjau konsep katalog/website interaktif* yang ringan dibuka di HP khusus untuk ${cleanName}.
     PERINGATAN KERAS ANTI-SALAH PAHAM: Tegaskan dengan jelas dan lugas bahwa yang disiapkan cuma-cuma/bebas biaya HANYA "sampel pratinjau konsep rancangannya" untuk sekadar diintip dan dilihat dulu di HP tanpa biaya dan tanpa ikatan komitmen apa pun — BUKAN pembuatan websitenya yang gratis.
4. GAYA BAHASA: Bahasa Indonesia profesional, luwes, hangat, khas anak muda Jawa Timur yang sopan. Dilarang kata-kata spam murahan.
5. HANYA keluarkan isi teks pesan WhatsApp yang siap kirim tanpa tanda kutip, tanpa judul, dan tanpa catatan pembuka/penutup.`;

  const userPrompt = `Lakukan riset bisnis dan tulis pesan WhatsApp pembuka untuk bisnis ini:
Nama Bisnis: ${cleanName}
Kategori Usaha: ${category}
Kota / Wilayah: ${targetCity} ${address ? `(${address})` : ''}
Rating Google Maps: ${rating > 0 ? `${rating} bintang (${reviewsCount} ulasan)` : 'Aktif melayani pelanggan'}
${highlightReview ? `Contoh ulasan pelanggan: "${highlightReview}"` : ''}
Target Penerima: ${targetMode === 'admin_gatekeeper' ? 'Lewat Admin / Customer Service (admin_gatekeeper)' : 'Langsung ke Owner / Pemilik (owner_direct)'}

HASIL TEMUAN RISET GOOGLE & WEB NYATA:
${research.summaryContext}

Instruksi Khusus:
- Analisis data riset di atas untuk merangkai pesan yang terasa 'sangat paham tempat mereka'.
- Tuliskan pesan WhatsApp minimal 3 paragraf sekarang:`;

  // ── 1. PRIORITAS UTAMA: Claude 3.5 Sonnet via GeraiKita AI ───────────────────
  const geraiKitaKey = process.env.GERAIKITA_API_KEY;
  if (geraiKitaKey) {
    const geraiKitaBaseUrl = process.env.GERAIKITA_BASE_URL || 'https://ai.geraikita.com/v1';
    const claudeModels = [process.env.GERAIKITA_MODEL || 'claude-sonnet-4-6', 'claude-sonnet-5'];

    for (const claudeModel of claudeModels) {
      try {
        const response = await fetchWithRetry(`${geraiKitaBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${geraiKitaKey}`,
          },
          body: JSON.stringify({
            model: claudeModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 950,
          }),
          timeoutMs: 14000,
          retries: 1,
        });

        if (response.ok) {
          const json = await response.json();
          const rawText = json?.choices?.[0]?.message?.content || '';
          if (rawText && typeof rawText === 'string') {
            const cleanedText = rawText
              .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
              .replace(/^(\*\*Pesan.*?\*\*|---)/gim, '')
              .trim()
              .replace(/^["']|["']$/g, '');

            if (cleanedText.length > 80 && cleanedText.length < 1800) {
              return {
                message: cleanedText,
                source: 'claude',
                angleUsed: targetMode === 'admin_gatekeeper' ? 'Claude_Research_Admin_Gatekeeper' : 'Claude_Research_Owner_Direct',
                timeGreeting,
                tokensUsed: json?.usage?.total_tokens || 580,
                researchSnippets: research.snippets,
              };
            }
          }
        }
      } catch {
        // Coba model Claude berikutnya atau lanjut ke Gemini
      }
    }
  }

  // ── 2. CADANGAN: Google Gemini AI ──────────────────────────────────────────
  if (apiKey) {
    const modelsToTry = [
      'gemini-2.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
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
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
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

            if (cleanedText.length > 80 && cleanedText.length < 1800) {
              return {
                message: cleanedText,
                source: 'gemini',
                angleUsed: targetMode === 'admin_gatekeeper' ? 'Gemini_Research_Admin_Gatekeeper' : 'Gemini_Research_Owner_Direct',
                timeGreeting,
                researchSnippets: research.snippets,
              };
            }
          }
        }
      } catch {
        // Coba model berikutnya
      }
    }
  }

  return {
    message: getDynamicFallbackPitch(params),
    source: 'fallback',
    angleUsed: targetMode === 'admin_gatekeeper' ? 'Admin_Gatekeeper_Fallback_3P' : 'Owner_Direct_Fallback_3P',
    timeGreeting,
    researchSnippets: research.snippets,
  };
}


