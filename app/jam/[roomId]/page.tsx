"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../../context/AuthContext"
import Link from "next/link"

type SignalPayload = { from: string; to: string } & (
  | { type: "description"; description: RTCSessionDescriptionInit }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
)

type Peer = {
  pc: RTCPeerConnection
  makingOffer: boolean
  ignoreOffer: boolean
  settingAnswer: boolean
}

// TURN opcional: se configura con variables de entorno (en Vercel y en .env.local)
const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]
if (process.env.NEXT_PUBLIC_TURN_URL) {
  iceServers.push({
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME,
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
  })
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    el.play().catch((e) => console.warn("Reproducción bloqueada:", e))
  }, [stream])

  return <audio ref={ref} autoPlay playsInline data-remote />
}

export default function JamRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const router = useRouter()

  const [peerIds, setPeerIds] = useState<string[]>([])
  const [streams, setStreams] = useState<Record<string, MediaStream>>({})
  const [states, setStates] = useState<Record<string, string>>({})
  const [isMuted, setIsMuted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Iniciando...")
  const [error, setError] = useState<string | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      router.push("/login")
      return
    }
    if (!roomId) return

    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    let localStream: MediaStream | null = null
    const peers = new Map<string, Peer>()
    // Un ID por pestaña: permite probar con la misma cuenta en dos dispositivos
    const myId = crypto.randomUUID()

    setPeerIds([])
    setStreams({})
    setStates({})
    setIsMuted(false)
    setError(null)

    type Outgoing =
      | { type: "description"; description: RTCSessionDescriptionInit }
      | { type: "candidate"; candidate: RTCIceCandidateInit }

    const send = (to: string, data: Outgoing) => {
      channel?.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: { from: myId, to, ...data },
      })
    }

    const getPeer = (peerId: string): Peer => {
      const existing = peers.get(peerId)
      if (existing) return existing

      const pc = new RTCPeerConnection({ iceServers })
      const peer: Peer = { pc, makingOffer: false, ignoreOffer: false, settingAnswer: false }
      peers.set(peerId, peer)

      pc.ontrack = ({ track, streams: [remote] }) => {
        const stream = remote ?? new MediaStream([track])
        setStreams((prev) => ({ ...prev, [peerId]: stream }))
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) send(peerId, { type: "candidate", candidate: candidate.toJSON() })
      }

      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true
          await pc.setLocalDescription()
          send(peerId, { type: "description", description: pc.localDescription!.toJSON() })
        } catch (err) {
          console.error("Error en negociación:", err)
        } finally {
          peer.makingOffer = false
        }
      }

      pc.onconnectionstatechange = () => {
        console.log("Conexión con", peerId, pc.connectionState)
        setStates((prev) => ({ ...prev, [peerId]: pc.connectionState }))
        if (pc.connectionState === "failed") pc.restartIce()
      }

      localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream!))
      return peer
    }

    const removePeer = (peerId: string) => {
      peers.get(peerId)?.pc.close()
      peers.delete(peerId)
      setStreams((prev) => {
        const next = { ...prev }
        delete next[peerId]
        return next
      })
      setStates((prev) => {
        const next = { ...prev }
        delete next[peerId]
        return next
      })
    }

    // Patrón "perfect negotiation"
    const handleSignal = async (msg: SignalPayload) => {
      if (!active || msg.to !== myId) return
      const peer = getPeer(msg.from)
      const { pc } = peer

      try {
        if (msg.type === "description") {
          const { description } = msg
          const readyForOffer =
            !peer.makingOffer && (pc.signalingState === "stable" || peer.settingAnswer)
          const collision = description.type === "offer" && !readyForOffer
          const polite = myId > msg.from

          // Solo el par "no cortés" ignora una oferta, y solo si hay colisión
          peer.ignoreOffer = !polite && collision
          if (peer.ignoreOffer) return

          peer.settingAnswer = description.type === "answer"
          await pc.setRemoteDescription(description)
          peer.settingAnswer = false

          if (description.type === "offer") {
            await pc.setLocalDescription()
            send(msg.from, { type: "description", description: pc.localDescription!.toJSON() })
          }
        } else {
          try {
            await pc.addIceCandidate(msg.candidate)
          } catch (err) {
            if (!peer.ignoreOffer) throw err
          }
        }
      } catch (err) {
        console.error("Error manejando señal de", msg.from, err)
      }
    }

    const setup = async () => {
      try {
        setConnectionStatus("Solicitando micrófono...")
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStream = stream
        localStreamRef.current = stream

        setConnectionStatus("Conectando a la sala...")
        const ch = supabase.channel(`jam_room_${roomId}`, {
          config: { presence: { key: myId } },
        })
        channel = ch

        ch.on("presence", { event: "sync" }, () => {
          if (!active) return
          const others = Object.keys(ch.presenceState()).filter((id) => id !== myId)
          Array.from(peers.keys())
            .filter((id) => !others.includes(id))
            .forEach(removePeer)
          others.forEach(getPeer)
          setPeerIds(others)
        })
          .on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
            handleSignal(payload as SignalPayload)
          })
          .subscribe(async (status) => {
            if (!active) return
            if (status === "SUBSCRIBED") {
              setConnectionStatus("En la sala")
              await ch.track({ online_at: new Date().toISOString() })
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setConnectionStatus("Error de conexión con la sala")
            }
          })
      } catch (err) {
        console.error("Error en setup:", err)
        if (!active) return
        setError(err instanceof Error ? err.message : "Error al acceder al micrófono o conectar")
        setConnectionStatus("Error")
      }
    }

    setup()

    return () => {
      active = false
      localStream?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      peers.forEach(({ pc }) => pc.close())
      peers.clear()
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId, authLoading, roomId, router])

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
  }

  const enableAudio = () => {
    document
      .querySelectorAll<HTMLAudioElement>("audio[data-remote]")
      .forEach((el) => el.play().catch((e) => console.warn(e)))
  }

  if (authLoading) return <div style={{ padding: 30 }}>Cargando...</div>
  if (!user) return null

  const button = {
    padding: "12px 24px",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
  }

  return (
    <div style={{ padding: 30, fontFamily: "Arial", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🎸 Sala de Jam: {roomId}</h1>
        <Link href="/explore" style={{ color: "#2b8a3e" }}>← Salir</Link>
      </div>

      <div style={{ background: "#f0f0f0", padding: 15, borderRadius: 8, marginTop: 20 }}>
        <p><strong>Estado:</strong> {connectionStatus}</p>
        <p><strong>Músicos conectados:</strong> {peerIds.length + 1} (tú + {peerIds.length})</p>
        <p>🎧 Usa auriculares para evitar acoples.</p>
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Participantes:</h3>
        <ul>
          <li>🎤 Tú {isMuted && "(silenciado)"}</li>
          {peerIds.map((id) => (
            <li key={id}>
              🎵 Músico ({id.slice(0, 8)}) · conexión: {states[id] ?? "new"} · audio:{" "}
              {streams[id] ? "✅" : "⏳"}
            </li>
          ))}
        </ul>
      </div>

      {Object.entries(streams).map(([id, stream]) => (
        <RemoteAudio key={id} stream={stream} />
      ))}

      <div style={{ marginTop: 30, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={toggleMute} style={{ ...button, background: isMuted ? "#dc3545" : "#28a745" }}>
          {isMuted ? "🔇 Activar micrófono" : "🎤 Silenciar"}
        </button>
        <button onClick={enableAudio} style={{ ...button, background: "#2b8a3e" }}>
          🔊 ¿No oyes nada? Activar audio
        </button>
      </div>
    </div>
  )
}
