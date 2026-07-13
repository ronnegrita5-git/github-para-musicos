"use client"

import { useState } from "react"
import { useAuth } from "../../context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

export default function NewProjectPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert("Debes iniciar sesión")
      return
    }

    if (!name.trim()) {
      setError("El nombre del proyecto es obligatorio")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase!
        .from("projects")
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          user_id: user.id,
          is_public: true
        })
        .select()
        .single()

      if (error) throw error

      router.push(`/project/${data.id}`)
    } catch (err) {
      console.error("Error creando proyecto:", err)
      setError("Error al crear el proyecto")
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        <p>🔒 Debes iniciar sesión para crear un proyecto</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white" }}>
      <aside style={{ width: 240, padding: "24px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px", maxWidth: "600px" }}>
        <Link href="/explore" style={{ color: "#10b981", textDecoration: "none" }}>← Volver a proyectos</Link>

        <h1 style={{ fontSize: 32, marginTop: 20, marginBottom: 24 }}>➕ Nuevo proyecto</h1>

        {error && (
          <div style={{ padding: 12, background: "rgba(239,68,68,0.1)", color: "#ef4444", borderRadius: 8, marginBottom: 16 }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
              Nombre del proyecto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 16,
                resize: "vertical"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 32px",
              background: loading ? "#444" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Creando..." : "Crear proyecto"}
          </button>
        </form>
      </main>
    </div>
  )
}
