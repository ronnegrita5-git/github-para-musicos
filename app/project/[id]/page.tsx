"use client"

import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../../context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"

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
  const [isOwner, setIsOwner] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [updatingVisibility, setUpdatingVisibility] = useState(false)

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
    if (data && user) {
      const owner = data.user_id === user.id
      setIsOwner(owner)
      setIsPublic(data.is_public !== false)
    }
  }

  async function loadTracks() {
    setLoading(true)
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("❌ Error al cargar pistas:", error)
    } else {
      setTracks(data || [])
    }
    setLoading(false)
  }

  async function addTrack() {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede añadir pistas")
      return
    }

    const name = prompt("Nombre de la pista 🎵")
    if (!name) return

    try {
      const { data, error } = await supabase
        .from("tracks")
        .insert([
          {
            name,
            instrument: instrument,
            project_id: id,
            user_id: user?.id,
          },
        ])
        .select()

      if (error) {
        console.error("❌ Error al añadir pista:", error)
        alert("Error al añadir pista: " + error.message)
        return
      }

      alert("✅ Pista añadida correctamente")
      loadTracks()
    } catch (error: any) {
      console.error("❌ Error inesperado:", error)
      alert("Error inesperado: " + (error.message || "Error desconocido"))
    }
  }

  async function uploadAudio(e: any, trackId: string) {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede subir audio")
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    const fileName = `${id}/${Date.now()}-${file.name}`

    try {
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error("❌ Error al subir:", uploadError)
        alert("Error al subir el archivo: " + uploadError.message)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from("audio")
        .getPublicUrl(fileName)

      const audioUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from("tracks")
        .update({ audio_url: audioUrl })
        .eq("id", trackId)

      if (updateError) {
        console.error("❌ Error al actualizar:", updateError)
        alert("Error al guardar la URL: " + updateError.message)
      }

      setUploading(false)
      loadTracks()
    } catch (error: any) {
      console.error("❌ Error inesperado:", error)
      alert("Error al subir audio: " + (error.message || "Error desconocido"))
      setUploading(false)
    }
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
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede eliminar pistas")
      return
    }

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

  async function toggleVisibility() {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede cambiar la visibilidad")
      return
    }

    setUpdatingVisibility(true)
    const newVisibility = !isPublic

    const { error } = await supabase
      .from("projects")
      .update({ is_public: newVisibility })
      .eq("id", id)

    if (error) {
      alert("Error al cambiar visibilidad: " + error.message)
    } else {
      setIsPublic(newVisibility)
      alert(newVisibility ? "✅ Proyecto ahora es PÚBLICO" : "🔒 Proyecto ahora es PRIVADO")
    }

    setUpdatingVisibility(false)
  }

  async function deleteProjectFromPage() {
    if (!isOwner) {
      alert("Solo el dueño puede eliminar el proyecto")
      return
    }

    if (!confirm(`¿Seguro que quieres eliminar el proyecto "${project?.name}"?\n\n⚠️ Esta acción eliminará TODAS las pistas y no se puede deshacer.`)) {
      return
    }

    try {
      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("audio_url")
        .eq("project_id", id)

      if (tracksError) {
        console.error("Error al obtener pistas:", tracksError)
      }

      if (tracks && tracks.length > 0) {
        for (const track of tracks) {
          if (track.audio_url) {
            const fileName = track.audio_url.split('/').pop()
            if (fileName) {
              await supabase.storage
                .from("audio")
                .remove([`${id}/${fileName}`])
            }
          }
        }
      }

      await supabase
        .from("tracks")
        .delete()
        .eq("project_id", id)

      const { error: deleteProjectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", id)

      if (deleteProjectError) {
        alert("Error al eliminar proyecto: " + deleteProjectError.message)
        return
      }

      alert(`✅ Proyecto "${project?.name}" eliminado correctamente`)
      router.push("/dashboard")
    } catch (error: any) {
      alert("Error al eliminar proyecto: " + (error.message || "Error desconocido"))
    }
  }

  async function forkProject() {
    if (!project) {
      alert("No hay proyecto para hacer fork")
      return
    }

    const newName = prompt("Nombre para el fork:", `${project.name} (fork)`)
    if (!newName) return

    try {
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
        console.error("Error al crear proyecto:", projectError)
        alert("Error al crear fork: " + projectError.message)
        return
      }

      const { data: tracksData, error: tracksError } = await supabase
        .from("tracks")
        .select("*")
        .eq("project_id", project.id)

      if (tracksError) {
        console.error("Error al obtener pistas:", tracksError)
        alert("Error al copiar pistas: " + tracksError.message)
        return
      }

      if (tracksData && tracksData.length > 0) {
        for (const track of tracksData) {
          await supabase.from("tracks").insert([
            {
              name: track.name,
              instrument: track.instrument || null,
              project_id: newProject.id,
              audio_url: track.audio_url || null,
              user_id: user?.id,
            },
          ])
        }
      }

      alert(`✅ Fork creado exitosamente: "${newName}"`)
      router.push(`/project/${newProject.id}`)
    } catch (error: any) {
      console.error("Error en fork:", error)
      alert("Error al hacer fork: " + (error.message || "Error desconocido"))
    }
  }

  if (!user) return null

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      {isOwner && (
        <div style={{
          background: "#f8f9fa",
          padding: 15,
          borderRadius: 12,
          marginBottom: 20,
          border: "1px solid #dee2e6",
        }}>
          <h4 style={{ margin: "0 0 10px 0" }}>⚙️ Panel de control</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={toggleVisibility}
              disabled={updatingVisibility}
              style={{
                padding: "8px 16px",
                background: isPublic ? "#28a745" : "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {isPublic ? "🌍 Público" : "🔒 Privado"}
            </button>
            
            <button
              onClick={deleteProjectFromPage}
              style={{
                padding: "8px 16px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              🗑️ Eliminar proyecto
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            {isPublic 
              ? "🌍 Cualquier usuario puede ver y hacer fork de este proyecto" 
              : "🔒 Solo tú puedes ver y editar este proyecto"}
          </p>
        </div>
      )}

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

      {!isOwner && (
        <p style={{ color: "#888", fontStyle: "italic" }}>
          👁️ Estás viendo este proyecto como visitante.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        {isOwner && (
          <button onClick={addTrack}>+ Añadir pista</button>
        )}

        {isOwner && (
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
        )}

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
                {isOwner && (
                  <button
                    onClick={() => deleteTrack(t.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: "4px 8px",
                      color: "#dc3545",
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                {!t.audio_url ? (
                  <>
                    {isOwner && (
                      <input
                        type="file"
                        accept="audio/mpeg"
                        onChange={(e) => uploadAudio(e, t.id)}
                        disabled={uploading}
                      />
                    )}
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
