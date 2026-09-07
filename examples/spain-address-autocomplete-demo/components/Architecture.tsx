'use client';

import React from 'react';
import { GitFork, PiggyBank, Database, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';

export function Architecture() {
  const steps = [
    {
      step: '01',
      tag: 'INE TRAM',
      tagColor: 'text-[#bac3ff]',
      numColor: 'text-[#bac3ff]',
      title: 'Fuente de datos en bruto',
      description:
        'Dataset oficial del Callejero INE 2026 con más de 88.000 tramos, polígonos de coordenadas y códigos de clasificación viaria.',
      footer: 'Entrada: CSV/ZIP en bruto',
    },
    {
      step: '02',
      tag: 'ETL TypeScript',
      tagColor: 'text-[#c0c1ff]',
      numColor: 'text-[#c0c1ff]',
      title: 'Pipeline de deduplicación',
      description:
        'Worker de Node.js con streaming que deduplica segmentos de calle, estandariza abreviaturas y precalcula los mapas postales de tramos.',
      footer: 'Transformación: JSONL.gz',
    },
    {
      step: '03',
      tag: 'Typesense 27.1',
      tagColor: 'text-[#4ae176]',
      numColor: 'text-[#4ae176]',
      title: 'Índice en memoria',
      description:
        'Motor de búsqueda con indexación infix que aloja las colecciones callejero_es y cascade_es con tolerancia a erratas de profundidad 2.',
      footer: 'RAM: ~380 MB',
    },
    {
      step: '04',
      tag: 'Hono y MCP',
      tagColor: 'text-[#bac3ff]',
      numColor: 'text-[#bac3ff]',
      title: 'Pasarelas seguras',
      description:
        'Proxy inverso que protege las claves de la API de búsqueda + servidores MCP stdio/SSE que entregan herramientas directas a agentes LLM.',
      footer: 'Salida: JSON REST y herramientas',
    },
  ];

  return (
    <section className="w-full py-16 bg-[#070e1c] border-y border-[#19202e]" id="architecture">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-[#bac3ff] text-[11px] font-bold uppercase tracking-widest mb-1.5">
            <GitFork className="w-3.5 h-3.5 text-[#435ad2]" />
            Topografía de alto rendimiento
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#dce2f6] tracking-tight">
            Arquitectura del sistema de extremo a extremo
          </h2>
          <p className="text-sm sm:text-base text-[#c5c5d6] mt-2">
            Cómo los datos abiertos oficiales del Instituto Nacional de Estadística (INE) se convierten en autocompletado difuso en menos de 50 ms en frontends modernos y agentes generativos.
          </p>
        </div>

        {/* Pipeline Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {steps.map((item, idx) => (
            <div
              key={item.step}
              className="p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-md flex flex-col justify-between group hover:bg-[#232a39] hover:border-[#444654] transition-all relative"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-black ${item.numColor}`}>{item.step}</span>
                  <span className="px-2 py-0.5 rounded bg-[#232a39] font-mono text-[11px] text-[#8f8f9f] border border-[#444654]/50">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#dce2f6]">{item.title}</h3>
                <p className="text-xs text-[#8f8f9f] leading-relaxed">{item.description}</p>
              </div>
              <div className="mt-6 pt-3 border-t border-[#232a39] text-[10px] font-bold uppercase tracking-wider text-[#8f8f9f]">
                {item.footer}
              </div>
            </div>
          ))}
        </div>

        {/* Live Infrastructure Cost Comparison Banner */}
        <div className="mt-8 p-6 rounded-xl bg-[#19202e] border border-[#2e3544] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#007633]/30 border border-[#007633]/50 text-[#78ff96] flex items-center justify-center shrink-0 shadow-inner">
              <PiggyBank className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#dce2f6]">
                Cero dependencia de un proveedor cloud y 95% de ahorro en costes
              </h3>
              <p className="text-xs sm:text-sm text-[#8f8f9f] mt-0.5 leading-relaxed max-w-2xl">
                A diferencia de Google Places API o de los geocodificadores comerciales que cobran 5–17 $ por cada 1.000 autocompletados, spain-address-autocomplete se ejecuta sin condiciones en un VPS de 5 €/mes con consultas ilimitadas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-[#151b2a] px-4 py-2.5 rounded-lg border border-[#2e3544]">
            <span className="text-2xl lg:text-3xl font-black text-[#4ae176]">0,00 €</span>
            <span className="text-xs text-[#8f8f9f]">/ por consulta</span>
          </div>
        </div>
      </div>
    </section>
  );
}
