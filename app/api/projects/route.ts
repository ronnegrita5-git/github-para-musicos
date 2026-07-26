import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: projects, error } = await supabasePublic
      .from('projects')
      .select('*, tracks(*)')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(projects || []);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Error al cargar proyectos' },
      { status: 500 }
    );
  }
}
