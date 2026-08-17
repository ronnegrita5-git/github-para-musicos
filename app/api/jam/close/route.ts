import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, userId } = body;

    if (!roomId || !userId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    // Verificar que el usuario es el dueño
    const { data: session } = await supabase
      .from('jam_sessions')
      .select('owner_id')
      .eq('id', roomId)
      .single();

    if (!session || session.owner_id !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Marcar sala como inactiva
    await supabase
      .from('jam_sessions')
      .update({ is_active: false })
      .eq('id', roomId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cerrando sala:', error);
    return NextResponse.json({ error: 'Error al cerrar sala' }, { status: 500 });
  }
}
