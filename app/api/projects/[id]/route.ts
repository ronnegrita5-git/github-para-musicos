import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // ✅ Usar supabase autenticado
    const { data: project, error } = await supabase
      .from('projects')
      .select('*, tracks(*)')
      .eq('id', id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Proyecto no encontrado' },
      { status: 404 }
    );
  }
}
