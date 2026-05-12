import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { OfflineBanner } from '@/components/OfflineBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AfriHub - Trusted Business Directory for Africa',
  description: 'Discover verified local businesses, services, and products across Cameroon, Nigeria, Kenya, Ghana, and beyond. WhatsApp-first commerce with AI-powered trust scores.',
  keywords: ['African businesses', 'SME', 'directory', 'Cameroon', 'Nigeria', 'Kenya', 'Ghana', 'local commerce'],
  authors: [{ name: 'AfriHub Team' }],
  manifest: '/manifest.json',
  themeColor: '#22c55e',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OfflineBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
