import type {Metadata} from 'next';
import './globals.css';
import {Toaster} from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Viby | Gestão Inteligente de Eventos',
  description: 'Centralize seus eventos, promova experiências e utilize IA para alavancar seus resultados.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-[#f8fafc] text-[#000000] flex flex-col min-h-screen">
        <FirebaseClientProvider>
          <div className="flex-1">
            {children}
          </div>
          <Footer />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
