import { AuthProvider } from '@/lib/auth-context';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';
import Script from "next/script";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'GuardaTrades | Professional Trade Execution',
  description: 'Real-time market connectivity and trade synchronization platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <Script
          id="orchids-browser-logs"
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts/orchids-browser-logs.js"
          strategy="afterInteractive"
          data-orchids-project-id="4bf4b93e-04ca-4fad-b5ef-d4bf6c17da1e"
        />
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
