"use client"

import Link from "next/link"
import { useAuth } from "./context/AuthContext"

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      fontFamily: "Arial, sans-serif",
      padding: 40,
      color: "white",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <h1 style={{ fontSize: 56, marginBottom: 10 }}>🎵</h1>
      <h1 style={{ fontSize: 40, margin: 0 }}>GitHub para Músicos</h1>
      <p style={{ fontSize: 20, color: "#a78bfa", marginTop: 10 }}>
        Colabora, comparte y crea música con otros músicos
      </p>
      
      <div style={{ display: "flex", gap: 20, marginTop: 40 }}>
        <Link href="/explore">
          <button style={{ padding: "14px 32px", background: "#7c3aed", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 18 }}>
            🌍 Explorar proyectos
          </button>
        </Link>
        {user ? (
          <Link href="/dashboard">
            <button style={{ padding: "14px 32px", background: "#22c55e", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 18 }}>
              🎸 Mis proyectos
            </button>
          </Link>
        ) : (
          <Link href="/login">
            <button style={{ padding: "14px 32px", background: "#3b82f6", color: "white", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 18 }}>
              🔑 Iniciar sesión
            </button>
          </Link>
        )}
      </div>
    </div>
  )
}
