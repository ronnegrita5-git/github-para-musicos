"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"
import Link from "next/link"
import * as Tone from "tone"
import { WebMidi } from "webmidi"

// Notas disponibles
const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

// Mapeo de notas MIDI (60 = C4)
const MIDI_TO_NOTE: Record<number, string> = {
  60: 'C4', 61: 'C#4', 62: 'D4', 63: 'D#4', 64: 'E4',
  65: 'F4', 66: 'F#4', 67: 'G4', 68: 'G#4', 69: 'A4',
  70: 'A#4', 71: 'B4', 72: 'C5'
}

// 🎸 Definición de instrumentos con samples reales
type InstrumentType = 'piano' | 'guitarra-limpia' | 'guitarra-distorsionada' | 'bajo' | 'bateria' | 'organo-hammond'

interface InstrumentConfig {
  name: string
  icon: string
  description: string
  samplePath: string
  notes: Record<string, string>
}

const INSTRUMENTS: Record<InstrumentType, InstrumentConfig> = {
  'piano': {
    name: 'Piano',
    icon: '🎹',
    description: 'Piano de cola',
    samplePath: 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/piano/',
    notes: {
      'C4': 'C4.mp3', 'C#4': 'Cs4.mp3', 'D4': 'D4.mp3', 'D#4': 'Ds4.mp3',
      'E4': 'E4.mp3', 'F4': 'F4.mp3', 'F#4': 'Fs4.mp3', 'G4': 'G4.mp3',
      'G#4': 'Gs4.mp3', 'A4': 'A4.mp3', 'A#4': 'As4.mp3', 'B4': 'B4.mp3',
      'C5': 'C5.mp3'
    }
  },
  'guitarra-limpia': {
    name: 'Guitarra Limpia',
    icon: '🎸',
    description: 'Guitarra acústica',
    samplePath: 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/guitar-acoustic/',
    notes: {
      'C4': 'C4.mp3', 'C#4': 'Cs4.mp3', 'D4': 'D4.mp3', 'D#4': 'Ds4.mp3',
      'E4': 'E4.mp3', 'F4': 'F4.mp3', 'F#4': 'Fs4.mp3', 'G4': 'G4.mp3',
      'G#4': 'Gs4.mp3', 'A4': 'A4.mp3', 'A#4': 'As4.mp3', 'B4': 'B4.mp3',
      'C5': 'C5.mp3'
    }
  },
  'guitarra-distorsionada': {
    name: 'Guitarra Distorsionada',
    icon: '🤘',
    description: 'Guitarra eléctrica con distorsión',
    samplePath: 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/guitar-electric/',
    notes: {
      'C4': 'C4.mp3', 'C#4': 'Cs4.mp3', 'D4': 'D4.mp3', 'D#4': 'Ds4.mp3',
      'E4': 'E4.mp3', 'F4': 'F4.mp3', 'F#4': 'Fs4.mp3', 'G4': 'G4.mp3',
      'G#4': 'Gs4.mp3', 'A4': 'A4.mp3', 'A#4': 'As4.mp3', 'B4': 'B4.mp3',
      'C5': 'C5.mp3'
    }
  },
  'bajo': {
    name: 'Bajo',
    icon: '🎸',
    description: 'Bajo eléctrico',
    samplePath: 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/bass-electric/',
    notes: {
      'C4': 'C4.mp3', 'C#4': 'Cs4.mp3', 'D4': 'D4.mp3', 'D#4': 'Ds4.mp3',
      'E4': 'E4.mp3', 'F4': 'F4.mp3', 'F#4': 'Fs4.mp3', 'G4': 'G4.mp3',
      'G#4': 'Gs4.mp3', 'A4': 'A4.mp3', 'A#4': 'As4.mp3', 'B4': 'B4.mp3',
      'C5': 'C5.mp3'
    }
  },
  'bateria': {
    name: 'Batería',
    icon: '🥁',
    description: 'Kit de batería acústica',
    samplePath: 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/drums/',
    notes: {
      'C4': 'kick.mp3', 'D4': 'snare.mp3', 'E4': 'tom-low.mp3',
      'F4': 'tom-mid.mp3', 'G4': 'tom-high.mp3', 'A4': 'hat-closed.mp3',
      'B4': 'hat-open.mp3', 'C5': 'crash.mp3'
    }
  },
  'organo-hammond': {
    name: 'Órgano Hammond',
    icon: '🎹',
    description: 'Órgano Hammond B3',
    samplePath: 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments/samples/organ/',
    notes: {
      'C4': 'C4.mp3', 'C#4': 'Cs4.mp3', 'D4': 'D4.mp3', 'D#4': 'Ds4.mp3',
      'E4': 'E4.mp3', 'F4': 'F4.mp3', 'F#4': 'Fs4.mp3', 'G4': 'G4.mp3',
      'G#4': 'Gs4.mp3', 'A4': 'A4.mp3', 'A#4': 'As4.mp3', 'B4': 'B4.mp3',
      'C5': 'C5.mp3'
    }
  }
}

