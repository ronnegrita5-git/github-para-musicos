"use client"

import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [instrument, setInstrument] = useState("")
  const [genre, setGenre] = useState("")
  const [bio, setBio] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setLoading(true)

    try {
      // ✅ Crear objeto con los datos del usuario (sin first_name)
      const userData = {
        // Supabase solo acepta campos estándar en user_metadata
        // Los datos adicionales se guardan en la tabla 'users'
        email: email,
        // No pasamos first_name porque no existe en User de Supabase
      }

      await signUp(email, password)

      // ✅ Guardar datos adicionales en la tabla 'users' después del registro
      // Esto se maneja en AuthContext
      
      alert("✅ Registro exitoso. Revisa tu correo para confirmar la cuenta.")
      router.push("/login")
    } catch (err: any) {
      console.error("Error en registro:", err)
      setError(err.message || "Error al registrarse")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "black",
      padding: "20px"
    }}>
      <div style={{
        background: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        padding: "40px",
        maxWidth: "500px",
        width: "100%",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <h1 style={{ fontSize: 28, marginBottom: 8, color: "white" }}>🎵 Registrarse</h1>
        <p style={{ color: "#9ca3af", marginBottom: 24 }}>
          Crea tu cuenta para comenzar a colaborar
        </p>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            padding: "12px",
            borderRadius: 6,
            color: "#ef4444",
            marginBottom: 16
          }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ color: "#d1d5db", fontSize: 14, display: "block", marginBottom: 4 }}>Nombre</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: 6,
                  color: "white"
                }}
              />
            </div>
            <div>
              <label style={{ color: "#d1d5db", fontSize: 14, display: "block", marginBottom: 4 }}>Apellido</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: 6,
                  color: "white"
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ color: "#d1d5db", fontSize: 14, display: "block", marginBottom: 4 }}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 6,
                color: "white"
              }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ color: "#d1d5db", fontSize: 14, display: "block", marginBottom: 4 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 6,
                color: "white"
              }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ color: "#d1d5db", fontSize: 14, display: "block", marginBottom: 4 }}>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 6,
                color: "white"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: 20,
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "default" : "pointer",
              fontWeight: "bold",
              fontSize: 16,
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>
        </form>

        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 16, textAlign: "center" }}>
          ¿Ya tienes cuenta? <Link href="/login" style={{ color: "#10b981", textDecoration: "none" }}>Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
