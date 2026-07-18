"use client"

import { useAuth } from "../context/AuthContext"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

interface Instrument {
  id: string
  name: string
  category: string
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [instrumentId, setInstrumentId] = useState("")
  const [musicGenre, setMusicGenre] = useState("")
  const [bio, setBio] = useState("")
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)

  // Cargar instrumentos
  useEffect(() => {
    const fetchInstruments = async () => {
      try {
        console.log("📡 Cargando instrumentos...")
        const { data, error } = await supabase
          .from("instruments")
          .select("id, name, category")
          .order("name", { ascending: true })

        if (error) {
          console.error("❌ Error cargando instrumentos:", error)
          throw error
        }
        
        console.log("✅ Instrumentos cargados:", data)
        setInstruments(data || [])
      } catch (error) {
        console.error("Error cargando instrumentos:", error)
      } finally {
        setLoadingInstruments(false)
      }
    }

    fetchInstruments()
  }, [])

  // Cargar datos del usuario
  useEffect(() => {
    if (user) {
      const loadUserData = async () => {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", user.id)
            .single()

          if (error) throw error

          if (data) {
            setFirstName(data.first_name || "")
            setLastName(data.last_name || "")
            setCity(data.city || "")
            setCountry(data.country || "")
            setInstrumentId(data.instrument_id || "")
            setMusicGenre(data.music_genre || "")
            setBio(data.bio || "")
          }
        } catch (error) {
          console.error("Error cargando perfil:", error)
        }
      }

      loadUserData()
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from("users")
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          city: city || null,
          country: country || null,
          instrument_id: instrumentId || null,
          music_genre: musicGenre || null,
          bio: bio || null,
        })
        .eq("id", user.id)

      if (error) throw error

      setMessage("✅ Perfil actualizado correctamente")
      setMessageType("success")
      
      const { data: updatedUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single()

      if (updatedUser) {
        const userData = {
          id: updatedUser.id,
          email: updatedUser.email,
          first_name: updatedUser.first_name || "",
          last_name: updatedUser.last_name || "",
          city: updatedUser.city || "",
          country: updatedUser.country || "",
          instrument_id: updatedUser.instrument_id || "",
          music_genre: updatedUser.music_genre || "",
          bio: updatedUser.bio || "",
          avatar_url: updatedUser.avatar_url || "",
          created_at: updatedUser.created_at,
        }
        localStorage.setItem('user', JSON.stringify(userData))
      }

    } catch (error) {
      console.error("Error guardando perfil:", error)
      setMessage("❌ Error al guardar el perfil")
      setMessageType("error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ color: "white", padding: 40 }}>Cargando...</div>
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        <p>🔒 Debes iniciar sesión para ver tu perfil</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "white"
    }}>
      <aside style={{
        width: 240,
        padding: "24px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRight: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>
          🎵 Music Collab
        </div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
        <Link href="/profile" style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", textDecoration: "none", display: "block" }}>👤 Mi perfil</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px", maxWidth: "800px" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>👤 Mi perfil</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Completa y actualiza tu perfil musical
        </p>

        {message && (
          <div style={{
            padding: 12,
            marginBottom: 16,
            background: messageType === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: messageType === "success" ? "#10b981" : "#ef4444",
            borderRadius: 8,
            fontSize: 14
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "rgba(255,255,255,0.03)",
                color: "#6b7280",
                fontSize: 16,
                cursor: "not-allowed"
              }}
            />
            <span style={{ color: "#6b7280", fontSize: 12 }}>No se puede cambiar el email</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
                Nombre
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Tu nombre"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  fontSize: 16
                }}
              />
            </div>

            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
                Apellidos
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tus apellidos"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  fontSize: 16
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
                Población
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Tu ciudad"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  fontSize: 16
                }}
              />
            </div>

            <div style={{ marginBottom: 16, textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
                País
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Tu país"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  fontSize: 16
                }}
              />
            </div>
          </div>

          {/* 🎸 DESPLEGABLE DE INSTRUMENTOS */}
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
              Instrumento que tocas
            </label>
            <select
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "white",
                fontSize: 16
              }}
            >
              <option value="">Selecciona un instrumento</option>
              {loadingInstruments ? (
                <option disabled>⏳ Cargando instrumentos...</option>
              ) : instruments.length === 0 ? (
                <option disabled>❌ No hay instrumentos disponibles</option>
              ) : (
                instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} {inst.category ? `(${inst.category})` : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
              Género musical
            </label>
            <select
              value={musicGenre}
              onChange={(e) => setMusicGenre(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "white",
                fontSize: 16
              }}
            >
              <option value="">Selecciona un género</option>
              <option value="banda">🎺 Banda</option>
              <option value="cuerda">🎻 Música de cuerda</option>
              <option value="pop-rock">🎸 Pop-Rock</option>
              <option value="clasica">🎼 Clásica</option>
              <option value="jazz">🎷 Jazz</option>
              <option value="electronica">🪩 Electrónica</option>
              <option value="folk">🪕 Folk</option>
              <option value="otro">🎵 Otro</option>
            </select>
          </div>

          <div style={{ marginBottom: 24, textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: 6, color: "#9ca3af" }}>
              Biografía
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Cuéntanos sobre ti, tu experiencia musical, proyectos, etc."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 16,
                resize: "vertical"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 32px",
                background: saving ? "#444" : "#10b981",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: "bold",
                cursor: saving ? "not-allowed" : "pointer"
              }}
            >
              {saving ? "Guardando..." : "💾 Guardar perfil"}
            </button>
            <Link
              href="/explore"
              style={{
                padding: "12px 32px",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 16
              }}
            >
              Volver a proyectos
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
