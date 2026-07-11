import type { Metadata } from "next";
import AuthProvider from "./context/AuthContext";

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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
