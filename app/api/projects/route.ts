import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🔍 API /api/projects: Buscando proyectos públicos...');
    
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*, tracks(*)')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error en supabase:', error);
      return NextResponse.json(
        { error: error.message, details: 'Error al cargar proyectos' },
        { status: 500 }
      );
    }

    console.log(`✅ ${projects?.length || 0} proyectos encontrados`);
    return NextResponse.json(projects || []);
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
