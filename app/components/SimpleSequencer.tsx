'use client';

import { useState, useEffect, useRef } from 'react';

interface Track {
  id: string;
  name: string;
  audio_url: string;
  instrument?: string;
  duration?: number;
  volume?: number;
}

interface SimpleSequencerProps {
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

export default function SimpleSequencer({
  tracks,
  selectedTracks,
  isPlaying,
  onPlay,
  onStop,
  onLoopToggle,
  loopEnabled,
  masterVolume,
  onMasterVolumeChange,
  trackVolumes,
  onTrackVolumeChange
}: SimpleSequencerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [trackProgress, setTrackProgress] = useState<Record<string, number>>({});
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // ✅ Calcular duración total (la más larga de las seleccionadas)
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

  // ✅ Actualizar progreso
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - currentTime * 1000;
      
      const updateProgress = () => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const newTime = Math.min(elapsed, totalDuration);
        setCurrentTime(newTime);
        
        // ✅ Calcular progreso por pista (si cada pista tiene duración)
        const newProgress: Record<string, number> = {};
        tracks.forEach(track => {
          if (selectedTracks.has(track.id) && track.duration) {
            const progress = Math.min(newTime / track.duration, 1);
            newProgress[track.id] = progress;
          }
        });
        setTrackProgress(newProgress);
        
        if (newTime < totalDuration) {
          animationRef.current = requestAnimationFrame(updateProgress);
        } else {
          if (loopEnabled) {
            // ✅ Loop: reiniciar
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
  }, [isPlaying, totalDuration, loopEnabled, tracks, selectedTracks]);

  // ✅ Formatear tiempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ✅ Barra de progreso
  const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // ✅ Obtener solo pistas seleccionadas
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
          {visibleTracks.length} pistas
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

      {/* Lista de pistas */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {visibleTracks.map((track) => {
          const volume = trackVolumes[track.id] || 0.8;
          const progress = trackProgress[track.id] || 0;
          const duration = track.duration || 0;

          return (
            <div key={track.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
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
              
              {/* Barra de progreso por pista */}
              <div style={{
                flex: 1,
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden',
                minWidth: 80
              }}>
                <div style={{
                  width: `${Math.min(progress * 100, 100)}%`,
                  height: '100%',
                  background: isPlaying && progress > 0 ? '#10b981' : '#6b7280',
                  borderRadius: 2,
                  transition: 'width 0.1s linear'
                }} />
              </div>
              
              {/* Duración */}
              {duration > 0 && (
                <span style={{
                  fontSize: 11,
                  color: '#6b7280',
                  minWidth: 50
                }}>
                  {formatTime(duration * progress)} / {formatTime(duration)}
                </span>
              )}
              
              {/* Control de volumen */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onTrackVolumeChange(track.id, parseFloat(e.target.value))}
                style={{
                  width: 60,
                  accentColor: '#10b981',
                  marginLeft: 'auto'
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
          );
        })}
      </div>
    </div>
  );
}
