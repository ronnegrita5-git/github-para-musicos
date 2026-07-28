'use client';

import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  name: string;
  audio_url: string;
  instrument?: string;
  duration?: number;
}

interface SimpleSequencerViewProps {
  tracks: Track[];
  selectedTracks: Set<string>;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onSeek?: (time: number) => void;
}

export default function SimpleSequencerView({
  tracks,
  selectedTracks,
  isPlaying,
  currentTime,
  totalDuration,
  onSeek
}: SimpleSequencerViewProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const visibleTracks = tracks.filter(t => selectedTracks.has(t.id));

  // Calcular el ancho proporcional de cada pista
  const getTrackWidth = (duration: number) => {
    return totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
  };

  // Manejar clic en la línea de tiempo
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !onSeek) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(x * totalDuration, totalDuration));
    onSeek(time);
  };

  // Manejar arrastre
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    if (onSeek) {
      const rect = timelineRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const time = Math.max(0, Math.min(x * totalDuration, totalDuration));
      onSeek(time);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current || !onSeek) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const time = Math.max(0, Math.min(x * totalDuration, totalDuration));
      onSeek(time);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onSeek, totalDuration]);

  if (visibleTracks.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#6b7280',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.05)'
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

      {/* Línea de tiempo con marcador */}
      <div style={{ marginBottom: '12px' }}>
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
          ref={timelineRef}
          onClick={handleTimelineClick}
          onMouseDown={handleMouseDown}
          style={{
            width: '100%',
            height: '24px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {/* Fondo de la línea de tiempo */}
          <div style={{
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.02)',
            position: 'relative'
          }}>
            {/* Marcas de tiempo */}
            {[0, 0.25, 0.5, 0.75, 1].map((pos) => (
              <div
                key={pos}
                style={{
                  position: 'absolute',
                  left: `${pos * 100}%`,
                  top: 0,
                  width: '1px',
                  height: '100%',
                  background: 'rgba(255,255,255,0.05)'
                }}
              />
            ))}
          </div>
          
          {/* Barra de progreso */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${(currentTime / totalDuration) * 100}%`,
            height: '100%',
            background: 'rgba(16,185,129,0.2)',
            borderRadius: 4,
            transition: isDragging ? 'none' : 'width 0.1s linear'
          }} />
          
          {/* Marcador de posición (playhead) */}
          <div style={{
            position: 'absolute',
            left: `${(currentTime / totalDuration) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            background: '#10b981',
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 0 10px rgba(16,185,129,0.5)',
            zIndex: 10,
            transition: isDragging ? 'none' : 'left 0.1s linear'
          }} />
        </div>
      </div>

      {/* Pistas como bloques en la línea de tiempo */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxHeight: '250px',
        overflowY: 'auto'
      }}>
        {visibleTracks.map((track) => {
          const trackDuration = track.duration || 1;
          const width = getTrackWidth(trackDuration);
          const progress = Math.min((currentTime / trackDuration) * 100, 100);
          const isFinished = progress >= 100;
          const isTrackPlaying = isPlaying && selectedTracks.has(track.id);

          return (
            <div key={track.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 0'
            }}>
              <span style={{
                fontSize: 12,
                color: 'white',
                fontWeight: isTrackPlaying ? 'bold' : 'normal',
                minWidth: 80,
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {track.name}
              </span>
              
              {track.instrument && (
                <span style={{
                  fontSize: 9,
                  color: '#10b981',
                  background: 'rgba(16,185,129,0.1)',
                  padding: '2px 6px',
                  borderRadius: 8,
                  whiteSpace: 'nowrap'
                }}>
                  {track.instrument}
                </span>
              )}
              
              {/* Bloque de la pista en la línea de tiempo */}
              <div style={{
                flex: 1,
                height: '16px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                minWidth: 60
              }}>
                {/* Fondo de la pista (su duración) */}
                <div style={{
                  width: `${width}%`,
                  height: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  borderRight: '1px solid rgba(255,255,255,0.15)'
                }} />
                
                {/* Progreso de la pista */}
                <div style={{
                  width: `${(width * progress) / 100}%`,
                  height: '100%',
                  background: isFinished ? '#10b981' : (isTrackPlaying ? '#10b981' : '#4a5568'),
                  borderRadius: 3,
                  transition: 'width 0.1s linear',
                  position: 'absolute',
                  left: 0,
                  top: 0
                }} />
                
                {/* Indicador de duración */}
                <div style={{
                  position: 'absolute',
                  right: '2px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 8,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'monospace',
                  pointerEvents: 'none'
                }}>
                  {formatTime(trackDuration)}
                </div>
              </div>
              
              {/* Estado */}
              {isTrackPlaying && (
                <span style={{ fontSize: 11, color: '#10b981', minWidth: 20 }}>🔊</span>
              )}
              {isFinished && (
                <span style={{ fontSize: 11, color: '#10b981', minWidth: 20 }}>✅</span>
              )}
              {!isTrackPlaying && !isFinished && (
                <span style={{ fontSize: 11, color: '#6b7280', minWidth: 20 }}>⏸</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
