'use client';

import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  name: string;
  audio_url: string;
  instrument?: string;
  duration?: number;
}

interface NativeSequencerProps {
  tracks: Track[];
  selectedTracks: Set<string>;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
  loopEnabled: boolean;
  masterVolume: number;
  onMasterVolumeChange: (value: number) => void;
  trackVolumes: Record<string, number>;
  onTrackVolumeChange: (trackId: string, value: number) => void;
}

export default function NativeSequencer({
  tracks,
  selectedTracks,
  isPlaying,
  onPlay,
  onStop,
  loopEnabled,
  masterVolume,
  onMasterVolumeChange,
  trackVolumes,
  onTrackVolumeChange
}: NativeSequencerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // ✅ Calcular duración total
  useEffect(() => {
    const selected = tracks.filter(t => selectedTracks.has(t.id));
    let maxDuration = 0;
    selected.forEach(track => {
      if (track.duration && track.duration > maxDuration) {
        maxDuration = track.duration;
      }
    });
    setTotalDuration(maxDuration || 1);
  }, [tracks, selectedTracks]);

  // ✅ Generar forma de onda (sin librerías)
  useEffect(() => {
    const generateWaveform = async (track: Track) => {
      try {
        const response = await fetch(track.audio_url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Extraer datos de la forma de onda
        const channelData = audioBuffer.getChannelData(0);
        const samples = 150; // Número de puntos para la visualización
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j] || 0);
          }
          waveform.push(sum / blockSize);
        }
        
        setWaveforms(prev => ({
          ...prev,
          [track.id]: waveform
        }));
        
        // Guardar duración
        if (!track.duration) {
          await fetch(`/api/tracks/${track.id}/duration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: audioBuffer.duration })
          });
        }
      } catch (error) {
        console.error('Error generando waveform:', error);
      }
    };

    const selected = tracks.filter(t => selectedTracks.has(t.id));
    selected.forEach(track => {
      if (!waveforms[track.id]) {
        generateWaveform(track);
      }
    });
  }, [tracks, selectedTracks]);

  // ✅ Dibujar formas de onda en Canvas
  useEffect(() => {
    Object.keys(canvasRefs.current).forEach(trackId => {
      const canvas = canvasRefs.current[trackId];
      const waveform = waveforms[trackId];
      if (canvas && waveform && waveform.length > 0) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Fondo
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, 0, width, height);
        
        // Forma de onda
        const barWidth = width / waveform.length;
        const mid = height / 2;
        
        waveform.forEach((value, index) => {
          const x = index * barWidth;
          const barHeight = Math.max(1, value * height * 0.8);
          const y = mid - barHeight / 2;
          
          // Color según si está sonando
          const isTrackPlaying = isPlaying && selectedTracks.has(trackId);
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          
          if (isTrackPlaying) {
            gradient.addColorStop(0, '#10b981');
            gradient.addColorStop(1, '#059669');
          } else {
            gradient.addColorStop(0, '#6b7280');
            gradient.addColorStop(1, '#4b5563');
          }
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth - 1, barHeight);
        });
      }
    });
  }, [waveforms, isPlaying, selectedTracks]);

  // ✅ Actualizar progreso
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - currentTime * 1000;
      
      const updateProgress = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const newTime = Math.min(elapsed, totalDuration);
        setCurrentTime(newTime);
        
        // Actualizar las formas de onda
        Object.keys(canvasRefs.current).forEach(trackId => {
          const canvas = canvasRefs.current[trackId];
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const waveform = waveforms[trackId];
            if (!waveform) return;
            
            // Redibujar con la posición actual
            const width = canvas.width;
            const height = canvas.height;
            const progress = totalDuration > 0 ? newTime / totalDuration : 0;
            const progressWidth = progress * width;
            
            // Fondo (solo para limpiar)
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(0, 0, width, height);
            
            // Forma de onda
            const barWidth = width / waveform.length;
            const mid = height / 2;
            
            waveform.forEach((value, index) => {
              const x = index * barWidth;
              const barHeight = Math.max(1, value * height * 0.8);
              const y = mid - barHeight / 2;
              
              // ✅ Color según progreso
              const isTrackPlaying = isPlaying && selectedTracks.has(trackId);
              const isPlayed = x < progressWidth;
              
              if (isTrackPlaying && isPlayed) {
                ctx.fillStyle = '#10b981';
              } else if (isTrackPlaying) {
                ctx.fillStyle = '#4a5568';
              } else {
                ctx.fillStyle = '#6b7280';
              }
              
              ctx.fillRect(x, y, barWidth - 1, barHeight);
            });
          }
        });
        
        if (newTime < totalDuration) {
          animationRef.current = requestAnimationFrame(updateProgress);
        } else {
          if (loopEnabled) {
            // Loop: reiniciar
            setCurrentTime(0);
            startTimeRef.current = Date.now();
            animationRef.current = requestAnimationFrame(updateProgress);
          } else {
            onStop();
          }
        }
      };
      
      animationRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, totalDuration, loopEnabled, waveforms]);

  // ✅ Formatear tiempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ✅ Barra de progreso
  const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const visibleTracks = tracks.filter(t => selectedTracks.has(t.id));

  if (visibleTracks.length === 0) {
    return (
      <div style={{
        padding: '20px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <p>🎵 Selecciona al menos una pista para ver el secuenciador</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* Controles superiores */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '12px'
      }}>
        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#10b981' }}>
          🎛️ Secuenciador
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {visibleTracks.length} pistas · {formatTime(totalDuration)}
        </span>
        
        <div style={{ flex: 1 }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>🎚️</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            style={{ width: 100, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 35 }}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        
        <button
          onClick={onLoopToggle}
          style={{
            padding: '4px 12px',
            background: loopEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
            color: loopEnabled ? '#10b981' : '#6b7280',
            border: loopEnabled ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          {loopEnabled ? '🔁 Loop ON' : '➡️ Loop OFF'}
        </button>
        
        <button
          onClick={onStop}
          style={{
            padding: '6px 16px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold'
          }}
        >
          ⏹
        </button>
        
        <button
          onClick={onPlay}
          style={{
            padding: '6px 16px',
            background: isPlaying ? '#fbbf24' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold'
          }}
        >
          {isPlaying ? '🔊 Reproduciendo' : '▶️ Reproducir'}
        </button>
      </div>

      {/* Línea de tiempo */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#6b7280',
          marginBottom: '4px'
        }}>
          <span>⏱️ {formatTime(currentTime)}</span>
          <span>⏱️ {formatTime(totalDuration)}</span>
        </div>
        <div style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: `${progressPercentage}%`,
            height: '100%',
            background: '#10b981',
            borderRadius: 3,
            transition: 'width 0.1s linear'
          }} />
        </div>
      </div>

      {/* Lista de pistas con Canvas */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {visibleTracks.map((track) => {
          const volume = trackVolumes[track.id] || 0.8;
          const duration = track.duration || 0;

          return (
            <div key={track.id} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 16, minWidth: 30 }}>
                  🎵
                </span>
                <span style={{
                  fontSize: 13,
                  color: 'white',
                  fontWeight: 'bold',
                  minWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {track.name}
                </span>
                {track.instrument && (
                  <span style={{
                    fontSize: 11,
                    color: '#10b981',
                    background: 'rgba(16,185,129,0.1)',
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    {track.instrument}
                  </span>
                )}
                
                <div style={{ flex: 1 }} />
                
                {duration > 0 && (
                  <span style={{
                    fontSize: 11,
                    color: '#6b7280',
                    minWidth: 50
                  }}>
                    {formatTime(duration)}
                  </span>
                )}
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => onTrackVolumeChange(track.id, parseFloat(e.target.value))}
                  style={{
                    width: 60,
                    accentColor: '#10b981'
                  }}
                />
                <span style={{
                  fontSize: 11,
                  color: '#6b7280',
                  minWidth: 35
                }}>
                  {Math.round(volume * 100)}%
                </span>
              </div>
              
              {/* ✅ Canvas para forma de onda nativa */}
              <canvas
                ref={(el) => { canvasRefs.current[track.id] = el; }}
                width={800}
                height={40}
                style={{
                  width: '100%',
                  height: '40px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 4,
                  display: 'block'
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
