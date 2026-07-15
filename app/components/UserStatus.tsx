"use client"

import { useAuth } from "../context/AuthContext"
import Link from "next/link"

export default function UserStatus() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <span style={{ color: "#6b7280", fontSize: 14 }}>⏳ Cargando...</span>
  }

  if (user) {
    const displayName = user.first_name || user.email.split('@')[0]
    
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ 
          color: "#10b981", 
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          🟢 <strong>{displayName}</strong>
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: "normal" }}>
            ({user.email})
          </span>
        </span>
        <button
          onClick={signOut}
          style={{
            padding: "6px 14px",
            background: "rgba(239,68,68,0.15)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.25)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.15)"
          }}
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ color: "#6b7280", fontSize: 13 }}>
        🔴 No logueado
      </span>
      <Link
        href="/login"
        style={{
          padding: "8px 18px",
          background: "#10b981",
          color: "white",
          borderRadius: 6,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: "600",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#059669"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#10b981"
        }}
      >
        🔑 Iniciar sesión
      </Link>
    </div>
  )
}
