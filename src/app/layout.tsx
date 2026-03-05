
import type {Metadata} from 'next';
import './globals.css';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AuthCheck } from '@/components/AuthCheck';

export const metadata: Metadata = {
  title: 'Análisis de OC/OT de Walmart',
  description: 'Sistema de análisis estratégico de órdenes y cambios para Walmart',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthCheck>
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </AuthCheck>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
