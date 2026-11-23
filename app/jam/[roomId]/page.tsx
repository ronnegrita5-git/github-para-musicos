"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../../context/AuthContext"
import Link from "next/link"

type SignalPayload = 
  | { from: string; type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { from: string; type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { from: string; type: 'candidate'; candidate: RTCIceCandidateInit }

export default function JamRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [peers, setPeers] = useState<Record<string, { instrument?: string }>>({})
  const [isMuted, setIsMuted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>("Iniciando...")
  const [error, setError] = useState<string | null>(null)
  const [audioReady, setAudioReady] = useState(false)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({})
  const channelRef = useRef<any>(null)
  const makingOffer = useRef<Record<string, boolean>>({})
  const ignoreOffer = useRef<Record<string, boolean>>({})
  const remoteAudioRef = useRef<HTMLAudioElement>(null)

  const rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  }

  const getOrCreatePeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId]

    const pc = new RTCPeerConnection(rtcConfig)
    peerConnections.current[peerId] = pc

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0]
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { from: user?.id, type: 'candidate', candidate: event.candidate }
        })
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current[peerId] = true
        await pc.setLocalDescription()
        channelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { from: user?.id, type: 'offer', sdp: pc.localDescription }
        })
      } catch (err) {
        console.error("Error en negociación:", err)
      } finally {
        makingOffer.current[peerId] = false
      }
    }

    return pc
  }, [user?.id])

  const handleSignal = useCallback(async (payload: SignalPayload) => {
    const { from, type } = payload
    if (from === user?.id) return

    const pc = getOrCreatePeerConnection(from)

    try {
      if (type === 'offer') {
        const offerCollision = makingOffer.current[from] || pc.signalingState !== "stable"
        ignoreOffer.current[from] = !offerCollision || Boolean(user?.id && user.id < from)
        
        if (ignoreOffer.current[from]) return

        await pc.setRemoteDescription(payload.sdp)
        await pc.setLocalDescription()
        
        channelRef.current?.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { from: user?.id, type: 'answer', sdp: pc.localDescription }
        })
      } 
      else if (type === 'answer') {
        await pc.setRemoteDescription(payload.sdp)
      } 
      else if (type === 'candidate') {
        if (!ignoreOffer.current[from]) {
          await pc.addIceCandidate(payload.candidate)
        }
      }
    } catch (err) {
      console.error("Error manejando señal de", from, err)
    }
  }, [user?.id, getOrCreatePeerConnection])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/login"); return }
    if (!roomId) return

    let isMounted = true

    const setup = async () => {
      try {
        setConnectionStatus("Solicitando micrófono...")
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!isMounted) return
        localStreamRef.current = stream

        setConnectionStatus("Conectando a la sala...")
        const channel = supabase.channel(`jam_room_${roomId}`, {
          config: { presence: { key: user.id } }
        })
        channelRef.current = channel

        channel
          .on('presence', { event: 'sync' }, () => {
            if (!isMounted) return
            const state = channel.presenceState()
            const otherPeers: Record<string, any> = {}
            Object.keys(state).forEach(key => {
              if (key !== user.id) otherPeers[key] = state[key][0] || {}
            })
            setPeers(otherPeers)
            Object.keys(otherPeers).forEach(peerId => getOrCreatePeerConnection(peerId))
          })
          .on('presence', { event: 'leave' }, ({ key }) => {
            if (peerConnections.current[key]) {
              peerConnections.current[key].close()
              delete peerConnections.current[key]
            }
            setPeers(prev => {
              const next = { ...prev }
              delete next[key]
              return next
            })
          })
          .on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
            handleSignal(payload as SignalPayload)
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && isMounted) {
              setConnectionStatus("En la sala")
              await channel.track({ instrument: "Músico", online_at: new Date().toISOString() })
            }
          })

      } catch (err: any) {
        console.error("Error en setup:", err)
        setError(err.message || "Error al acceder al micrófono o conectar")
        setConnectionStatus("Error")
      }
    }

    setup()

    return () => {
      isMounted = false
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      Object.values(peerConnections.current).forEach(pc => pc.close())
      peerConnections.current = {}
    }
  }, [user, authLoading, roomId, router, getOrCreatePeerConnection, handleSignal])

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }

  if (authLoading) return <div style={{ padding: 30 }}>Cargando...</div>
  if (!user) return null

  return (
    <div style={{ padding: 30, fontFamily: "Arial", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🎸 Sala de Jam: {roomId}</h1>
        <Link href="/explore" style={{ color: "#2b8a3e" }}>← Salir</Link>
      </div>

      <div style={{ background: "#f0f0f0", padding: 15, borderRadius: 8, marginTop: 20 }}>
        <p><strong>Estado:</strong> {connectionStatus}</p>
        <p><strong>Músicos conectados:</strong> {Object.keys(peers).length + 1} (tú + {Object.keys(peers).length})</p>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Participantes:</h3>
        <ul>
          <li>🎤 Tú {isMuted && "(silenciado)"}</li>
          {Object.entries(peers).map(([id, info]) => (
            <li key={id}>🎵 {info.instrument || "Músico"} (ID: {id.slice(0, 8)}...)</li>
          ))}
        </ul>
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {!audioReady && (
        <div style={{ marginTop: 20, padding: 15, background: "#fff3cd", borderRadius: 8 }}>
          <p>🔊 El navegador ha bloqueado el audio. Haz clic para escuchar a los demás músicos:</p>
          <button
            onClick={() => {
              remoteAudioRef.current?.play().catch(e => console.error("Error al reproducir:", e))
              setAudioReady(true)
            }}
            style={{
              padding: "10px 20px",
              background: "#2b8a3e",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            Habilitar audio
          </button>
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        <button
          onClick={toggleMute}
          style={{
            padding: "12px 24px",
            background: isMuted ? "#dc3545" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {isMuted ? "🔇 Activar micrófono" : "🎤 Silenciar"}
        </button>
      </div>
    </div>
  )
}
