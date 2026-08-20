"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type JamSession = {
  id: string
  name: string
  category: string
  instrument: string
  owner_id: string
  is_active: boolean
  created_at: string
  participants?: number
}

export default function DiscoverPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<JamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<JamSession | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [audioTest, setAudioTest] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string>("")
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

  const CATEGORIES: Record<string, { name: string; emoji: string }> = {
    'all': { name: 'Todas', emoji: '🎵' },
    'viento': { name: 'Viento', emoji: '🎷' },
    'cuerda': { name: 'Cuerda', emoji: '🎻' },
    'moderna': { name: 'Rock', emoji: '🎸' }
  }

  const getInstrumentEmoji = (instrument: string) => {
    const emojis: Record<string, string> = {
      'Trompeta': '🎺', 'Saxofón': '🎷', 'Trombón': '🎺',
      'Clarinete': '🎵', 'Flauta': '🎵', 'Tuba': '🎵',
      'Violín': '🎻', 'Viola': '🎻', 'Violonchelo': '🎻',
      'Contrabajo': '🎻', 'Arpa': '🎵', 'Piano': '🎹',
      'Guitarra': '🎸', 'Bajo': '🎸', 'Batería': '🥁',
      'Teclado': '🎹', 'Voz': '🎤', 'Sintetizador': '🎹'
    }
    return emojis[instrument] || '🎵'
  }

  const loadSessions = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('jam_sessions')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory)
      }

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) throw error
      
      const sessionsWithParticipants = (data || []).map(s => ({
        ...s,
        participants: Math.floor(Math.random() * 5) + 1
      }))
      
      setSessions(sessionsWithParticipants)
    } catch (error) {
      console.error('Error cargando sesiones:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [filterCategory, searchTerm])

  // ============ WEBRTC ============
  const PEER_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }

  const cleanupPeerConnection = (targetId: string) => {
    console.log('🧹 Limpiando conexión con:', targetId)
    const pc = peerConnectionsRef.current.get(targetId)
    if (pc) {
      pc.close()
      peerConnectionsRef.current.delete(targetId)
    }
    const audioEl = audioElementsRef.current.get(targetId)
    if (audioEl) {
      audioEl.pause()
      audioEl.srcObject = null
      audioElementsRef.current.delete(targetId)
    }
  }

  const createPeerConnection = (targetId: string) => {
    console.log(`🔗 Creando conexión con: ${targetId}`)
    const pc = new RTCPeerConnection(PEER_CONFIG)
    peerConnectionsRef.current.set(targetId, pc)

    // ✅ Soy oyente, NO añado tracks locales
    console.log('📤 Oyente - no añadiendo tracks')

    pc.ontrack = (event) => {
      console.log(`📥 Audio remoto recibido de: ${targetId}`)
      console.log(`📥 Streams: ${event.streams.length}, Tracks: ${event.streams[0]?.getTracks().length}`)
      
      let audioEl = audioElementsRef.current.get(targetId)
      if (!audioEl) {
        audioEl = new Audio()
        audioEl.autoplay = true
        audioEl.volume = 1.0
        audioElementsRef.current.set(targetId, audioEl)
        console.log('🔊 Nuevo elemento de audio creado para:', targetId)
      }
      
      try {
        audioEl.srcObject = event.streams[0]
        audioEl.play().then(() => {
          console.log(`✅ Audio reproduciéndose para: ${targetId}`)
          setAudioTest(`🔊 Escuchando`)
        }).catch(e => {
          console.log('❌ Error playing audio:', e)
          setAudioTest(`❌ Error al reproducir`)
        })
      } catch (e) {
        console.error('❌ Error asignando srcObject:', e)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log('🧊 ICE candidate enviado a:', targetId)
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            fromId: userIdRef.current,
            targetId: targetId,
            candidate: event.candidate
          }
        })
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log(`🔗 Estado de conexión con ${targetId.slice(0, 6)}:`, state)
      
      if (state === 'connected') {
        setAudioTest(`✅ Conectado`)
        console.log('✅ Conexión establecida correctamente')
      }
      
      if (state === 'disconnected' || state === 'failed') {
        console.log(`⚠️ Conexión perdida con ${targetId.slice(0, 6)}`)
        cleanupPeerConnection(targetId)
        setAudioTest(`⚠️ Desconectado`)
      }
    }

    return pc
  }

  const createOffer = async (targetId: string) => {
    try {
      console.log(`📤 Creando oferta para: ${targetId}`)
      
      if (peerConnectionsRef.current.has(targetId)) {
        console.log(`⚠️ Ya existe conexión con ${targetId}`)
        return
      }
      
      const pc = createPeerConnection(targetId)
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      })
      
      console.log('📤 Oferta creada, estableciendo local description...')
      await pc.setLocalDescription(offer)
      console.log('📤 Local description establecido')
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            fromId: userIdRef.current,
            targetId: targetId,
            offer: offer
          }
        })
        console.log('📤 Oferta enviada a:', targetId)
      } else {
        console.error('❌ No hay canal para enviar la oferta')
      }
    } catch (error) {
      console.error('❌ Error creando oferta:', error)
    }
  }

  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit) => {
    try {
      console.log('📥 Oferta recibida de:', fromId)
      const pc = createPeerConnection(fromId)
      
      console.log('📥 Estableciendo remote description...')
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      console.log('📥 Remote description establecido')
      
      const answer = await pc.createAnswer()
      console.log('📥 Answer creado')
      
      await pc.setLocalDescription(answer)
      console.log('📥 Local description establecido (answer)')
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            fromId: userIdRef.current,
            targetId: fromId,
            answer: answer
          }
        })
        console.log('📥 Answer enviado a:', fromId)
      }
    } catch (error) {
      console.error('❌ Error manejando oferta:', error)
    }
  }

  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    try {
      console.log('📥 Answer recibido de:', fromId)
      const pc = peerConnectionsRef.current.get(fromId)
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        console.log('📥 Remote description establecido (answer)')
      } else {
        console.warn('⚠️ No se encontró peer connection para:', fromId)
      }
    } catch (error) {
      console.error('❌ Error manejando answer:', error)
    }
  }

  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    try {
      console.log('🧊 ICE candidate recibido de:', fromId)
      const pc = peerConnectionsRef.current.get(fromId)
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        console.log('🧊 ICE candidate añadido')
      }
    } catch (error) {
      console.error('❌ Error añadiendo ICE candidate:', error)
    }
  }

  const connectToAll = async () => {
    if (!channelRef.current) {
      console.warn('⚠️ No hay canal para conectar')
      return
    }
    
    try {
      const presenceState = channelRef.current.presenceState()
      console.log('📡 Estado de presencia:', presenceState)
      
      const participants = Object.values(presenceState).flat() as any[]
      const others = participants.filter((p: any) => p.id !== userIdRef.current)
      
      console.log(`🔗 Conectando con ${others.length} participantes:`, others.map((p: any) => p.name))
      
      for (const p of others) {
        if (!peerConnectionsRef.current.has(p.id)) {
          console.log(`🔗 Creando oferta para: ${p.name} (${p.id.slice(0,6)})`)
          await createOffer(p.id)
        } else {
          console.log(`⏭️ Ya conectado con: ${p.name}`)
        }
      }
    } catch (error) {
      console.error('❌ Error en connectToAll:', error)
    }
  }

  // ============ ESCUCHAR SALA ============
  const connectToRoom = async (sessionId: string) => {
    try {
      console.log('🔍 Conectando a sala:', sessionId)
      userIdRef.current = user?.id || `listener-${Date.now()}`
      console.log('🔍 userId:', userIdRef.current)
      
      // Limpiar conexiones anteriores
      peerConnectionsRef.current.forEach((pc) => pc.close())
      peerConnectionsRef.current.clear()
      audioElementsRef.current.forEach((audio) => {
        audio.pause()
        audio.srcObject = null
      })
      audioElementsRef.current.clear()
      
      const channel = supabase.channel(`jam:${sessionId}`)
      channelRef.current = channel

      channel
        .on('broadcast', { event: 'offer' }, ({ payload }) => {
          console.log('🔍 Oferta recibida:', payload)
          if (payload.targetId === userIdRef.current) {
            handleOffer(payload.fromId, payload.offer)
          }
        })
        .on('broadcast', { event: 'answer' }, ({ payload }) => {
          console.log('🔍 Answer recibido:', payload)
          if (payload.targetId === userIdRef.current) {
            handleAnswer(payload.fromId, payload.answer)
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          console.log('🔍 ICE candidate recibido:', payload)
          if (payload.targetId === userIdRef.current) {
            handleIceCandidate(payload.fromId, payload.candidate)
          }
        })
        .subscribe(async (status) => {
          console.log('🔍 Estado del canal:', status)
          
          if (status === 'SUBSCRIBED') {
            console.log('🔍 Canal suscrito, trackeando presencia...')
            
            await channel.track({
              id: userIdRef.current,
              name: '🎧 Oyente',
              instrument: '🎧 Escuchando',
              isAdmin: false,
              isListener: true
            })
            
            console.log('✅ Presencia trackeada')
            
            // Esperar a que los participantes estén presentes
            setTimeout(() => {
              console.log('🔍 Conectando a todos...')
              connectToAll()
            }, 2000)
          }
        })

      setAudioTest("✅ Conectado a la sala")
      return true
    } catch (error) {
      console.error('❌ Error conectando a sala:', error)
      setAudioTest("❌ Error al conectar")
      return false
    }
  }

  const listenToSession = async (session: JamSession) => {
    if (selectedSession?.id === session.id && isListening) {
      stopListening()
      return
    }

    if (isListening) {
      stopListening()
    }

    setSelectedSession(session)
    setIsListening(true)
    setAudioTest("🔄 Conectando...")

    console.log('🎧 Escuchando sala:', session.name, session.id)
    const connected = await connectToRoom(session.id)
    
    if (!connected) {
      setIsListening(false)
      setAudioTest("❌ Error al conectar")
    }
  }

  const stopListening = () => {
    console.log('🚪 Dejando de escuchar...')
    
    if (channelRef.current) {
      try {
        channelRef.current.untrack()
        channelRef.current.unsubscribe()
      } catch (e) {
        console.log('Error limpiando canal:', e)
      }
      channelRef.current = null
    }
    
    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()
    
    audioElementsRef.current.forEach((audio) => {
      audio.pause()
      audio.srcObject = null
    })
    audioElementsRef.current.clear()
    
    setIsListening(false)
    setSelectedSession(null)
    setAudioTest("")
    console.log('✅ Conexiones limpiadas')
  }

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [])

  // ============ UI ============
  if (!user) {
    return (
      <div style={{ padding: 40, color: "white", textAlign: "center" }}>
        <p>🔒 Debes iniciar sesión</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#0a0a0a", 
      color: "white", 
      padding: "20px",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "24px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>🎵 JamTube</h1>
          <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>
            Descubre música en vivo {isListening && `· 🔴 Escuchando ${selectedSession?.name}`}
          </p>
          {audioTest && (
            <span style={{ 
              fontSize: 12, 
              color: audioTest.includes("✅") || audioTest.includes("🔊") ? "#10b981" : audioTest.includes("🔄") ? "#fbbf24" : "#ef4444"
            }}>
              {audioTest}
            </span>
          )}
        </div>
        
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/jam-web">
            <button style={{
              padding: "10px 20px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: "bold",
              cursor: "pointer"
            }}>
              🎸 Crear Sala
            </button>
          </Link>
          {isListening && (
            <button
              onClick={stopListening}
              style={{
                padding: "10px 20px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              ⏹ Dejar de escuchar
            </button>
          )}
        </div>
      </div>

      <div style={{ 
        display: "flex", 
        gap: "12px", 
        marginBottom: "24px",
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <input
          type="text"
          placeholder="🔍 Buscar salas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "rgba(255,255,255,0.05)",
            color: "white",
            fontSize: 14,
            flex: 1,
            minWidth: "200px"
          }}
        />
        
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              style={{
                padding: "6px 14px",
                background: filterCategory === key ? "#10b981" : "rgba(255,255,255,0.05)",
                color: filterCategory === key ? "white" : "#9ca3af",
                border: filterCategory === key ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                cursor: "pointer",
                fontSize: 13
              }}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
        
        <button
          onClick={loadSessions}
          style={{
            padding: "6px 14px",
            background: "rgba(255,255,255,0.05)",
            color: "#9ca3af",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            cursor: "pointer",
            fontSize: 13
          }}
        >
          🔄 Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎵</div>
          <p>Cargando salas...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ 
          textAlign: "center", 
          padding: "60px 0", 
          color: "#6b7280",
          border: "2px dashed rgba(255,255,255,0.05)",
          borderRadius: 16
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎧</div>
          <p style={{ fontSize: 18 }}>No hay salas públicas activas</p>
          <p style={{ fontSize: 14 }}>Crea una sala para empezar a tocar</p>
          <Link href="/jam-web">
            <button style={{
              marginTop: 16,
              padding: "10px 24px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: "bold",
              cursor: "pointer"
            }}>
              🎸 Crear primera sala
            </button>
          </Link>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px"
        }}>
          {sessions.map((session) => {
            const isSelected = selectedSession?.id === session.id
            const categoryInfo = CATEGORIES[session.category as keyof typeof CATEGORIES] || CATEGORIES['all']
            
            return (
              <div
                key={session.id}
                style={{
                  background: isSelected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  padding: "16px",
                  border: isSelected ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}
                onClick={() => listenToSession(session)}
              >
                <div style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "rgba(239,68,68,0.2)",
                  padding: "2px 10px",
                  borderRadius: 12,
                  fontSize: 11,
                  color: "#ef4444"
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#ef4444",
                    display: "inline-block",
                    animation: "pulse 1.5s ease-in-out infinite"
                  }} />
                  En vivo
                </div>

                <div style={{
                  fontSize: 48,
                  textAlign: "center",
                  padding: "16px 0",
                  opacity: isSelected ? 1 : 0.5
                }}>
                  {categoryInfo.emoji}
                </div>

                <h3 style={{
                  margin: "8px 0 4px 0",
                  fontSize: 16,
                  color: isSelected ? "#10b981" : "white",
                  textAlign: "center"
                }}>
                  {session.name || session.id.slice(0, 8)}
                </h3>
                
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "12px",
                  fontSize: 13,
                  color: "#6b7280",
                  marginBottom: "12px"
                }}>
                  <span>{getInstrumentEmoji(session.instrument)} {session.instrument || "Sin instrumento"}</span>
                  <span>👤 {session.participants || 0}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    listenToSession(session)
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: isSelected ? "#ef4444" : "#8b5cf6",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: 14
                  }}
                >
                  {isSelected ? "⏹ Dejar de escuchar" : "🎧 Escuchar"}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
