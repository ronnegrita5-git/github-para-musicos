"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"

interface MultiUploadProps {
  projectId: string
  onUploadComplete?: () => void
}

export default function MultiUpload({ projectId, onUploadComplete }: MultiUploadProps) {
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [results, setResults] = useState<{ success: string[]; error: string[] }>({
    success: [],
    error: []
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...fileList])
      
      const newProgress: Record<string, number> = {}
      fileList.forEach((file) => {
        newProgress[file.name] = 0
      })
      setProgress((prev) => ({ ...prev, ...newProgress }))
    }
  }

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName))
    setProgress((prev) => {
      const newProgress = { ...prev }
      delete newProgress[fileName]
      return newProgress
    })
  }

  const handleUpload = async () => {
    if (!user || files.length === 0) return
    
    setUploading(true)
    setResults({ success: [], error: [] })
    
    try {
      for (const file of files) {
        try {
          console.log(`📤 Subiendo: ${file.name}`)
          setProgress((prev) => ({ ...prev, [file.name]: 10 }))
          
          const fileName = `${projectId}/${Date.now()}-${file.name}`
          const { error: uploadError } = await supabase
            .storage
            .from("audio")
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error("❌ Error al subir archivo:", uploadError)
            setResults((prev) => ({ ...prev, error: [...prev.error, file.name] }))
            continue
          }

          console.log(`✅ Archivo subido: ${fileName}`)
          setProgress((prev) => ({ ...prev, [file.name]: 50 }))

          const { data: urlData } = supabase
            .storage
            .from("audio")
            .getPublicUrl(fileName)
          
          const audioUrl = urlData.publicUrl
          console.log(`🔊 URL: ${audioUrl}`)

          setProgress((prev) => ({ ...prev, [file.name]: 70 }))

          // ✅ Guardar solo con audio_url
          const { error: trackError } = await supabase
            .from("tracks")
            .insert({
              name: file.name.replace(/\.[^.]+$/, ""),
              project_id: projectId,
              user_id: user.id,
              audio_url: audioUrl
            })

          if (trackError) {
            console.error("❌ Error al guardar en DB:", trackError)
            setResults((prev) => ({ ...prev, error: [...prev.error, file.name] }))
            continue
          }

          console.log(`✅ Guardado en DB`)
          setProgress((prev) => ({ ...prev, [file.name]: 100 }))
          setResults((prev) => ({ ...prev, success: [...prev.success, file.name] }))
          
        } catch (error) {
          console.error(`❌ Error al procesar ${file.name}:`, error)
          setResults((prev) => ({ ...prev, error: [...prev.error, file.name] }))
        }
      }
      
      setFiles((prev) => prev.filter((f) => !results.success.includes(f.name)))
      
      if (onUploadComplete) onUploadComplete()
      
    } catch (error) {
      console.error("❌ Error en la subida:", error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ 
      marginTop: 20, 
      padding: 20, 
      border: "2px dashed #ccc", 
      borderRadius: 12,
      background: "#fafafa"
    }}>
      <h4 style={{ margin: "0 0 10px 0" }}>📤 Subir archivos</h4>
      
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="file"
          multiple
          accept="audio/mpeg,audio/wav,audio/ogg"
          onChange={handleFileSelect}
          disabled={uploading}
          style={{ flex: 1 }}
        />
        
        {files.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              padding: "10px 20px",
              background: uploading ? "#6c757d" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: uploading ? "default" : "pointer",
              fontSize: 14,
            }}
          >
            {uploading ? "Subiendo..." : "🚀 Subir archivos"}
          </button>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 15 }}>
          <p style={{ margin: "0 0 5px 0", fontSize: 14, fontWeight: "bold", color: "#555" }}>
            Archivos seleccionados ({files.length}):
          </p>
          {files.map((file) => (
            <div key={file.name} style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 10,
              padding: "5px 10px",
              background: progress[file.name] === 100 ? "#d4edda" : "#f8f9fa",
              borderRadius: 4,
              marginBottom: 4,
              fontSize: 14
            }}>
              <span>{file.name}</span>
              <span style={{ fontSize: 12, color: "#888" }}>
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
              {progress[file.name] > 0 && progress[file.name] < 100 && (
                <span style={{ fontSize: 12, color: "#0d6efd" }}>
                  {progress[file.name]}%
                </span>
              )}
              {progress[file.name] === 100 && (
                <span style={{ fontSize: 12, color: "#28a745" }}>
                  ✅
                </span>
              )}
              {progress[file.name] === 0 && (
                <button
                  onClick={() => removeFile(file.name)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#dc3545",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {results.success.length > 0 && (
        <div style={{ marginTop: 15 }}>
          <p style={{ color: "#28a745", fontSize: 14, margin: 0 }}>
            ✅ Subidos: {results.success.length} archivos
          </p>
        </div>
      )}
      
      {results.error.length > 0 && (
        <div style={{ marginTop: 5 }}>
          <p style={{ color: "#dc3545", fontSize: 14, margin: 0 }}>
            ❌ Errores: {results.error.length} archivos
          </p>
        </div>
      )}
    </div>
  )
}
