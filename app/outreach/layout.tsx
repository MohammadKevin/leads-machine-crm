import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Cold Outreach Engine',
  description: 'Internal tool untuk mengelola leads UMKM Jatim dan generate draft pesan penawaran via AI.',
};

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}