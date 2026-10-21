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
 * Fallback Ringkas & Mematikan (Micro-Pitch 2 Paragraf Pendek)
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
    return `${greeting} Tadi saya sempat lihat profil ${cleanName} di Google Maps ${city}, ${ratingPhrase} ramai sekali. Mau tanya Kak, untuk penanggung jawab atau Owner biasanya pegang nomor ini langsung atau ada kontak khusus ya?

Soalnya kebetulan kami ada buatin contoh pratinjau konsep website kilat gratis khusus untuk ${cleanName} — tujuannya biar admin nggak capek ${pain.adminPain}.

Kira-kira berkenan kalau saya kirimkan link pratinjaunya ke nomor ini untuk dilihat santai atau diteruskan ke Owner, Kak? 🙏`;
  }

  // ── Opsi 2: Mode Owner (Langsung ke Decision Maker) ────────────────────────
  return `${greeting} Saya Kevin, konsultan web lokal dari Malang. Tadi saya sempat melihat profil ${cleanName} di Google Maps daerah ${city}, ${ratingPhrase} yang aktif melayani pelanggan.

Sayang sekali tempat sebagus ini belum memiliki link profil mandiri di Google, padahal banyak pelaku usaha ${category} menghadapi kendala ${pain.ownerPain}.

Kebetulan kami sudah menyiapkan 1 contoh konsep website kilat yang ringan dibuka di HP khusus untuk ${cleanName}. Kalau kami kirimkan tautan pratinjaunya tanpa biaya untuk dilihat-lihat santai, apakah berkenan Kak? 🙏`;
}

/**
 * Generate personal B2B outreach pitch via Gemini API dengan kontrol Mode Admin vs Owner.
 */