interface JamSessionProps {
  sessionId?: string
}

export default function JamSession({ sessionId = 'default' }: JamSessionProps) {
  const { user } = useAuth()
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState(0)
  const [isMicActive, setIsMicActive] = useState(false)
  const [micVolume, setMicVolume] = useState(50)
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>('piano')
  const [isLoading, setIsLoading] = useState(true)
  const [isAudioReady, setIsAudioReady] = useState(false)
  
  // Estado MIDI
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null)
  
  // Referencias para Tone.js
  const samplerRef = useRef<Tone.Sampler | null>(null)
  const gainRef = useRef<Tone.Gain | null>(null)
  const distortionRef = useRef<Tone.Distortion | null>(null)
  
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const micGainRef = useRef<Tone.Gain | null>(null)

  // Inicializar Tone.js y cargar samples
  useEffect(() => {
    const initAudio = async () => {
      try {
        await Tone.start()
        
        const gain = new Tone.Gain(0.8).toDestination()
        gainRef.current = gain
        
        const instrument = INSTRUMENTS[selectedInstrument]
        const sampler = new Tone.Sampler({
          urls: instrument.notes,
          baseUrl: instrument.samplePath,
          onload: () => {
            console.log(`🎵 Samples de ${instrument.name} cargados`)
            setIsLoading(false)
            setIsAudioReady(true)
          },
          onerror: (error) => {
            console.error('Error cargando samples:', error)
            setIsLoading(false)
            useFallbackOscillator()
          }
        })
        
        samplerRef.current = sampler
        
        if (selectedInstrument === 'guitarra-distorsionada') {
          const distortion = new Tone.Distortion(0.8)
          distortionRef.current = distortion
          sampler.connect(distortion)
          distortion.connect(gain)
        } else {
          sampler.connect(gain)
        }
        
        await sampler.load()
        
      } catch (error) {
        console.error('Error iniciando audio:', error)
        setIsLoading(false)
        useFallbackOscillator()
      }
    }
    
    initAudio()
    
    return () => {
      samplerRef.current?.dispose()
      gainRef.current?.dispose()
      distortionRef.current?.dispose()
    }
  }, [selectedInstrument])

  // 🎹 Inicializar MIDI
  useEffect(() => {
    const initMIDI = async () => {
      try {
        await WebMidi.enable()
        setMidiEnabled(true)
        
        // Listar dispositivos MIDI disponibles
        const inputs = WebMidi.inputs
        if (inputs.length > 0) {
          setMidiDeviceName(inputs[0].name || 'Teclado MIDI')
          console.log('🎹 Dispositivos MIDI encontrados:', inputs.map(i => i.name))
          
          // Escuchar eventos MIDI del primer dispositivo
          inputs[0].addListener('noteon', (event) => {
            const note = MIDI_TO_NOTE[event.note.number]
            if (note && user) {
              const velocity = event.velocity / 127
              handleMidiNoteOn(note, velocity)
            }
          })
          
          inputs[0].addListener('noteoff', (event) => {
            const note = MIDI_TO_NOTE[event.note.number]
            if (note && user) {
              handleMidiNoteOff(note)
            }
          })
          
          // Soporte para sustain pedal (opcional)
          inputs[0].addListener('controlchange', (event) => {
            if (event.controller.number === 64) { // Sustain pedal
              // Podríamos implementar sustain aquí
              console.log('🎹 Sustain pedal:', event.value > 0 ? 'ON' : 'OFF')
            }
          })
        } else {
          console.log('🎹 No se encontraron dispositivos MIDI')
          setMidiDeviceName(null)
        }
        
      } catch (error) {
        console.error('Error inicializando MIDI:', error)
        setMidiEnabled(false)
      }
    }
    
    initMIDI()
    
    return () => {
      WebMidi.disable()
    }
  }, [user])

  // Función fallback
  const useFallbackOscillator = () => {
    console.warn('⚠️ Usando osciladores de respaldo')
    try {
      const synth = new Tone.Synth().toDestination()
      samplerRef.current = synth as any
      setIsAudioReady(true)
      setIsLoading(false)
    } catch (e) {
      console.error('Error en fallback:', e)
    }
  }

  // Conectar a Supabase Realtime
  useEffect(() => {
    const channel = supabase.channel(`jam:${sessionId}`)
    
    channel
      .on(
        'broadcast',
        { event: 'note' },
        (payload) => {
          const { note, action, userId, velocity } = payload.payload
          if (user && userId === user.id) return
          
          if (action === 'note-on') {
            playNote(note, velocity)
            setActiveNotes(prev => new Set(prev).add(note))
          } else if (action === 'note-off') {
            stopNote(note)
            setActiveNotes(prev => {
              const newSet = new Set(prev)
              newSet.delete(note)
              return newSet
            })
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          setParticipants(1)
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user, sessionId])

  // 🎹 Manejadores MIDI
  const handleMidiNoteOn = (note: string, velocity: number = 1) => {
    if (!user || !isAudioReady) return
    if (activeNotes.has(note)) return
    
    const vel = Math.round(velocity * 127)
    playNote(note, vel)
    setActiveNotes(prev => new Set(prev).add(note))
    sendNote(note, 'note-on', vel)
  }

  const handleMidiNoteOff = (note: string) => {
    if (!user) return
    if (!activeNotes.has(note)) return
    
    stopNote(note)
    setActiveNotes(prev => {
      const newSet = new Set(prev)
      newSet.delete(note)
      return newSet
    })
    sendNote(note, 'note-off')
  }

  const playNote = (note: string, velocity: number = 100) => {
    if (!samplerRef.current || !isAudioReady) return
    
    try {
      const vel = Math.min(1, velocity / 127)
      samplerRef.current.triggerAttackRelease(note, 0.5, undefined, vel)
    } catch (error) {
      console.error('Error al reproducir:', error)
    }
  }

  const stopNote = (note: string) => {
    if (!samplerRef.current || !isAudioReady) return
    
    try {
      samplerRef.current.triggerRelease(note)
    } catch (error) {
      console.error('Error al detener:', error)
    }
  }

  const sendNote = (note: string, action: 'note-on' | 'note-off', velocity: number = 100) => {
    if (!user) return
    
    const channel = supabase.channel(`jam:${sessionId}`)
    channel.send({
      type: 'broadcast',
      event: 'note',
      payload: {
        note,
        action,
        userId: user.id,
        velocity,
        instrument: selectedInstrument,
        timestamp: Date.now(),
      },
    })
  }

  const handleKeyDown = (note: string) => {
    if (!user || !isAudioReady) return
    if (activeNotes.has(note)) return
    
    playNote(note)
    setActiveNotes(prev => new Set(prev).add(note))
    sendNote(note, 'note-on')
  }

  const handleKeyUp = (note: string) => {
    if (!user) return
    if (!activeNotes.has(note)) return
    
    stopNote(note)
    setActiveNotes(prev => {
      const newSet = new Set(prev)
      newSet.delete(note)
      return newSet
    })
    sendNote(note, 'note-off')
  }

  const toggleMic = async () => {
    if (!user) {
      alert('Debes iniciar sesión para usar el micrófono')
      return
    }

    if (isMicActive) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }
      if (micGainRef.current) {
        micGainRef.current.dispose()
        micGainRef.current = null
      }
      setIsMicActive(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } 
      })
      
      mediaStreamRef.current = stream
      
      const mic = new Tone.UserMedia()
      await mic.open()
      
      const gain = new Tone.Gain(micVolume / 100)
      micGainRef.current = gain
      
      mic.connect(gain)
      gain.connect(Tone.getDestination())
      
      setIsMicActive(true)
      
    } catch (error) {
      console.error('Error al acceder al micrófono:', error)
      alert('No se pudo acceder al micrófono. Permite el acceso en tu navegador.')
    }
  }

  const updateMicVolume = (value: number) => {
    setMicVolume(value)
    if (micGainRef.current) {
      micGainRef.current.gain.value = value / 100
    }
  }

  return (
    <div style={{
      padding: 20,
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 16,
      border: '1px solid rgba(16, 185, 129, 0.1)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <h3 style={{ color: 'white', margin: 0 }}>
          🎹 Jam Session {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
        </h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 🎹 Indicador MIDI */}
          {midiEnabled && midiDeviceName && (
            <span style={{
              color: '#10b981',
              fontSize: 12,
              background: 'rgba(16, 185, 129, 0.15)',
              padding: '4px 12px',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              🎹 {midiDeviceName}
            </span>
          )}
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            👥 {participants} participantes
          </span>
          {isLoading && <span style={{ color: '#fbbf24', fontSize: 12 }}>⏳ Cargando...</span>}
          {!user && (
            <Link href="/login" style={{
              padding: '4px 12px',
              background: '#10b981',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 12,
            }}>
              Unirse
            </Link>
          )}
        </div>
      </div>

      {/* 🎸 SELECTOR DE INSTRUMENTOS */}
      {user && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
        }}>
          {(Object.keys(INSTRUMENTS) as InstrumentType[]).map((key) => {
            const inst = INSTRUMENTS[key]
            const isSelected = selectedInstrument === key
            return (
              <button
                key={key}
                onClick={() => setSelectedInstrument(key)}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  background: isSelected ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                  color: isSelected ? 'white' : '#9ca3af',
                  border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <span>{inst.icon}</span>
                {inst.name}
              </button>
            )
          })}
        </div>
      )}

      {/* 🎤 CONTROLES DEL MICRÓFONO */}
      {user && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={toggleMic}
            style={{
              padding: '8px 20px',
              background: isMicActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 'bold',
            }}
          >
            {isMicActive ? '🔴 Desactivar micrófono' : '🎤 Activar micrófono'}
          </button>
          
          {isMicActive && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>🔊</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={micVolume}
                  onChange={(e) => updateMicVolume(parseInt(e.target.value))}
                  style={{
                    width: 100,
                    accentColor: '#10b981',
                  }}
                />
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{micVolume}%</span>
              </div>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 1s infinite',
              }} />
            </>
          )}
          <span style={{ color: '#6b7280', fontSize: 12 }}>
            {isMicActive ? '🎤 Micrófono activo' : 'Micrófono desactivado'}
          </span>
        </div>
      )}

      {/* 🎹 TECLADO VIRTUAL */}
      {user ? (
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 12,
          flexWrap: 'wrap',
        }}>
          {NOTES.map((note) => {
            const isActive = activeNotes.has(note)
            const isBlack = note.includes('#')
            
            return (
              <button
                key={note}
                onMouseDown={() => handleKeyDown(note)}
                onMouseUp={() => handleKeyUp(note)}
                onMouseLeave={() => {
                  if (isActive) handleKeyUp(note)
                }}
                style={{
                  width: isBlack ? 40 : 50,
                  height: isBlack ? 120 : 160,
                  background: isActive 
                    ? '#10b981' 
                    : isBlack 
                      ? '#1a1a1a' 
                      : '#2a2a2a',
                  border: isBlack 
                    ? '1px solid #333' 
                    : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  cursor: isAudioReady ? 'pointer' : 'not-allowed',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 'bold',
                  transition: 'all 0.1s ease',
                  boxShadow: isActive ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
                  transform: isActive ? 'scale(0.95)' : 'scale(1)',
                  position: 'relative',
                  zIndex: isBlack ? 10 : 1,
                  marginLeft: isBlack ? -15 : 0,
                  marginRight: isBlack ? -15 : 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 10,
                  opacity: isAudioReady ? 1 : 0.5,
                }}
                disabled={!isAudioReady}
              >
                <span style={{ 
                  fontSize: 10, 
                  color: isBlack ? '#888' : '#666',
                  position: 'absolute',
                  bottom: 8,
                }}>
                  {note}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: 30,
          color: '#6b7280',
          border: '1px dashed rgba(16, 185, 129, 0.2)',
          borderRadius: 12,
        }}>
          <p style={{ fontSize: 18, margin: 0 }}>🎧</p>
          <p style={{ margin: '8px 0 0 0' }}>
            Estás escuchando la jam session
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            <Link href="/login" style={{ color: '#10b981' }}>
              Inicia sesión
            </Link> para tocar y usar el micrófono
          </p>
        </div>
      )}

      <div style={{
        marginTop: 16,
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
      }}>
        <p style={{ margin: 0 }}>
          {user ? (
            isLoading ? '⏳ Cargando instrumentos...' :
            `🎵 Toca las teclas con ${INSTRUMENTS[selectedInstrument].icon} ${INSTRUMENTS[selectedInstrument].name}`
          ) : '🎧 Escuchando la jam session en vivo'}
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
          {midiEnabled && midiDeviceName ? `🎹 Conectado a ${midiDeviceName}` : '🎹 Conecta un teclado MIDI para tocar'}
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
          {isConnected ? '✅ Conectado a la jam session' : '⏳ Conectando...'}
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
