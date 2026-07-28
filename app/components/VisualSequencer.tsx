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
    <div style={{
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

      {/* Línea de tiempo principal (basada en la pista más larga) */}
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

      {/* ✅ Lista de pistas con DURACIÓN VISUAL */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {visibleTracks.map((track) => {
          const trackDuration = track.duration || 1;
          // ✅ Progreso de esta pista (0 a 1, se queda en 1 cuando termina)
          const trackProgress = Math.min(currentTime / trackDuration, 1);
          const isFinished = trackProgress >= 1;
          const isTrackPlaying = isPlaying && selectedTracks.has(track.id);
          // ✅ Porcentaje visual de la pista respecto al total
          const widthPercentage = (trackDuration / totalDuration) * 100;
          
          return (
            <div key={track.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              background: isTrackPlaying ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
              borderRadius: 4,
              border: isTrackPlaying ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.05)'
            }}>
              <span style={{ fontSize: 14, minWidth: 24 }}>🎵</span>
              
              <span style={{
                fontSize: 12,
                color: 'white',
                fontWeight: isTrackPlaying ? 'bold' : 'normal',
                minWidth: 80,
                maxWidth: 120,
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
                  borderRadius: 10,
                  whiteSpace: 'nowrap'
                }}>
                  {track.instrument}
                </span>
              )}
              
              {/* ✅ Barra de progreso con DURACIÓN VISUAL */}
              <div style={{
                flex: 1,
                height: '20px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                minWidth: 100
              }}>
                {/* ✅ Fondo que representa la duración total de la pista */}
                <div style={{
                  width: `${widthPercentage}%`,
                  height: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  borderRight: '1px solid rgba(255,255,255,0.2)',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }} />
                
                {/* ✅ Progreso de reproducción de esta pista */}
                <div style={{
                  width: `${trackProgress * widthPercentage}%`,
                  height: '100%',
                  background: isFinished ? '#10b981' : (isTrackPlaying ? '#10b981' : '#4a5568'),
                  borderRadius: 3,
                  transition: 'width 0.1s linear',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }} />
                
                {/* ✅ Marcador de posición actual */}
                {isTrackPlaying && trackProgress < 1 && (
                  <div style={{
                    position: 'absolute',
                    left: `${trackProgress * widthPercentage}%`,
                    top: 0,
                    width: '2px',
                    height: '100%',
                    background: 'white',
                    borderRadius: 1,
                    transform: 'translateX(-1px)'
                  }} />
                )}
                
                {/* ✅ Texto con duración dentro de la barra */}
                <div style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'monospace',
                  pointerEvents: 'none'
                }}>
                  {formatTime(trackDuration)}
                </div>
                
                {/* ✅ Texto con progreso dentro de la barra */}
                {trackProgress > 0.1 && (
                  <div style={{
                    position: 'absolute',
                    left: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: 'monospace',
                    pointerEvents: 'none'
                  }}>
                    {formatTime(trackDuration * trackProgress)}
                  </div>
                )}
              </div>
              
              {/* ✅ Indicadores de estado */}
              {isTrackPlaying && (
                <span style={{ fontSize: 10, color: '#10b981', minWidth: 16 }}>🔊</span>
              )}
              {isFinished && (
                <span style={{ fontSize: 10, color: '#10b981', minWidth: 16 }}>✅</span>
              )}
              {!isTrackPlaying && !isFinished && (
                <span style={{ fontSize: 10, color: '#6b7280', minWidth: 16 }}>⏸</span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* ✅ Leyenda */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginTop: '8px',
        padding: '4px 8px',
        fontSize: 10,
        color: '#6b7280',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        <span>⬜ Fondo = duración de la pista</span>
        <span>🟩 Verde = progreso reproducido</span>
        <span>⬛ Borde = fin de la pista</span>
      </div>
    </div>
  );
}
