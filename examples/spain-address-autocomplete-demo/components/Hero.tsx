'use client';

import React, { useState } from 'react';
import { PlayCircle, BookOpen, Copy, Check, Sparkles } from 'lucide-react';

export function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('pnpm add @spain-address/widget');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full overflow-hidden pt-6 pb-12">
      {/* Top Ambient Glows */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-[#435ad2]/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-20 right-10 w-96 h-96 bg-[#007633]/15 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-40 -left-20 w-80 h-80 bg-[#3131c0]/15 rounded-full blur-[100px] pointer-events-none"></div>

      <section className="relative max-w-[75rem] mx-auto px-4 sm:px-6 pt-10 pb-8">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Status Indicator Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#232a39]/90 text-[#dce2f6] shadow-sm mb-6 border border-[#444654]/40 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ae176] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ae176]"></span>
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#4ae176]">
              Motor Typesense 27.1
            </span>
            <span className="text-[#8f8f9f] font-mono text-[11px]">•</span>
            <span className="text-[12px] text-[#c5c5d6] font-medium">
              Servidor MCP y Web Component de código abierto
            </span>
          </div>

          {/* Titular */}
          <h1 className="text-3xl sm:text-5xl lg:text-[46px] font-extrabold text-[#dce2f6] tracking-tight leading-[1.15] mb-5">
            Normalización, autocompletado y{' '}
            <span className="bg-gradient-to-r from-[#bac3ff] via-[#c0c1ff] to-[#4ae176] bg-clip-text text-transparent">
              Servidor MCP
            </span>{' '}
            de direcciones en España
          </h1>

          {/* Subtítulo */}
          <p className="text-base sm:text-lg text-[#c5c5d6] max-w-2xl leading-relaxed mb-8">
            Convierte direcciones OCR desordenadas de documentos de identidad españoles (DNI, NIE, TIE) y entradas de usuario en registros geográficos estandarizados y validados. Más de 749K calles, 52 provincias y 8.106 municipios con búsqueda Typesense en menos de 50 ms.
          </p>

          {/* Botones CTA y snippet de comando */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full mb-12">
            <a
              href="#playground"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#bac3ff] text-[#001f8f] font-semibold text-sm shadow-[0_4px_20px_rgba(186,195,255,0.25)] hover:bg-[#dee0ff] transition-all transform hover:-translate-y-0.5"
            >
              <PlayCircle className="w-4 h-4" />
              Abrir la zona de pruebas
            </a>

            <a
              href="#api"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#19202e] text-[#dce2f6] font-semibold text-sm border border-[#2e3544] hover:bg-[#232a39] hover:border-[#444654] transition-all"
            >
              <BookOpen className="w-4 h-4 text-[#8f8f9f]" />
              Leer la documentación de la API
            </a>

            {/* Terminal Snippet */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#151b2a] border border-[#2e3544] shadow-inner">
              <span className="font-mono text-xs text-[#c084fc] font-bold">$</span>
              <span className="font-mono text-xs text-[#dce2f6]">
                pnpm add @spain-address/widget
              </span>
              <button
                onClick={handleCopy}
                className="p-1 rounded-full hover:bg-[#232a39] text-[#c5c5d6] hover:text-[#dce2f6] transition-colors ml-1"
                title="Copiar comando"
                type="button"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#4ae176]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#151b2a]/80 border border-[#232a39] text-center shadow-sm hover:border-[#2e3544] transition-all">
              <span className="text-2xl lg:text-3xl font-black text-[#dce2f6] tracking-tight">
                749K+
              </span>
              <span className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider mt-1">
                Calles (INE 2026)
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#151b2a]/80 border border-[#232a39] text-center shadow-sm hover:border-[#2e3544] transition-all">
              <span className="text-2xl lg:text-3xl font-black text-[#dce2f6] tracking-tight">
                52
              </span>
              <span className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider mt-1">
                Provincias cubiertas
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#151b2a]/80 border border-[#232a39] text-center shadow-sm hover:border-[#2e3544] transition-all">
              <span className="text-2xl lg:text-3xl font-black text-[#dce2f6] tracking-tight">
                8.106
              </span>
              <span className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider mt-1">
                Municipios
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-[#151b2a]/80 border border-[#232a39] text-center shadow-sm hover:border-[#2e3544] transition-all">
              <span className="text-2xl lg:text-3xl font-black text-[#4ae176] tracking-tight">
                &lt; 14ms
              </span>
              <span className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider mt-1">
                Infix Typesense
              </span>
            </div>

            <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-4 rounded-xl bg-[#151b2a]/80 border border-[#232a39] text-center shadow-sm hover:border-[#2e3544] transition-all">
              <span className="text-2xl lg:text-3xl font-black text-[#c0c1ff] tracking-tight">
                5 €/mes
              </span>
              <span className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider mt-1">
                Huella mínima en VPS
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
