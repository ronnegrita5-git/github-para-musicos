"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../context/AuthContext"
import { supabase } from "@/lib/supabase"

export default function ExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase!
          .from("projects")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false })

        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

  const handleProjectClick = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }

  if (loading) {
    return <div style={{ color: "white", padding: 40 }}>⏳ Cargando proyectos...</div>
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white" }}>
      <aside style={{ width: 240, padding: "24px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>📁 Proyectos</h1>
          {user && (
            <Link
              href="/project/new"
              style={{
                padding: "10px 20px",
                background: "#10b981",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: "bold"
              }}
            >
              ➕ Nuevo proyecto
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No hay proyectos públicos aún</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => handleProjectClick(p.id)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 12,
                  padding: "20px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)"
                  e.currentTarget.style.borderColor = "#10b981"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
                }}
              >
                <h3 style={{ margin: 0, marginBottom: 8, color: "white" }}>{p.name || "Sin título"}</h3>
                <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 12 }}>{p.description || "Sin descripción"}</p>
                <span style={{ color: "#6b7280", fontSize: 12 }}>📅 {new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
