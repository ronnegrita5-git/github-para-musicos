import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Tu código aquí
    return NextResponse.json({ message: 'OK' })
  } catch (error) {
    return NextResponse.json({ error: 'Error al descargar' }, { status: 500 })
  }
}
