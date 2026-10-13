import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Outreach Engine — Leads Machine',
  description:
    'Temukan prospek bisnis lokal, buat pesan personal dengan AI, dan kirim via WhatsApp otomatis — 100% anti-duplikasi berbasis Google Sheets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="h-full w-full overflow-hidden bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
