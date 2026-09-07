import { NextRequest, NextResponse } from 'next/server';

const CASCADE_URL = process.env.CASCADE_URL || 'http://localhost:5978';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const municipio = searchParams.get('municipio');
  const cp = searchParams.get('cp');

  if (!municipio || !cp) {
    return NextResponse.json({ error: 'Municipio and CP required' }, { status: 400 });
  }

  try {
    const url = `${CASCADE_URL}/api/geo/validate-cp?municipio=${municipio}&cp=${cp}`;
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
