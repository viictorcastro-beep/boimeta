import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://viictorcastro-beep.github.io/boimeta'),
  title: 'BoiMeta | Simulador Agropecuário',
  icons: { icon: '/favicon.svg' },
  description:
    'Simulador técnico-econômico para dimensionar pecuária intensiva e comparar usos irrigados por hectare.',
  openGraph: {
    url: 'https://viictorcastro-beep.github.io/boimeta',
    title: 'BoiMeta',
    description: 'Simulador técnico-econômico de pecuária, soja, milho e algodão irrigados.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
