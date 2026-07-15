import type { Metadata } from "next";
import AuthProvider from "./context/AuthContext";
import UserStatus from "./components/UserStatus";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GitHub para Músicos",
  description: "Plataforma de colaboración musical",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body style={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        background: 'black',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <AuthProvider>
          <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Link href="/" style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#10b981',
              textDecoration: 'none'
            }}>
              🎵 Music Collab
            </Link>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Link href="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inicio</Link>
              <Link href="/explore" style={{ color: '#9ca3af', textDecoration: 'none' }}>Proyectos</Link>
              <UserStatus />
            </div>
          </nav>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
