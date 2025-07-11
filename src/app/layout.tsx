import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-provider';
import { ThemeProvider } from '@/contexts/theme-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Toaster } from "@/components/ui/toaster";
import BottomNavBar from '@/components/bottom-nav-bar';
import { ClientSecurityInitializer } from '@/components/client-security-initializer';
import GridBackground from '@/components/GridBackground';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: "Daily Hacklab",
  description: "Share and discover daily projects and activities from Hacklab members.",
  icons: {
    icon: [
      { url: '/images/favicons/favicon.ico' },
      { url: '/images/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/images/favicons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome-192x192', url: '/images/favicons/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/images/favicons/android-chrome-512x512.png' },
    ],
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

/**
 * RootLayout component.
 * This is the main layout for the application, wrapping all pages.
 * It sets up global providers like AuthProvider and ThemeProvider,
 * and includes common UI elements like Header, Footer, and Toaster.
 * @param {Readonly<{ children: React.ReactNode }>} props - The props for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the layout.
 * @returns {JSX.Element} The root layout structure.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head />
      <body className="font-body antialiased flex flex-col min-h-screen bg-background text-foreground overflow-x-hidden" suppressHydrationWarning={true}>
        <ClientSecurityInitializer />
        <ThemeProvider storageKey="daily-hacklab-theme">
          <AuthProvider>
            <GridBackground />
            <Header />
            <main className="flex-grow flex flex-col pb-16 md:pb-0"> {/* pb for BottomNavBar */}
              {children}
            </main>
            <BottomNavBar />
            <Footer />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
