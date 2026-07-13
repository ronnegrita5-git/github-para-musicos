"use client"

import { useState, useRef } from "react"
import { useAuth } from "@/app/context/AuthContext"
import { supabase } from "@/lib/supabase"

interface WebRecorderProps {
  projectId?: string
  onRecordingComplete?: (audioUrl: string) => void
}

export default function WebRecorder({ projectId, onRecordingComplete }: WebRecorderProps) {
  const { user } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = async () => {
    if (!user) {
      alert("Debes iniciar sesión para grabar audio")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        stream.getTracks().forEach(track => track.stop())

        if (projectId && user) {
          await uploadAudio(audioBlob)
        }

        if (onRecordingComplete) {
          onRecordingComplete(url)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error al acceder al micrófono:", error)
      alert("No se pudo acceder al micrófono")
    }
  }

  const uploadAudio = async (blob: Blob) => {
    if (!user) return
    setIsUploading(true)

    try {
      const fileName = `audio/${user.id}/${Date.now()}.webm`
      const { error: uploadError } = await supabase!
        .storage
        .from("audio")
        .upload(fileName, blob)

      if (uploadError) throw uploadError

      const { data: urlData } = await supabase!
        .storage
        .from("audio")
        .getPublicUrl(fileName)

      if (projectId) {
        await supabase!
          .from("tracks")
          .insert({
            project_id: projectId,
            user_id: user.id,
            name: `Grabación ${new Date().toLocaleString()}`,
            file_url: urlData?.publicUrl || "",
            type: "audio/webm",
          })
      }
    } catch (error) {
      console.error("Error subiendo audio:", error)
      alert("Error al subir el audio")
    } finally {
      setIsUploading(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (!user) {
    return (
      <div style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>
        🔒 Inicia sesión para grabar audio
      </div>
    )
  }

  return (
    <div style={{
      padding: 16,
      background: "rgba(255,255,255,0.03)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.05)"
    }}>
      <h4 style={{ color: "white", marginBottom: 12 }}>🎤 Grabador de audio</h4>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap"
      }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{
              padding: "10px 24px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: "bold"
            }}
          >
            🔴 Comenzar grabación
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: "10px 24px",
              background: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: "bold"
            }}
          >
            ⏹ Detener
          </button>
        )}

        {isRecording && (
          <span style={{ color: "#ef4444", fontSize: 16 }}>
            ⏱ {formatTime(recordingTime)}
          </span>
        )}

        {isUploading && (
          <span style={{ color: "#fbbf24", fontSize: 14 }}>
            ⏳ Subiendo audio...
          </span>
        )}

        {audioUrl && !isRecording && !isUploading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <audio controls src={audioUrl} style={{ height: 40 }} />
            <span style={{ color: "#10b981", fontSize: 14 }}>✅ Grabación lista</span>
          </div>
        )}
      </div>
    </div>
  )
}
