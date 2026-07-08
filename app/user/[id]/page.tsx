"use client"

import React, { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useAuth } from "@/app/context/AuthContext"
import Breadcrumbs from "../../components/Breadcrumbs"
import FollowButton from "../../components/FollowButton"

export default function UserProfilePage({ params }: any) {
  const { id } = React.use(params)
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  useEffect(() => {
    loadProfile()
    loadProjects()
    loadFavorites()
  }, [id])

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single()
    
    setProfile(data)
    if (user && data) {
      setIsOwnProfile(user.id === data.id)
    }
    setLoading(false)
  }

  async function loadProjects() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
    
    setProjects(data || [])
  }

  async function loadFavorites() {
    const { data: likes, error: likesError } = await supabase
      .from("likes")
      .select("project_id")
      .eq("user_id", id)

    if (likesError) {
      console.error("Error al cargar favoritos:", likesError)
      return
    }

    if (likes && likes.length > 0) {
      const projectIds = likes.map((l) => l.project_id)
      
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .in("id", projectIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false })

      if (!projectsError) {
        setFavorites(projectsData || [])
      }
    } else {
      setFavorites([])
    }
  }

  if (loading) return (
    <div style={{ padding: 30, fontFamily: "'Inter', sans-serif", textAlign: "center" }}>
      <p style={{ color: "#6b7280" }}>Cargando perfil...</p>
    </div>
  )

  if (!profile) return (
    <div style={{ padding: 30, fontFamily: "'Inter', sans-serif", textAlign: "center" }}>
      <h2 style={{ color: "white" }}>👤 Usuario no encontrado</h2>
      <Link href="/" style={{ color: "#10b981" }}>← Volver al inicio</Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 30, fontFamily: "'Inter', sans-serif" }}>
      <Breadcrumbs />
      
      <Link href="/" style={{ color: "#10b981", textDecoration: "none" }}>
        ← Volver al inicio
      </Link>

      <div style={{ 
        background: "rgba(255,255,255,0.03)",
        borderRadius: 16, 
        padding: 30, 
        marginTop: 20,
        border: "1px solid rgba(16, 185, 129, 0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {profile.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Avatar" 
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} 
            />
          ) : (
            <div style={{ 
              width: 80, height: 80, 
              borderRadius: "50%", 
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              fontSize: 32, 
              color: "white" 
            }}>
              🎵
            </div>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: "white" }}>
              {profile.full_name || profile.email?.split('@')[0] || "Usuario"}
            </h1>
            <p style={{ margin: 0, color: "#6b7280" }}>
              📅 Miembro desde {new Date(profile.created_at).toLocaleDateString()}
            </p>
            {isOwnProfile && (
              <Link href="/profile" style={{ color: "#10b981", fontSize: 14 }}>
                ✏️ Editar perfil
              </Link>
            )}
          </div>
        </div>

        {/* Botón de seguir */}
        <div style={{ marginTop: 15 }}>
          <FollowButton userId={id} />
        </div>

        {profile.bio && (
          <p style={{ marginTop: 15, fontSize: 16, color: "#e5e5e5" }}>
            {profile.bio}
          </p>
        )}

        {(profile.country || profile.city) && (
          <p style={{ color: "#6b7280", marginTop: 10 }}>
            📍 {[profile.city, profile.country].filter(Boolean).join(", ")}
          </p>
        )}

        {profile.genres && profile.genres.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 15 }}>
            {profile.genres.map((g: string) => (
              <span key={g} style={{ 
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white", 
                padding: "4px 12px", 
                borderRadius: 20, 
                fontSize: 14 
              }}>
                {g}
              </span>
            ))}
          </div>
        )}

        {profile.social_links && (
          <div style={{ display: "flex", gap: 15, marginTop: 15, flexWrap: "wrap" }}>
            {profile.social_links.instagram && (
              <a href={`https://instagram.com/${profile.social_links.instagram}`} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", textDecoration: "none" }}>
                📸 {profile.social_links.instagram}
              </a>
            )}
            {profile.social_links.youtube && (
              <a href={`https://youtube.com/${profile.social_links.youtube}`} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", textDecoration: "none" }}>
                ▶️ {profile.social_links.youtube}
              </a>
            )}
            {profile.social_links.twitter && (
              <a href={`https://twitter.com/${profile.social_links.twitter}`} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", textDecoration: "none" }}>
                🐦 {profile.social_links.twitter}
              </a>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", textDecoration: "none" }}>
                🌐 {profile.website}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Proyectos del usuario */}
      <div style={{ marginTop: 30 }}>
        <h2 style={{ fontSize: 22, color: "white" }}>
          🎸 Proyectos ({projects.length})
        </h2>
        
        {projects.length === 0 ? (
          <p style={{ color: "#6b7280" }}>
            {isOwnProfile ? "No tienes proyectos públicos todavía." : "Este usuario no tiene proyectos públicos."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {projects.map((p) => (
              <Link key={p.id} href={`/project/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ 
                  padding: 15, 
                  border: "1px solid rgba(16, 185, 129, 0.1)", 
                  borderRadius: 12, 
                  background: "rgba(255,255,255,0.03)",
                  transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.01)"
                  e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.3)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)"
                  e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.1)"
                }}>
                  <h3 style={{ margin: 0, color: "#10b981" }}>🎵 {p.name}</h3>
                  <p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 14 }}>
                    {p.description || "Sin descripción"}
                  </p>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>
                    📅 {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Proyectos favoritos del usuario */}
      {favorites.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 22, color: "white" }}>
            ❤️ Proyectos favoritos ({favorites.length})
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {favorites.map((p) => (
              <Link key={p.id} href={`/project/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ 
                  padding: 15, 
                  border: "1px solid rgba(16, 185, 129, 0.1)", 
                  borderRadius: 12, 
                  background: "rgba(255,255,255,0.03)",
                  transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.01)"
                  e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.3)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)"
                  e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.1)"
                }}>
                  <h3 style={{ margin: 0, color: "#10b981" }}>🎵 {p.name}</h3>
                  <p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 14 }}>
                    {p.description || "Sin descripción"}
                  </p>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5 }}>
                    📅 {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
