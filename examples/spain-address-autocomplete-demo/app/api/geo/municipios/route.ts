import { NextRequest, NextResponse } from 'next/server';

const CASCADE_URL = process.env.CASCADE_URL || 'http://localhost:5978';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provincia = searchParams.get('provincia');

  if (!provincia) {
    return NextResponse.json({ error: 'Provincia code required' }, { status: 400 });
  }

  try {
    const url = `${CASCADE_URL}/api/geo/municipios?provincia=${provincia}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Cascade server error' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Cascade server unavailable' }, { status: 503 });
  }
}
