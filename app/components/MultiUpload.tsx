"use client"

import { useState } from "react"
import { useAuth } from "@/app/context/AuthContext"
import { supabase } from "@/lib/supabase"

interface MultiUploadProps {
  projectId: string
  onUploadComplete?: (files: any[]) => void
}

export default function MultiUpload({ projectId, onUploadComplete }: MultiUploadProps) {
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const handleUpload = async () => {
    if (!user) {
      alert("Debes iniciar sesión")
      return
    }

    if (files.length === 0) {
      alert("Selecciona al menos un archivo")
      return
    }

    setUploading(true)

    try {
      for (const file of files) {
        setProgress(prev => ({ ...prev, [file.name]: 0 }))

        const fileName = `tracks/${user.id}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase!
          .storage
          .from("tracks")
          .upload(fileName, file)

        if (uploadError) throw uploadError

        const { data: urlData } = await supabase!
          .storage
          .from("tracks")
          .getPublicUrl(fileName)

        const { error: dbError } = await supabase!
          .from("tracks")
          .insert({
            project_id: projectId,
            user_id: user.id,
            name: file.name,
            file_url: urlData?.publicUrl || "",
            size: file.size,
            type: file.type,
          })

        if (dbError) throw dbError

        setProgress(prev => ({ ...prev, [file.name]: 100 }))
        setUploadedFiles(prev => [...prev, { name: file.name, url: urlData?.publicUrl }])
      }

      alert("✅ Archivos subidos correctamente")
      setFiles([])
      if (onUploadComplete) onUploadComplete(uploadedFiles)
    } catch (error) {
      console.error("Error subiendo archivos:", error)
      alert("Error al subir archivos")
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
      <h4 style={{ color: "white", marginBottom: 12 }}>📤 Subir pistas</h4>

      <div style={{ marginBottom: 12 }}>
        <label style={{
          display: "inline-block",
          padding: "8px 16px",
          background: "rgba(16, 185, 129, 0.1)",
          color: "#10b981",
          border: "1px dashed rgba(16, 185, 129, 0.3)",
          borderRadius: 6,
          cursor: "pointer"
        }}>
          Seleccionar archivos
          <input
            type="file"
            multiple
            accept="audio/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
        <span style={{ color: "#6b7280", marginLeft: 12 }}>
          {files.length} archivo(s) seleccionado(s)
        </span>
      </div>

      {files.map((file, index) => (
        <div key={index} style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          marginBottom: 4,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 4
        }}>
          <span style={{ color: "white" }}>
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </span>
          {progress[file.name] !== undefined && (
            <span style={{ color: "#10b981" }}>{progress[file.name]}%</span>
          )}
          {!uploading && (
            <button onClick={() => removeFile(index)} style={{
              background: "transparent",
              border: "none",
              color: "#ef4444",
              cursor: "pointer"
            }}>
              ✕
            </button>
          )}
        </div>
      ))}

      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{
            padding: "8px 24px",
            background: uploading ? "#444" : "#10b981",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: uploading ? "not-allowed" : "pointer",
            marginTop: 12
          }}
        >
          {uploading ? "Subiendo..." : `Subir ${files.length} archivo(s)`}
        </button>
      )}
    </div>
  )
}
