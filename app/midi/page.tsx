"use client"

import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import Link from 'next/link'
import MidiController from '../components/MidiController'

// Sintetizador simple con Web Audio API
class SimpleSynth {
  private audioContext: AudioContext | null = null
  private oscillators: Map<number, OscillatorNode> = new Map()
  private gains: Map<number, GainNode> = new Map()

  constructor() {
    this.audioContext = null
  }

  private initAudio() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
    return this.audioContext
  }

  noteOn(note: number, velocity: number = 100) {
    const ctx = this.initAudio()
    if (!ctx) return

    // Si ya existe la nota, detenerla primero
    if (this.oscillators.has(note)) {
      this.noteOff(note)
    }

    const frequency = 440 * Math.pow(2, (note - 69) / 12)
    const gain = ctx.createGain()
    gain.gain.value = (velocity / 127) * 0.5
    
    const oscillator = ctx.createOscillator()
    oscillator.type = 'sawtooth'
    oscillator.frequency.value = frequency
    
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    
    oscillator.start()
    
    this.oscillators.set(note, oscillator)
    this.gains.set(note, gain)
    
    console.log(`🎹 Nota On: ${note} (${frequency.toFixed(1)}Hz)`)
  }

  noteOff(note: number) {
    const oscillator = this.oscillators.get(note)
    const gain = this.gains.get(note)
    
    if (oscillator && gain) {
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.1)
      setTimeout(() => {
        try {
          oscillator.stop()
          oscillator.disconnect()
          gain.disconnect()
        } catch (e) {}
      }, 150)
      this.oscillators.delete(note)
      this.gains.delete(note)
      console.log(`🎹 Nota Off: ${note}`)
    }
  }

  destroy() {
    for (const [note, osc] of this.oscillators) {
      try {
        osc.stop()
        osc.disconnect()
      } catch (e) {}
    }
    this.oscillators.clear()
    this.gains.clear()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

export default function MidiPage() {
  const { user } = useAuth()
  const [isPlaying, setIsPlaying] = useState(false)
  const [lastNote, setLastNote] = useState<string>('--')
  const synthRef = useRef<SimpleSynth | null>(null)
  const notesPlaying = useRef<Set<number>>(new Set())

  const handleNoteOn = (note: number, velocity: number) => {
    if (!synthRef.current) {
      synthRef.current = new SimpleSynth()
    }
    synthRef.current.noteOn(note, velocity)
    notesPlaying.current.add(note)
    setIsPlaying(true)
    setLastNote(`Nota ${note} (${velocity}%)`)
  }

  const handleNoteOff = (note: number) => {
    if (synthRef.current) {
      synthRef.current.noteOff(note)
    }
    notesPlaying.current.delete(note)
    if (notesPlaying.current.size === 0) {
      setIsPlaying(false)
    }
  }

  const handleControlChange = (controller: number, value: number) => {
    console.log(`🎛️ Control: ${controller} → ${value}`)
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "white", textAlign: "center" }}>
        <p>🔒 Debes iniciar sesión</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "20px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: 28, margin: 0 }}>🎹 MIDI Studio</h1>
            <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>
              Conecta tu controlador MIDI y toca en vivo
            </p>
          </div>
          <Link href="/">
            <button style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              cursor: "pointer"
            }}>
              ← Volver
            </button>
          </Link>
        </div>

        {/* Estado de MIDI */}
        <div style={{ marginBottom: "16px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ padding: "8px 16px", background: isPlaying ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", borderRadius: 6, border: isPlaying ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 13, color: isPlaying ? "#10b981" : "#6b7280" }}>
              {isPlaying ? '🔴 Tocando' : '⏹️ En espera'}
            </span>
          </div>
          <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Última nota: </span>
            <span style={{ fontSize: 13, color: "#10b981" }}>{lastNote}</span>
          </div>
          <div style={{ padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Notas activas: </span>
            <span style={{ fontSize: 13, color: "#fbbf24" }}>{notesPlaying.current.size}</span>
          </div>
        </div>

        {/* Controlador MIDI */}
        <MidiController
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          onControlChange={handleControlChange}
        />

        {/* Teclado virtual de ayuda */}
        <div style={{ marginTop: "16px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 8px 0" }}>🎹 Atajos de teclado (sin MIDI)</h3>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>A</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>S</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>D</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>F</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>G</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>H</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>J</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>K</kbd>
            <kbd style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", borderRadius: 4, fontSize: 12, color: "#9ca3af" }}>L</kbd>
            <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "8px" }}>Teclas blancas (escala C)</span>
          </div>
        </div>

        {/* Cómo conectar MIDI */}
        <div style={{ marginTop: "16px", padding: "16px", background: "rgba(16,185,129,0.05)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.1)" }}>
          <h4 style={{ fontSize: 13, color: "#10b981", margin: "0 0 8px 0" }}>📱 Cómo conectar tu MIDI:</h4>
          <ul style={{ fontSize: 13, color: "#9ca3af", margin: 0, paddingLeft: "20px" }}>
            <li><strong>USB:</strong> Conecta tu teclado por USB-OTG. Android 6.0+ lo detecta automáticamente.</li>
            <li><strong>Bluetooth:</strong> Activa Bluetooth y selecciona tu dispositivo desde la lista.</li>
            <li><strong>Apps:</strong> Usa TouchOSC o MIDI Designer para convertir tu móvil en controlador.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
