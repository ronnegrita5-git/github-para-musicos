"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useRouter } from "next/navigation"

export default function ExplorePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    loadProjects()
  }, [user])

  async function loadProjects() {
    setLoading(true)
    
    // Cargar proyectos públicos (todos los que no sean del usuario actual)
    let query = supabase
      .from("projects")
      .select(`
        *,
        tracks (count),
        profiles (email)
      `)
      .eq("is_public", true)
      .order("created_at", { ascending: false })

    // Si hay búsqueda, filtrar por nombre
    if (searchTerm) {
      query = query.ilike("name", `%${searchTerm}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error al cargar proyectos:", error)
      setProjects([])
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProjects()
  }, [searchTerm])

  async function forkProject(project: any) {
    if (!confirm(`¿Quieres hacer fork de "${project.name}"?`)) return

    const newName = prompt("Nombre para tu fork:", `${project.name} (fork)`)

    if (!newName) return

    // 1. Crear nuevo proyecto (copia)
    const { data: newProject, error: projectError } = await supabase
      .from("projects")
      .insert([
        {
          name: newName,
          description: `Fork de "${project.name}"`,
          user_id: user?.id,
          is_public: true,
        },
      ])
      .select()
      .single()

    if (projectError) {
      alert("Error al crear fork: " + projectError.message)
      return
    }

    // 2. Obtener todas las pistas del proyecto original
    const { data: tracks, error: tracksError } = await supabase
      .from("tracks")
      .select("*")
      .eq("project_id", project.id)

    if (tracksError) {
      alert("Error al copiar pistas: " + tracksError.message)
      return
    }

    // 3. Copiar todas las pistas al nuevo proyecto
    for (const track of tracks || []) {
      await supabase.from("tracks").insert([
        {
          name: track.name,
          instrument: track.instrument,
          project_id: newProject.id,
          audio_url: track.audio_url,
          user_id: user?.id,
        },
      ])
    }

    alert(`✅ Fork creado: "${newName}"`)
    router.push(`/project/${newProject.id}`)
  }

  if (!user) return null

  return (
    <div style={{ padding: 30, fontFamily: "Arial", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🌍 Explorar proyectos</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" style={{ textDecoration: "none", color: "#2b8a3e" }}>
            ← Mis proyectos
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <input
          type="text"
          placeholder="🔍 Buscar proyectos por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 500,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />
      </div>

      <div style={{ marginTop: 30 }}>
        {loading ? (
          <p>Cargando proyectos...</p>
        ) : projects.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
            {searchTerm ? "No se encontraron proyectos con ese nombre" : "No hay proyectos públicos todavía"}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: 16,
                  border: "1px solid #e0e0e0",
                  borderRadius: 12,
                  background: "white",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Link href={`/project/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <h3 style={{ margin: 0, color: "#2b8a3e" }}>🎵 {p.name}</h3>
                  </Link>
                  <p style={{ margin: "5px 0 0", color: "#666", fontSize: 14 }}>
                    {p.description || "Sin descripción"}
                  </p>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
                    👤 {p.profiles?.email?.split("@")[0] || "Usuario anónimo"} · 
                    📅 {new Date(p.created_at).toLocaleDateString()} · 
                    🎧 {p.tracks?.[0]?.count || 0} pistas
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => forkProject(p)}
                    style={{
                      padding: "8px 16px",
                      background: "#6f42c1",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    🔀 Fork
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
