import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { trackId: string } }
) {
  try {
    const { trackId } = params;
    const body = await request.json();
    const { duration } = body;

    if (!duration || duration === 0) {
      return NextResponse.json(
        { error: 'Duración inválida' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('tracks')
      .update({ duration })
      .eq('id', trackId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating duration:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la duración' },
      { status: 500 }
    );
  }
}
