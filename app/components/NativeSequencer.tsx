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
  onLoopToggle,
  loopEnabled,
  masterVolume,
  onMasterVolumeChange,
  trackVolumes,
  onTrackVolumeChange
}: NativeSequencerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [isDragging, setIsDragging] = useState(false);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const sourceNodesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const masterGainRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const startTimeRef = useRef(0);

  // ✅ Inicializar AudioContext
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

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

  // ✅ Generar forma de onda
  useEffect(() => {
    const generateWaveform = async (track: Track) => {
      try {
        const response = await fetch(track.audio_url);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = initAudioContext();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        audioBuffersRef.current[track.id] = audioBuffer;
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = 150;
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

  // ✅ Reproducir desde una posición
  const playFromPosition = (position: number) => {
    // Detener todo
    stopPlayback();
    
    // Establecer nueva posición
    const newTime = Math.max(0, Math.min(position, totalDuration));
    setCurrentTime(newTime);
    
    // Iniciar reproducción
    setTimeout(() => {
      startPlayback(newTime);
    }, 50);
  };

  // ✅ Iniciar reproducción real
  const startPlayback = (startTime: number = 0) => {
    const ctx = initAudioContext();
    
    if (!masterGainRef.current) {
      masterGainRef.current = ctx.createGain();
      masterGainRef.current.gain.value = masterVolume;
      masterGainRef.current.connect(ctx.destination);
    }

    stopPlayback();

    const selected = tracks.filter(t => selectedTracks.has(t.id));
    if (selected.length === 0) return;

    // Calcular duración máxima
    let maxDuration = 0;
    selected.forEach(track => {
      const buffer = audioBuffersRef.current[track.id];
      if (buffer && buffer.duration > maxDuration) {
        maxDuration = buffer.duration;
      }
    });

    selected.forEach(track => {
      const buffer = audioBuffersRef.current[track.id];
      if (!buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loopEnabled;
      
      const gainNode = ctx.createGain();
      const volume = trackVolumes[track.id] || 0.8;
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(masterGainRef.current!);
      
      sourceNodesRef.current[track.id] = source;
      gainNodesRef.current[track.id] = gainNode;
      
      const offset = Math.min(startTime, buffer.duration - 0.1);
      source.start(0, offset);
    });

    isPlayingRef.current = true;
    onPlay();
    startTimeRef.current = ctx.currentTime - startTime;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const updateProgress = () => {
      if (!isPlayingRef.current) return;
      
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === 'running') {
        const elapsed = ctx.currentTime - startTimeRef.current;
        const newTime = Math.min(elapsed, totalDuration);
        setCurrentTime(newTime);
        
        if (newTime < totalDuration) {
          animationRef.current = requestAnimationFrame(updateProgress);
        } else if (loopEnabled) {
          startTimeRef.current = ctx.currentTime;
          animationRef.current = requestAnimationFrame(updateProgress);
        } else {
          stopPlayback();
        }
      } else {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationRef.current = requestAnimationFrame(updateProgress);
  };

  // ✅ Detener reproducción
  const stopPlayback = () => {
    Object.values(sourceNodesRef.current).forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourceNodesRef.current = {};
    gainNodesRef.current = {};
    isPlayingRef.current = false;
    onStop();
  };

  // ✅ Buscar posición
  const seekTo = (position: number) => {
    const newTime = Math.max(0, Math.min(position, totalDuration));
    setCurrentTime(newTime);
    
    if (isPlayingRef.current) {
      playFromPosition(newTime);
    }
  };

  // ✅ Dibujar formas de onda
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
        
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, 0, width, height);
        
        const barWidth = width / waveform.length;
        const mid = height / 2;
        const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
        
        waveform.forEach((value, index) => {
          const x = index * barWidth;
          const barHeight = Math.max(1, value * height * 0.8);
          const y = mid - barHeight / 2;
          
          const isPlayed = x / width < progress;
          
          if (isPlayed) {
            ctx.fillStyle = '#10b981';
          } else {
            ctx.fillStyle = '#4a5568';
          }
          
          ctx.fillRect(x, y, barWidth - 1, barHeight);
        });
      }
    });
  }, [waveforms, currentTime, totalDuration]);

  // ✅ Manejar timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * totalDuration;
    
    seekTo(newTime);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleTimelineMouseMove = (e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * totalDuration;
    
    setCurrentTime(newTime);
  };

  const handleTimelineMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (isPlayingRef.current) {
        playFromPosition(currentTime);
      }
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleTimelineMouseMove);
      document.addEventListener('mouseup', handleTimelineMouseUp);
    } else {
      document.removeEventListener('mousemove', handleTimelineMouseMove);
      document.removeEventListener('mouseup', handleTimelineMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleTimelineMouseMove);
      document.removeEventListener('mouseup', handleTimelineMouseUp);
    };
  }, [isDragging]);

  // ✅ Formatear tiempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onMasterVolumeChange(val);
              if (masterGainRef.current) {
                masterGainRef.current.gain.value = val;
              }
            }}
            style={{ width: 100, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 12, color: '#6b7280', minWidth: 35 }}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        
        <button
          onClick={() => {
            onLoopToggle();
            Object.values(sourceNodesRef.current).forEach(source => {
              try { source.loop = !loopEnabled; } catch (e) {}
            });
          }}
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
          onClick={() => {
            stopPlayback();
            setCurrentTime(0);
          }}
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
          onClick={() => {
            if (isPlayingRef.current) {
              stopPlayback();
            } else {
              startPlayback(currentTime);
            }
          }}
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
          {isPlaying ? '⏸ Pausa' : '▶️ Reproducir'}
        </button>
      </div>

      {/* Controles de navegación */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => seekTo(0)}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13
          }}
          title="Ir al inicio"
        >
          ⏮️
        </button>
        <button
          onClick={() => {
            const newTime = Math.max(0, currentTime - 5);
            seekTo(newTime);
          }}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13
          }}
          title="Retroceder 5 segundos"
        >
          ⏪
        </button>
        <button
          onClick={() => {
            const newTime = Math.min(totalDuration, currentTime + 5);
            seekTo(newTime);
          }}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13
          }}
          title="Adelantar 5 segundos"
        >
          ⏩
        </button>
        <button
          onClick={() => seekTo(totalDuration)}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13
          }}
          title="Ir al final"
        >
          ⏭️
        </button>
      </div>

      {/* Línea de tiempo interactiva */}
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
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          onMouseDown={handleTimelineMouseDown}
          style={{
            width: '100%',
            height: '20px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: `${progressPercentage}%`,
            height: '100%',
            background: 'rgba(16,185,129,0.3)',
            borderRadius: 4,
            transition: isDragging ? 'none' : 'width 0.1s linear'
          }} />
          
          <div style={{
            position: 'absolute',
            left: `${progressPercentage}%`,
            top: 0,
            width: '4px',
            height: '100%',
            background: '#10b981',
            borderRadius: 2,
            transform: 'translateX(-2px)',
            transition: isDragging ? 'none' : 'left 0.1s linear'
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
                
                {track.duration && (
                  <span style={{
                    fontSize: 11,
                    color: '#6b7280',
                    minWidth: 50
                  }}>
                    {formatTime(track.duration)}
                  </span>
                )}
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onTrackVolumeChange(track.id, val);
                    if (gainNodesRef.current[track.id]) {
                      gainNodesRef.current[track.id].gain.value = val;
                    }
                  }}
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
