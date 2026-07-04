"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })

    console.log("DATA =>", data)
    console.log("ERROR =>", error)

    setProjects(data || [])
  }

  async function createProject() {
    const name = prompt("Nombre del proyecto 🎵")
    if (!name) return

    const { data, error } = await supabase
      .from("projects")
      .insert([{ name }])
      .select()

    console.log("INSERT DATA =>", data)
    console.log("INSERT ERROR =>", error)

    if (!error) {
      loadProjects()
    }
  }

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>🎵 Music Collab</h1>

      <button onClick={createProject}>
        + Nuevo proyecto
      </button>

      <div style={{ marginTop: 20 }}>
        {projects.length === 0 && (
          <p>No hay proyectos todavía...</p>
        )}

        {projects.map((p) => (
          <div key={p.id} style={{ padding: 10, border: "1px solid #ccc", marginTop: 10 }}>
            🎼 {p.name}
          </div>
        ))}
      </div>
    </div>
  )
}