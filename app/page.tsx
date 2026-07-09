"use client"

import Link from "next/link"
import { useAuth } from "./context/AuthContext"

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0a 0%, #0f1a14 50%, #0a0a0a 100%)",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 700 }}>
        <span style={{ fontSize: 72, display: "block", marginBottom: 16 }}>🎵</span>
        <h1 style={{ 
          fontSize: 48, 
          fontWeight: 800, 
          margin: 0,
          background: "linear-gradient(135deg, #10b981, #34d399, #6ee7b7)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          GitHub para Músicos
        </h1>
        <p style={{ fontSize: 20, color: "#9ca3af", marginTop: 12 }}>
          Colabora, comparte y crea música con otros músicos
        </p>
        
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 40, flexWrap: "wrap" }}>
          <Link href="/explore">
            <button className="btn-primary" style={{ fontSize: 16, padding: "14px 36px" }}>
              🌍 Explorar proyectos
            </button>
          </Link>
          {user ? (
            <Link href="/dashboard">
              <button className="btn-secondary" style={{ fontSize: 16, padding: "14px 36px" }}>
                🎸 Mis proyectos
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button className="btn-secondary" style={{ fontSize: 16, padding: "14px 36px" }}>
                🔑 Iniciar sesión
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
