import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userId, name, isPublic, selectedTracks = [] } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // ✅ AHORA: Usar supabase (autenticado)
    const { data: original, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json(
        { error: 'Proyecto original no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si es público
    if (!original.is_public && original.user_id !== userId) {
      return NextResponse.json(
        { error: 'No puedes hacer fork de este proyecto' },
        { status: 403 }
      );
    }

    // Crear el fork
    const forkName = name || `${original.name} - Fork`;

    const { data: fork, error: insertError } = await supabase
      .from('projects')
      .insert({
        name: forkName,
        description: original.description,
        user_id: userId,
        is_public: isPublic !== undefined ? isPublic : true,
        license: original.license || 'All Rights Reserved',
        parent_project_id: original.id,
        fork_depth: (original.fork_depth || 0) + 1,
        bpm: original.bpm || 120,
        tags: original.tags || []
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting fork:', insertError);
      throw insertError;
    }

    // Copiar pistas seleccionadas
    const { data: tracks } = await supabase
      .from('tracks')
      .select('*')
      .eq('project_id', id);

    let tracksToCopy = tracks || [];
    if (selectedTracks.length > 0) {
      tracksToCopy = tracksToCopy.filter((t: any) => 
        selectedTracks.includes(t.id)
      );
    }

    const trackPromises = tracksToCopy.map((track: any) => {
      return supabase.from('tracks').insert({
        name: track.name,
        audio_url: track.audio_url,
        project_id: fork.id,
        user_id: userId,
        size: track.size,
        duration: track.duration,
        mime_type: track.mime_type,
        is_loop: track.is_loop || false,
        loop_repeat: track.loop_repeat || 1,
        volume: track.volume || 1,
        pan: track.pan || 0,
        original_track_id: track.id
      });
    });

    await Promise.all(trackPromises);

    // Incrementar contador de forks del original
    await supabase
      .from('projects')
      .update({ fork_count: (original.fork_count || 0) + 1 })
      .eq('id', original.id);

    return NextResponse.json(fork, { status: 201 });
  } catch (error) {
    console.error('Error creating fork:', error);
    return NextResponse.json(
      { error: 'Error al crear el fork' },
      { status: 500 }
    );
  }
}
