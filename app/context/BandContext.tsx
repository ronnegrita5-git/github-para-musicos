"use client"

import { createContext, useContext, useState, useEffect } from "react"

type BandType = 'pop-rock' | 'viento' | 'cuerda'

interface BandContextType {
  bandType: BandType
  setBandType: (type: BandType) => void
  instruments: string[]
  getInstrumentIcon: (instrument: string) => string
}

const BandContext = createContext<BandContextType>({} as BandContextType)

// ----- LISTA DEFINITIVA DE INSTRUMENTOS -----
const INSTRUMENTS: Record<BandType, string[]> = {
  'pop-rock': [
    'Guitarra eléctrica',
    'Bajo eléctrico',
    'Batería',
    'Voz principal',
    'Coros',
    'Teclado',
    'Sintetizador',
    'Trompeta',
    'Saxofón',
    'Trombón',
    'Clarinete',
    'Armónica',
    'Percusión'
  ],
  'viento': [
    'Flauta travesera',
    'Oboe',
    'Clarinete',
    'Saxofón',
    'Trompeta',
    'Trombón',
    'Tuba',
    'Corneta',
    'Fagot',
    'Percusión',
    'Piano'
  ],
  'cuerda': [
    'Violín',
    'Viola',
    'Violonchelo',
    'Contrabajo',
    'Arpa',
    'Guitarra clásica',
    'Laúd',
    'Mandolina',
    'Piano'
  ]
}

// ----- ICONOS PARA CADA INSTRUMENTO (SIN DUPLICADOS) -----
const INSTRUMENT_ICONS: Record<string, string> = {
  // Pop-Rock
  'Guitarra eléctrica': '🎸',
  'Bajo eléctrico': '🎸',
  'Batería': '🥁',
  'Voz principal': '🎤',
  'Coros': '🎤',
  'Teclado': '🎹',
  'Sintetizador': '🎹',
  'Trompeta': '🎺',
  'Saxofón': '🎷',
  'Trombón': '🎺',
  'Clarinete': '🎵',
  'Armónica': '🪗',
  'Percusión': '🥁',
  // Viento
  'Flauta travesera': '🎵',
  'Oboe': '🎵',
  'Tuba': '🎺',
  'Corneta': '🎺',
  'Fagot': '🎵',
  // Cuerda
  'Violín': '🎻',
  'Viola': '🎻',
  'Violonchelo': '🎻',
  'Contrabajo': '🎻',
  'Arpa': '🎵',
  'Guitarra clásica': '🎸',
  'Laúd': '🎵',
  'Mandolina': '🎵',
  // 👈 SOLO UN 'Piano' (eliminado el duplicado)
  'Piano': '🎹'
}

export function BandProvider({ children }: { children: React.ReactNode }) {
  const [bandType, setBandType] = useState<BandType>('pop-rock')

  // Cargar preferencia guardada
  useEffect(() => {
    const saved = localStorage.getItem('bandType') as BandType
    if (saved && ['pop-rock', 'viento', 'cuerda'].includes(saved)) {
      setBandType(saved)
    }
  }, [])

  // Guardar preferencia
  const handleSetBandType = (type: BandType) => {
    setBandType(type)
    localStorage.setItem('bandType', type)
  }

  const getInstrumentIcon = (instrument: string) => {
    return INSTRUMENT_ICONS[instrument] || '🎵'
  }

  return (
    <BandContext.Provider value={{
      bandType,
      setBandType: handleSetBandType,
      instruments: INSTRUMENTS[bandType] || INSTRUMENTS['pop-rock'],
      getInstrumentIcon,
    }}>
      {children}
    </BandContext.Provider>
  )
}

export function useBand() {
  return useContext(BandContext)
}
