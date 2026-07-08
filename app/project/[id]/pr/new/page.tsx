"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/app/context/AuthContext"
import Link from "next/link"

export default function NewPRPage({ params }: any) {
  const { id } = React.use(params)
  const { user } = useAuth()
  const router = useRouter()
  
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [tracks, setTracks] = useState<any[]>([])
  const [currentTrack, setCurrentTrack] = useState({
    name: "",
    instrument: "guitarra",
    file: null as File | null,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      alert("El título es obligatorio")
      return
    }
    if (!user) {
      alert("Debes iniciar sesión")
      router.push("/login")
      return
    }

    setLoading(true)

    try {
      const { data: pr, error: prError } = await supabase
        .from("pull_requests")
        .insert([
          {
            project_id: id,
            user_id: user?.id,
            title,
            description,
            status: "pending",
          },
        ])
        .select()
        .single()

      if (prError) throw prError

      for (const track of tracks) {
        let audioUrl = null

        if (track.file) {
          const fileName = `pr/${pr.id}/${Date.now()}-${track.file.name}`
          const { error: uploadError } = await supabase.storage
            .from("audio")
            .upload(fileName, track.file)

          if (!uploadError) {
            const { data } = supabase.storage
              .from("audio")
              .getPublicUrl(fileName)
            audioUrl = data.publicUrl
          }
        }

        await supabase.from("pull_request_tracks").insert([
          {
            pull_request_id: pr.id,
            name: track.name,
            instrument: track.instrument,
            audio_url: audioUrl,
            user_id: user?.id,
          },
        ])
      }

      alert("✅ Pull Request creado correctamente")
      router.push(`/project/${id}`)
    } catch (error: any) {
      alert("Error al crear PR: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  function addTrackToList() {
    if (!currentTrack.name.trim()) {
      alert("El nombre de la pista es obligatorio")
      return
    }
    setTracks([...tracks, { ...currentTrack }])
    setCurrentTrack({ name: "", instrument: "guitarra", file: null })
  }

  function removeTrack(index: number) {
    setTracks(tracks.filter((_, i) => i !== index))
  }

  return (
    <div style={{ padding: 30, fontFamily: "'Inter', sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <Link href={`/project/${id}`} style={{ textDecoration: "none", color: "#10b981" }}>
        ← Volver al proyecto
      </Link>

      <h1 style={{ color: "white" }}>📥 Nuevo Pull Request</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 5, color: "#e5e5e5" }}>
            Título *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Añadir solo de guitarra"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(16, 185, 129, 0.2)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 16,
            }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 5, color: "#e5e5e5" }}>
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explica qué cambios propones..."
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(16, 185, 129, 0.2)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 16,
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ marginBottom: 20, padding: 15, border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 8 }}>
          <h4 style={{ color: "#e5e5e5" }}>🎵 Pistas a añadir</h4>
          
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Nombre de la pista"
              value={currentTrack.name}
              onChange={(e) => setCurrentTrack({ ...currentTrack, name: e.target.value })}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid rgba(16, 185, 129, 0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                flex: 1,
                minWidth: 150,
              }}
            />
            <select
              value={currentTrack.instrument}
              onChange={(e) => setCurrentTrack({ ...currentTrack, instrument: e.target.value })}
              style={{
                padding: 8,
                borderRadius: 8,
                border: "1px solid rgba(16, 185, 129, 0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
              }}
            >
              <option value="guitarra">🎸 Guitarra</option>
              <option value="voz">🎤 Voz</option>
              <option value="bajo">🎸 Bajo</option>
              <option value="bateria">🥁 Batería</option>
              <option value="teclado">🎹 Teclado</option>
              <option value="otro">🎧 Otro</option>
            </select>
            <input
              type="file"
              accept="audio/mpeg"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setCurrentTrack({ ...currentTrack, file })
              }}
              style={{ fontSize: 14, color: "white" }}
            />
            <button
              type="button"
              onClick={addTrackToList}
              style={{
                padding: "8px 16px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              + Añadir
            </button>
          </div>

          {tracks.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: 14, color: "#e5e5e5" }}>Pistas añadidas:</p>
              {tracks.map((t, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", color: "#e5e5e5" }}>
                  <span>🎧 {t.name} ({t.instrument}) {t.file ? "📁" : ""}</span>
                  <button
                    type="button"
                    onClick={() => removeTrack(i)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 24px",
            background: loading ? "#065f46" : "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            width: "100%",
          }}
        >
          {loading ? "Creando..." : "🚀 Crear Pull Request"}
        </button>
      </form>
    </div>
  )
}
