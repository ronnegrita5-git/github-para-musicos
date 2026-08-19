"use client"

import { useAuth } from "../context/AuthContext"
import Link from "next/link"

export default function ExplorePage() {
  const { user } = useAuth()

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: 32 }}>🔍 Explorar</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>Encuentra músicos y salas para tocar</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link href="/discover" style={{ padding: "16px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", textDecoration: "none", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: 24 }}>🎵</span>
              <div>
                <div style={{ fontWeight: "bold" }}>Descubrir Jams</div>
                <div style={{ fontSize: 14, color: "#6b7280" }}>Ver todas las salas públicas en vivo</div>
              </div>
            </div>
          </Link>

          <Link href="/jam-web" style={{ padding: "16px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", textDecoration: "none", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: 24 }}>🎸</span>
              <div>
                <div style={{ fontWeight: "bold" }}>Crear/Unirse a Sala</div>
                <div style={{ fontSize: 14, color: "#6b7280" }}>Iniciar una nueva Jam o unirte a una existente</div>
              </div>
            </div>
          </Link>

          {user ? (
            <div style={{ padding: "16px 20px", background: "rgba(16,185,129,0.05)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.1)" }}>
              <div style={{ fontSize: 14, color: "#10b981" }}>✅ Conectado como {user.email}</div>
            </div>
          ) : (
            <Link href="/login" style={{ padding: "16px 20px", background: "rgba(251,191,36,0.05)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.1)", textDecoration: "none", color: "#fbbf24" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: 24 }}>🔒</span>
                <div>
                  <div style={{ fontWeight: "bold" }}>Iniciar sesión</div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>Inicia sesión para unirte a las Jams</div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
