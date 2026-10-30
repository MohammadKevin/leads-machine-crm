import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Leads Machine — Sales Engine',
  description:
    'Mesin akuisisi klien high-ticket untuk web developer freelance di Jawa Timur.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="h-full w-full overflow-hidden bg-[#F7F6F2] text-[#1B1B18] antialiased">
        {children}
      </body>
    </html>
  );
}
