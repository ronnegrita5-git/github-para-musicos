"use client"

import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../../context/AuthContext"  // 👈 RUTA CORREGIDA
import { useRouter } from "next/navigation"

export default function ProjectPage({ params }: any) {
  const { id } = use(params)
  const { user } = useAuth()
  const router = useRouter()

  const [project, setProject] = useState<any>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [instrument, setInstrument] = useState("guitarra")
  const [playingAll, setPlayingAll] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    loadProject()
    loadTracks()
  }, [id, user])

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single()

    setProject(data)
  }

  async function loadTracks() {
    setLoading(true)
    const { data } = await supabase
      .from("tracks")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true })

    setTracks(data || [])
    setLoading(false)
  }

  async function addTrack() {
    const name = prompt("Nombre de la pista 🎵")
    if (!name) return

    await supabase.from("tracks").insert([
      {
        name,
        instrument: instrument,
        project_id: id,
        user_id: user?.id,
      },
    ])

    loadTracks()
  }

  async function uploadAudio(e: any, trackId: string) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    const fileName = `${id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(fileName, file)

    if (uploadError) {
      console.error("UPLOAD ERROR:", uploadError)
      alert("Error al subir el archivo: " + uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from("audio")
      .getPublicUrl(fileName)

    const audioUrl = data.publicUrl

    await supabase
      .from("tracks")
      .update({ audio_url: audioUrl })
      .eq("id", trackId)

    setUploading(false)
    loadTracks()
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>, audioUrl: string) {
    const volume = parseFloat(e.target.value)
    const audioElement = document.querySelector(
      `audio[src="${audioUrl}"]`
    ) as HTMLAudioElement
    if (audioElement) {
      audioElement.volume = volume
    }
  }

  async function deleteTrack(trackId: string) {
    if (!confirm("¿Seguro que quieres eliminar esta pista?")) return

    await supabase
      .from("tracks")
      .delete()
      .eq("id", trackId)

    loadTracks()
  }

  function playAllTracks() {
    const audios = document.querySelectorAll('audio')
    
    const anyPlaying = Array.from(audios).some(a => !a.paused)
    
    if (anyPlaying) {
      audios.forEach(a => a.pause())
      setPlayingAll(false)
    } else {
      audios.forEach((audio) => {
        audio.currentTime = 0
        audio.play()
      })
      setPlayingAll(true)
    }
  }

  async function forkProject() {
    if (!project) return

    const newName = prompt("Nombre para el fork:", `${project.name} (fork)`)
    if (!newName) return

    const { data: newProject, error } = await supabase
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

    if (error) {
      alert("Error al hacer fork: " + error.message)
      return
    }

    for (const track of tracks) {
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
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🎵 {project?.name || "Cargando..."}</h1>
        
        <button
          onClick={forkProject}
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

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={addTrack}>
          + Añadir pista
        </button>

        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        >
          <option value="guitarra">🎸 Guitarra</option>
          <option value="voz">🎤 Voz</option>
          <option value="bajo">🎸 Bajo</option>
          <option value="bateria">🥁 Batería</option>
          <option value="teclado">🎹 Teclado</option>
          <option value="otro">🎧 Otro</option>
        </select>

        <button
          onClick={playAllTracks}
          style={{
            padding: "8px 16px",
            background: playingAll ? "#dc3545" : "#0d6efd",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {playingAll ? "⏹ Detener todas" : "▶ Reproducir todas"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <p>Cargando pistas...</p>
        ) : tracks.length === 0 ? (
          <p>No hay pistas todavía...</p>
        ) : (
          tracks.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 10,
                border: "1px solid #ccc",
                marginTop: 10,
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  🎧 {t.name}{" "}
                  <span style={{ fontSize: 12, color: "#888" }}>
                    ({t.instrument || "sin instrumento"})
                  </span>
                </div>

                <button
                  onClick={() => deleteTrack(t.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 18,
                    padding: "4px 8px",
                  }}
                  title="Eliminar pista"
                >
                  🗑️
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                {!t.audio_url ? (
                  <>
                    <input
                      type="file"
                      accept="audio/mpeg"
                      onChange={(e) => uploadAudio(e, t.id)}
                      disabled={uploading}
                    />
                    {uploading && <p>Subiendo...</p>}
                  </>
                ) : (
                  <div>
                    <audio controls src={t.audio_url} />

                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#888" }}>🔊</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        defaultValue="1"
                        style={{ width: 120 }}
                        onChange={(e) => handleVolumeChange(e, t.audio_url!)}
                      />
                      <span style={{ fontSize: 12, color: "#888" }}>Volumen</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}