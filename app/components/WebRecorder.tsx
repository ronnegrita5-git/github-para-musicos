"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"

interface WebRecorderProps {
  projectId: string
  trackId: string
  onUploadComplete?: () => void
}

export default function WebRecorder({ projectId, trackId, onUploadComplete }: WebRecorderProps) {
  const { user } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' })
        const url = URL.createObjectURL(audioBlob)
        setAudioURL(url)
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setIsPaused(false)
      setError(null)
      
      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setRecordingTime(seconds)
      }, 1000)
      
    } catch (err: any) {
      console.error("Error al acceder al micrófono:", err)
      setError("No se pudo acceder al micrófono. Permite el acceso desde el navegador.")
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
      setAudioURL(null)
    }
    setRecordingTime(0)
  }

  async function uploadRecording() {
    if (!audioURL || !user) return
    
    setIsUploading(true)
    setError(null)
    
    try {
      const response = await fetch(audioURL)
      const blob = await response.blob()
      
      const fileName = `${projectId}/${Date.now()}-web-recording.mp3`
      
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) throw uploadError
      
      const { data: urlData } = supabase.storage
        .from("audio")
        .getPublicUrl(fileName)
      
      const audioUrl = urlData.publicUrl
      
      const { error: updateError } = await supabase
        .from("tracks")
        .update({ 
          audio_url: audioUrl,
          source: 'web'
        })
        .eq("id", trackId)
      
      if (updateError) throw updateError
      
      URL.revokeObjectURL(audioURL)
      setAudioURL(null)
      setRecordingTime(0)
      
      if (onUploadComplete) onUploadComplete()
      
      alert("✅ Grabación subida correctamente")
      
    } catch (err: any) {
      console.error("Error al subir:", err)
      setError(err.message || "Error al subir la grabación")
    } finally {
      setIsUploading(false)
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!isRecording && !audioURL && (
        <button
          onClick={startRecording}
          style={{
            padding: "8px 16px",
            background: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          🎙️ Grabar desde web
        </button>
      )}

      {isRecording && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "#dc3545", fontWeight: "bold" }}>
            🔴 {formatTime(recordingTime)}
          </span>
          {isPaused ? (
            <button
              onClick={resumeRecording}
              style={{
                padding: "4px 12px",
                background: "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ▶️ Reanudar
            </button>
          ) : (
            <button
              onClick={pauseRecording}
              style={{
                padding: "4px 12px",
                background: "#ffc107",
                color: "#333",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ⏸️ Pausar
            </button>
          )}
          <button
            onClick={stopRecording}
            style={{
              padding: "4px 12px",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ⏹️ Detener
          </button>
        </div>
      )}

      {audioURL && (
        <div style={{ marginTop: 10 }}>
          <audio controls src={audioURL} style={{ width: "100%", maxWidth: 300 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={uploadRecording}
              disabled={isUploading}
              style={{
                padding: "8px 16px",
                background: "#28a745",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: isUploading ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              {isUploading ? "Subiendo..." : "📤 Subir grabación"}
            </button>
            <button
              onClick={cancelRecording}
              style={{
                padding: "8px 16px",
                background: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: "#dc3545", fontSize: 14, marginTop: 10 }}>
          ❌ {error}
        </p>
      )}
    </div>
  )
}
