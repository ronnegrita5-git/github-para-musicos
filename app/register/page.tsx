"use client"

import { useAuth } from "../context/AuthContext"
import Link from "next/link"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface Instrument {
  id: string
  name: string
  category: string
}

export default function RegisterPage() {
  const { user, loading, signUp } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [instrumentId, setInstrumentId] = useState("")
  const [musicGenre, setMusicGenre] = useState("")
  const [bio, setBio] = useState("")
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchInstruments = async () => {
      try {
        const { data, error } = await supabase
          .from("instruments")
          .select("id, name, category")
          .order("name", { ascending: true })

        if (error) throw error
        setInstruments(data || [])
      } catch (error) {
        console.error("Error cargando instrumentos:", error)
      } finally {
        setLoadingInstruments(false)
      }
    }

    fetchInstruments()
  }, [])

  useEffect(() => {
    if (user) {
      window.location.href = '/explore'
    }
  }, [user])

  if (loading) {
    return <div style={{ color: 'white', padding: 40 }}>Cargando...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('❌ Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('❌ La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoadingSubmit(true)

    try {
      // ✅ Pasar undefined en lugar de null
      await signUp(email, password, {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        city: city || undefined,
        country: country || undefined,
        instrument_id: instrumentId || undefined,
        music_genre: musicGenre || undefined,
        bio: bio || undefined,
      })
      
      setSuccess(true)
      setTimeout(() => {
        window.location.href = '/explore'
      }, 1500)
    } catch (err) {
      setError('❌ ' + (err as Error).message)
    } finally {
      setLoadingSubmit(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0a0a0a',
      color: 'white',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: 500,
        width: '100%',
        padding: 40,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
        <h2 style={{ marginBottom: 24 }}>Crear cuenta</h2>

        {error && (
          <div style={{
            padding: 10,
            marginBottom: 16,
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            borderRadius: 8,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: 10,
            marginBottom: 16,
            background: 'rgba(16,185,129,0.1)',
            color: '#10b981',
            borderRadius: 8,
            fontSize: 14
          }}>
            ✅ ¡Registro exitoso! Redirigiendo...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Correo electrónico *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Contraseña *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Confirmar contraseña *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <hr style={{ borderColor: '#333', margin: '20px 0' }} />

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Nombre
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Apellidos
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Población
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              País
            </label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16
              }}
            />
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Instrumento que tocas
            </label>
            <select
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: '#1a1a1a',
                color: 'white',
                fontSize: 16
              }}
            >
              <option value="">Selecciona un instrumento</option>
              {loadingInstruments ? (
                <option disabled>Cargando instrumentos...</option>
              ) : (
                instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} {inst.category ? `(${inst.category})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Género musical
            </label>
            <select
              value={musicGenre}
              onChange={(e) => setMusicGenre(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: '#1a1a1a',
                color: 'white',
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

          <div style={{ marginBottom: 24, textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#9ca3af' }}>
              Biografía (cuéntanos sobre ti)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #333',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontSize: 16,
                resize: 'vertical'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loadingSubmit || success}
            style={{
              width: '100%',
              padding: '14px',
              background: loadingSubmit || success ? '#444' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 'bold',
              cursor: loadingSubmit || success ? 'not-allowed' : 'pointer'
            }}
          >
            {loadingSubmit ? 'Registrando...' : success ? '✅ Registrado' : 'Registrarse'}
          </button>
        </form>

        <div style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>
          ¿Ya tienes cuenta? <Link href="/login" style={{ color: '#10b981' }}>Inicia sesión</Link>
        </div>
      </div>
    </div>
  )
}
