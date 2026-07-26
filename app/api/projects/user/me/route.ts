import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Obtener el userId de los headers (lo envía el frontend)
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Buscar proyectos del usuario
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*, tracks(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user projects:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(projects || []);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al cargar tus proyectos' },
      { status: 500 }
    );
  }
}