export async function generatePersonalizedPitch(params: GeneratePitchParams): Promise<{
  message: string;
  source: 'gemini' | 'fallback' | 'claude';
  angleUsed?: string;
  timeGreeting?: 'pagi' | 'siang' | 'sore' | 'malam';
  tokensUsed?: number;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  const timeGreeting = getTimeOfDayWIB();
  const targetMode = params.targetMode || 'admin_gatekeeper';

  if (!apiKey) {
    return {
      message: getDynamicFallbackPitch(params),
      source: 'fallback',
      angleUsed: targetMode === 'admin_gatekeeper' ? 'Admin_Gatekeeper_Fallback' : 'Owner_Direct_Fallback',
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
      ? `\n- NADA BICARA MALAM HARI: Wajib gunakan nada bicara ekstra santun dan meminta maaf secara halus jika menghubungi di waktu istirahat malam.`
      : '';

  // ── Prompt Khusus Mode Admin vs Mode Owner ───────────────────────────────
  const modeSpecificPrompt =
    targetMode === 'admin_gatekeeper'
      ? `TARGET PENERIMA: ADMIN / CUSTOMER SERVICE TOKO (GATEKEEPER).
Nomor WhatsApp ini kemungkinan besar dipegang admin/kasir, BUKAN pemilik langsung.
MISI: Buat admin merasa dihargai, mengerti masalah capeknya admin menjawab chat berulang, lalu meminta izin secara sopan untuk mengirimkan link pratinjau website atau diteruskan ke Owner/PIC.

STRUKTUR PESAN (MAKSIMAL 2 PARAGRAF SINGKAT, RAMAH LAYAR HP):
Paragraf 1:
- Sapaan pembuka santun menggunakan '${timeGreeting}' kepada Kak admin.
- Puji bisnis "${cleanName}" di ${targetCity} yang ramai dengan rating ${rating > 0 ? `${rating} bintang` : 'bagus'}.
- Tanya sopan: "Mau tanya Kak admin, untuk penanggung jawab atau Owner biasanya pegang nomor ini atau ada kontak khusus ya?"

Paragraf 2:
- Jelaskan alasan: "Kebetulan kami ada buatkan contoh konsep website/katalog kilat gratis khusus untuk ${cleanName} biar admin nggak capek ${pain.adminPain}."
- CTA rendah hambatan: "Kira-kira berkenan kalau kami kirimkan link pratinjaunya ke nomor ini buat dilihat santai atau diteruskan ke Owner, Kak? 🙏"`
      : `TARGET PENERIMA: OWNER / DECISION MAKER LANGSUNG.
MISI: Hook singkat, profesional, fokus pada reputasi brand, kemudahan pelanggan, dan penawaran melihat draft website kilat cuma-cuma.

STRUKTUR PESAN (MAKSIMAL 2 PARAGRAF SINGKAT, RAMAH LAYAR HP):
Paragraf 1:
- Sapaan pembuka '${timeGreeting}', perkenalkan diri santun: "Saya Kevin, web developer lokal dari Malang."
- Apresiasi tulus reputasi "${cleanName}" di ${targetCity} (${rating > 0 ? `${rating} bintang` : 'aktif & ramai'}).

Paragraf 2:
- Sampaikan masukan konstruktif bahwa sayang sekali belum ada link resmi mandiri di Google Maps, padahal bidang ${category} sering menghadapi kendala ${pain.ownerPain}.
- Tawarkan teaser preview: "Kebetulan kami sudah siapkan 1 konsep website kilat yang ringan dibuka di HP khusus untuk ${cleanName}. Boleh izin kami bagikan tautan pratinjaunya tanpa biaya untuk dilihat santai, Kak? 🙏"`;

  const systemPrompt = `Anda adalah Kevin, seorang web developer lokal dari Jawa Timur yang santun, ramah, dan profesional. Anda sedang menulis pesan pembuka cold outreach WhatsApp yang RINGKAS, PERSONAL, dan ANTI-READ (tidak seperti robot sales).

INSTRUKSI WAKTU WIB (GMT+7):
Saat ini waktu '${timeGreeting}' di Indonesia. Sapaan pembuka WAJIB diawali waktu '${timeGreeting}'.${nightInstruction}

PROSPEK BISNIS:
- Nama: ${cleanName}
- Kategori: ${category}
- Kota: ${targetCity}
- Rating Google Maps: ${rating > 0 ? `${rating} bintang (${reviewsCount} ulasan)` : 'Aktif & Positif'}
${highlightReview ? `- Contoh ulasan nyata: "${highlightReview}"` : ''}

${modeSpecificPrompt}

ATURAN KETAT:
- PANJANG PESAN: Sangat ringkas (maksimal 70-110 kata total, tepat 2 paragraf terpisah \n\n).
- DILARANG menulis panjang berbelit-belit seperti skripsi atau email formal.
- DILARANG menggunakan kata-kata spam ("DISKON BESAR", "PROMO SPESIAL", "HARGA MURAH").
- HANYA keluarkan isi teks pesan WhatsApp yang siap kirim tanpa tanda kutip.`;

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
              {
                role: 'user',
                content: `Tulis pesan WhatsApp ringkas (tepat 2 paragraf pendek) untuk ${cleanName} sekarang. HANYA teks pesan siap kirim. Dilarang menyertakan judul atau catatan pengantar.`,
              },
            ],
            temperature: 0.65,
            max_tokens: 600,
          }),
          timeoutMs: 9000,
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

            if (cleanedText.length > 50 && cleanedText.length < 900) {
              return {
                message: cleanedText,
                source: 'claude',
                angleUsed: targetMode === 'admin_gatekeeper' ? 'Claude_Admin_Gatekeeper' : 'Claude_Owner_Direct',
                timeGreeting,
                tokensUsed: json?.usage?.total_tokens || 450,
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
                  text: `Tulis pesan WhatsApp ringkas (tepat 2 paragraf pendek) untuk ${cleanName} sekarang. HANYA teks pesan.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        }),
        timeoutMs: 8000,
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

          if (cleanedText.length > 50 && cleanedText.length < 900) {
            return {
              message: cleanedText,
              source: 'gemini',
              angleUsed: targetMode === 'admin_gatekeeper' ? 'Admin_Gatekeeper_Hook' : 'Owner_Direct_Hook',
              timeGreeting,
            };
          }
        }
      }
    } catch {
      // Coba model berikutnya
    }
  }

  return {
    message: getDynamicFallbackPitch(params),
    source: 'fallback',
    angleUsed: targetMode === 'admin_gatekeeper' ? 'Admin_Gatekeeper_Fallback' : 'Owner_Direct_Fallback',
    timeGreeting,
  };
}
