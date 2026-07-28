'use client';

import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  name: string;
  audio_url: string;
  instrument?: string;
  duration?: number;
}

interface VisualSequencerProps {
  tracks: Track[];
  selectedTracks: Set<string>;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onSeek?: (time: number) => void;
}

export default function VisualSequencer({
  tracks,
  selectedTracks,
  isPlaying,
  currentTime,
  totalDuration,
  onSeek
}: VisualSequencerProps) {
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ✅ Generar formas de onda
  useEffect(() => {
    const generateWaveform = async (track: Track) => {
      try {
        const response = await fetch(track.audio_url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        // ✅ Muestras fijas para todas las pistas (para mantener consistencia)
        const samples = 200;
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

  // ✅ Dibujar formas de onda - CADA PISTA ESCALA SEGÚN SU DURACIÓN
  useEffect(() => {
    Object.keys(canvasRefs.current).forEach(trackId => {
      const canvas = canvasRefs.current[trackId];
      const waveform = waveforms[trackId];
      const track = tracks.find(t => t.id === trackId);
      
      if (canvas && waveform && waveform.length > 0 && track) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // ✅ Fondo más oscuro para la zona no ocupada
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, 0, width, height);
        
        const trackDuration = track.duration || 1;
        // ✅ Progreso de esta pista específica (0 a 1)
        const trackProgress = Math.min(currentTime / trackDuration, 1);
        // ✅ Si la pista ya terminó, está completamente verde
        const isFinished = trackProgress >= 1 && trackDuration > 0;
        
        // ✅ ESCALA: ancho proporcional a la duración de la pista
        // La pista más larga ocupa el 100% del ancho
        const maxDuration = totalDuration || 1;
        const scaleFactor = Math.min(trackDuration / maxDuration, 1);
        const scaledWidth = width * scaleFactor;
        // ✅ Offset para centrar (o alinear a la izquierda)
        const offsetX = 0; // Alinear a la izquierda
        
        const barWidth = scaledWidth / waveform.length;
        const mid = height / 2;
        
        waveform.forEach((value, index) => {
          const x = offsetX + index * barWidth;
          const barHeight = Math.max(1, value * height * 0.8);
          const y = mid - barHeight / 2;
          
          // ✅ Progreso relativo a la duración de esta pista
          const isPlayed = x / scaledWidth < trackProgress;
          
          if (isFinished) {
            ctx.fillStyle = '#10b981';
          } else if (isPlayed) {
            ctx.fillStyle = '#10b981';
          } else {
            ctx.fillStyle = '#4a5568';
          }
          ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
        });
        
        // ✅ Si la pista es más corta, dibujar un área gris al final
        if (scaleFactor < 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(scaledWidth, 0, width - scaledWidth, height);
          
          // ✅ Línea vertical que indica el final de la pista
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(scaledWidth, 0);
          ctx.lineTo(scaledWidth, height);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        
        // ✅ Mostrar duración al final de la barra
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatTime(trackDuration), scaledWidth - 4, height - 2);
      }
    });
  }, [waveforms, currentTime, tracks, totalDuration]);

  // ✅ Formatear tiempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
        <p>🎵 Selecciona pistas para ver el secuenciador</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{
      padding: '12px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* Encabezado */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
        padding: '0 4px'
      }}>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: '#10b981' }}>
          🎛️ Secuenciador
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {visibleTracks.length} pistas · {formatTime(totalDuration)}
        </span>
      </div>

      {/* Línea de tiempo principal */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#6b7280',
          marginBottom: '2px'
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
        <div
          onClick={(e) => {
            if (!onSeek) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            onSeek(percentage * totalDuration);
          }}
          style={{
            width: '100%',
            height: '14px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
            cursor: onSeek ? 'pointer' : 'default'
          }}
        >
          <div style={{
            width: `${(currentTime / totalDuration) * 100}%`,
            height: '100%',
            background: 'rgba(16,185,129,0.3)',
            borderRadius: 3
          }} />
          <div style={{
            position: 'absolute',
            left: `${(currentTime / totalDuration) * 100}%`,
            top: 0,
            width: '3px',
            height: '100%',
            background: '#10b981',
            borderRadius: 2,
            transform: 'translateX(-1.5px)'
          }} />
        </div>
      </div>

      {/* Lista de pistas */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {visibleTracks.map((track) => {
          const isTrackPlaying = isPlaying && selectedTracks.has(track.id);
          const trackDuration = track.duration || 0;
          const trackProgress = trackDuration > 0 ? Math.min(currentTime / trackDuration, 1) : 0;
          const isFinished = trackProgress >= 1 && trackDuration > 0;
          
          return (
            <div key={track.id} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '6px 8px',
              background: isTrackPlaying ? 'rgba(16,185,129,0.05)' : isFinished ? 'rgba(16,185,129,0.03)' : 'rgba(255,255,255,0.02)',
              borderRadius: 4,
              border: isTrackPlaying ? '1px solid rgba(16,185,129,0.15)' : isFinished ? '1px solid rgba(16,185,129,0.1)' : '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 14 }}>🎵</span>
                <span style={{
                  fontSize: 12,
                  color: 'white',
                  fontWeight: isTrackPlaying ? 'bold' : 'normal',
                  minWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {track.name}
                </span>
                {track.instrument && (
                  <span style={{
                    fontSize: 10,
                    color: '#10b981',
                    background: 'rgba(16,185,129,0.1)',
                    padding: '2px 8px',
                    borderRadius: 10
                  }}>
                    {track.instrument}
                  </span>
                )}
                {isTrackPlaying && (
                  <span style={{ fontSize: 10, color: '#10b981', marginLeft: 'auto' }}>🔊</span>
                )}
                {isFinished && (
                  <span style={{ fontSize: 10, color: '#10b981', marginLeft: 'auto' }}>✅ Terminada</span>
                )}
                {/* ✅ Mostrar progreso de la pista */}
                {trackDuration > 0 && (
                  <span style={{
                    fontSize: 10,
                    color: isFinished ? '#10b981' : '#6b7280',
                    minWidth: 80,
                    textAlign: 'right'
                  }}>
                    {isFinished ? formatTime(trackDuration) : `${formatTime(trackDuration * trackProgress)} / ${formatTime(trackDuration)}`}
                  </span>
                )}
                {/* ✅ Barra de progreso individual */}
                {trackDuration > 0 && (
                  <div style={{
                    width: '60px',
                    height: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${trackProgress * 100}%`,
                      height: '100%',
                      background: isFinished ? '#10b981' : (isTrackPlaying ? '#10b981' : '#4a5568'),
                      borderRadius: 2,
                      transition: 'width 0.1s linear'
                    }} />
                  </div>
                )}
              </div>
              {/* ✅ Canvas con escala proporcional a la duración */}
              <div style={{ position: 'relative', width: '100%' }}>
                <canvas
                  ref={(el) => { canvasRefs.current[track.id] = el; }}
                  width={800}
                  height={30}
                  style={{
                    width: '100%',
                    height: '30px',
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 3,
                    display: 'block'
                  }}
                />
                {/* ✅ Indicador visual de duración relativa */}
                {trackDuration > 0 && (
                  <div style={{
                    position: 'absolute',
                    right: '4px',
                    bottom: '2px',
                    fontSize: 8,
                    color: 'rgba(255,255,255,0.2)',
                    pointerEvents: 'none',
                    fontFamily: 'monospace'
                  }}>
                    {formatTime(trackDuration)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
