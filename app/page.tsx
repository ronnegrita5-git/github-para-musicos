"use client"

import { useAuth } from "./context/AuthContext"
import Link from "next/link"

export default function HomePage() {
  const { user, signOut } = useAuth()

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>🎵 Jam Sessions</h1>
        <p style={{ color: "#6b7280", marginBottom: 32 }}>Toca música en vivo con músicos de todo el mundo</p>

        {user ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "16px" }}>
              <p>👋 Hola, {user.email}</p>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link href="/discover" style={{ padding: "12px 24px", background: "#10b981", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: "bold" }}>
                🎵 Descubrir Jams
              </Link>
              <Link href="/jam-web" style={{ padding: "12px 24px", background: "#8b5cf6", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: "bold" }}>
                🎸 Crear/Unirse a Sala
              </Link>
              <Link href="/midi" style={{ padding: "12px 24px", background: "rgba(251,191,36,0.1)", color: "#fbbf24", borderRadius: 8, textDecoration: "none", fontWeight: "bold", border: "1px solid rgba(251,191,36,0.2)" }}>
                🎹 MIDI Studio
              </Link>
              <Link href="/projects" style={{ padding: "12px 24px", background: "rgba(139,92,246,0.1)", color: "#8b5cf6", borderRadius: 8, textDecoration: "none", fontWeight: "bold", border: "1px solid rgba(139,92,246,0.2)" }}>
                📁 Proyectos
              </Link>
              <button onClick={signOut} style={{ padding: "12px 24px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, cursor: "pointer" }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "12px" }}>
            <Link href="/login" style={{ padding: "12px 24px", background: "#10b981", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: "bold" }}>
              Iniciar sesión
            </Link>
            <Link href="/register" style={{ padding: "12px 24px", background: "rgba(255,255,255,0.05)", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: "bold" }}>
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
