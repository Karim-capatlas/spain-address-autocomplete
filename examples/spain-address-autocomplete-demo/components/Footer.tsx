'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="w-full bg-[#070e1c] text-[#8f8f9f] border-t border-[#19202e]">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#19202e]">
          {/* Col 1 & 2: Brand */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-bold text-[#dce2f6]">
                spain-address-autocomplete
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#232a39] text-[#c5c5d6] font-mono text-[11px] border border-[#444654]/40">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-[#8f8f9f] max-w-lg leading-relaxed">
              Motor de normalización de direcciones y cascade de geolocalización de alto rendimiento. Impulsado por Typesense, índices espaciales CartoDB y los registros oficiales del Callejero del INE.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151b2a] font-mono text-xs text-[#dce2f6] border border-[#2e3544]">
                <span className="w-2 h-2 rounded-full bg-[#4ae176] animate-pulse"></span>
                99,99% Todos los sistemas operativos
              </span>
            </div>
          </div>

          {/* Col 3: Documentación */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold text-[#dce2f6] uppercase tracking-wider">
              Documentación
            </span>
            <a
              href="#quickstart"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Guía de inicio rápido
            </a>
            <a
              href="#api"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              API REST y SDKs
            </a>
            <a
              href="#playground"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Zona de pruebas interactiva
            </a>
            <a
              href="#mcp"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Herramientas del servidor MCP
            </a>
          </div>

          {/* Col 4: Recursos y datos abiertos */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold text-[#dce2f6] uppercase tracking-wider">
              Recursos y datos abiertos
            </span>
            <a
              href="https://www.ine.es"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Datos oficiales del Callejero INE
            </a>
            <a
              href="https://typesense.org"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Motor Typesense
            </a>
            <a
              href="https://github.com/Karim-capatlas/spain-address-autocomplete"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Repositorio de GitHub
            </a>
            <a
              href="#license"
              className="text-xs text-[#8f8f9f] hover:text-[#dce2f6] transition-colors"
            >
              Términos de la licencia MIT
            </a>
          </div>
        </div>

        {/* Fila inferior */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#8f8f9f] text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span>Publicado bajo la licencia MIT</span>
            <span>•</span>
            <span>Atribución: Instituto Nacional de Estadística (INE)</span>
          </div>
          <div className="font-mono text-[11px] text-[#8f8f9f]">
            Diseñado para la velocidad de desarrollo y la ergonomía técnica
          </div>
        </div>
      </div>
    </footer>
  );
}
