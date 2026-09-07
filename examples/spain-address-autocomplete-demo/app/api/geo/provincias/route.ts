import { NextRequest, NextResponse } from 'next/server';

const CASCADE_URL = process.env.CASCADE_URL || 'http://localhost:5978';

export async function GET() {
  try {
    const res = await fetch(`${CASCADE_URL}/api/geo/provincias`, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Cascade server error' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Cascade server unavailable' }, { status: 503 });
  }
}
