import { NextRequest, NextResponse } from 'next/server';
import { searchAddresses, createSearchClient } from '@spain-address/core';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const cp = searchParams.get('cp') || '';
  const provincia = searchParams.get('provincia') || undefined;
  const municipio = searchParams.get('municipio') || undefined;
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '10', 10), 25);
  const groupLimit = Math.min(parseInt(searchParams.get('group_limit') || '3', 10), 10);

  if (!q && !cp) {
    return NextResponse.json({ error: 'Missing q or cp parameter' }, { status: 400 });
  }

  try {
    const deps = createSearchClient();

    // `cp` is the explicit filter param (the widget's controller always sends it
    // for CP lookups, and the cascade sends it as a background filter alongside
    // the street `q`). Fall back to treating a bare 5-digit `q` as a CP lookup.
    const isBareCp = !cp && /^\d{5}$/.test(q);
    const filterByCP = /^\d{5}$/.test(cp) ? cp : isBareCp ? q : undefined;
    const query = isBareCp ? '' : q;

    const result = await searchAddresses(
      {
        query,
        perPage,
        groupLimit,
        filterByCP,
        filterByProvincia: provincia,
        filterByMunicipio: municipio,
        highlight: true,
      },
      deps
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
