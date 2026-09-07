'use client';

import React, { useState } from 'react';
import { Bot, SpellCheck, Compass, Copy, Check, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { OCR_EXAMPLES } from '@/lib/data';

export function McpSection() {
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const [customOcrText, setCustomOcrText] = useState(OCR_EXAMPLES[0].raw);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);

  const mcpConfig = `{
  "mcpServers": {
    "spain-address": {
      "command": "npx",
      "args": ["-y", "@spain-address/mcp-server"],
      "env": { "TYPESENSE_HOST": "http://localhost:8108" }
    }
  }
}`;

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(mcpConfig);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleSelectPreset = (idx: number) => {
    setSelectedExampleIndex(idx);
    setCustomOcrText(OCR_EXAMPLES[idx].raw);
    setIsTransforming(true);
    setTimeout(() => setIsTransforming(false), 200);
  };

  const currentResult = OCR_EXAMPLES[selectedExampleIndex]?.parsed || OCR_EXAMPLES[0].parsed;

  return (
    <section className="w-full py-16 bg-[#0c1321]" id="mcp">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Columna izquierda: especificaciones MCP (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="inline-flex items-center gap-1.5 text-[#4ae176] text-[11px] font-bold uppercase tracking-widest">
              <Bot className="w-4 h-4 text-[#4ae176]" />
              Model Context Protocol (MCP) de Anthropic
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#dce2f6] tracking-tight leading-tight">
              Herramientas nativas para LLMs de OCR de identidad y desambiguación de direcciones
            </h2>

            <p className="text-sm sm:text-base text-[#c5c5d6] leading-relaxed">
              Dota a Claude Desktop, Cursor y procesadores documentales empresariales de herramientas en tiempo real para contrastar escaneos OCR ambiguos de DNI/NIE españoles directamente contra los datos geométricos oficiales del INE.
            </p>

            <div className="flex flex-col gap-3 mt-2">
              {/* Herramienta 1 */}
              <div className="p-4 rounded-xl bg-[#19202e] border border-[#2e3544] flex items-start gap-3.5 shadow-sm hover:border-[#435ad2] transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#435ad2] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <SpellCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#dce2f6]">normalize_address</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#232a39] font-mono text-[11px] text-[#bac3ff] border border-[#444654]/60">
                      Herramienta 1
                    </span>
                  </div>
                  <p className="text-xs text-[#8f8f9f] mt-1 leading-relaxed">
                    Parsea texto español no estructurado, corrige erratas (p. ej. &quot;clle&quot; ➔ &quot;Calle&quot;), extrae el número, piso, puerta, portal, bloque y escalera, y asigna los códigos INE verificados.
                  </p>
                </div>
              </div>

              {/* Herramienta 2 */}
              <div className="p-4 rounded-xl bg-[#19202e] border border-[#2e3544] flex items-start gap-3.5 shadow-sm hover:border-[#007633] transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#007633] text-[#78ff96] flex items-center justify-center shrink-0 shadow-sm">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#dce2f6]">search_addresses</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#232a39] font-mono text-[11px] text-[#4ae176] border border-[#444654]/60">
                      Herramienta 2
                    </span>
                  </div>
                  <p className="text-xs text-[#8f8f9f] mt-1 leading-relaxed">
                    Consulta difusa facetada sobre 749.000 nombres de calles oficiales con filtrado por provincia y tolerancia a erratas.
                  </p>
                </div>
              </div>
            </div>

            {/* Snippet de configuración stdio */}
            <div className="mt-2 p-4 rounded-xl bg-[#151b2a] border border-[#2e3544]">
              <div className="flex items-center justify-between text-xs font-mono mb-2 text-[#8f8f9f]">
                <span>claude_desktop_config.json</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#4ae176]">ejecución stdio</span>
                  <button
                    type="button"
                    onClick={handleCopyConfig}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    {copiedConfig ? (
                      <Check className="w-3.5 h-3.5 text-[#4ae176]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <pre className="font-mono text-xs text-[#dce2f6] overflow-x-auto leading-relaxed">
                <code>{mcpConfig}</code>
              </pre>
            </div>
          </div>

          {/* Columna derecha: demo interactiva del pipeline OCR (6 cols) */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-2xl flex flex-col gap-5">
              <div className="flex items-center justify-between pb-2 border-b border-[#232a39]">
                <span className="font-bold text-sm text-[#dce2f6]">
                  Zona de normalización OCR en tiempo real
                </span>
                <span className="px-2 py-0.5 rounded bg-[#232a39] text-[#bac3ff] text-[10px] font-bold uppercase tracking-wider">
                  Transformación en vivo
                </span>
              </div>

              {/* Barra de presets */}
              <div className="flex flex-wrap gap-1.5">
                {OCR_EXAMPLES.map((ex, i) => (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => handleSelectPreset(i)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      selectedExampleIndex === i
                        ? 'bg-[#435ad2] text-white shadow-sm'
                        : 'bg-[#232a39] text-[#c5c5d6] hover:bg-[#2e3544]'
                    }`}
                  >
                    {ex.title}
                  </button>
                ))}
              </div>

              {/* Antes (entrada OCR ruidosa) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#ffb4ab] flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Texto OCR de DNI (ruidoso, sin formato, con abreviaturas)
                </label>
                <div className="p-3.5 rounded-lg bg-[#2e3544] font-mono text-xs text-[#ffb4ab] border border-[#444654] shadow-inner">
                  &quot;{customOcrText}&quot;
                </div>
              </div>

              {/* Flecha de transformación */}
              <div className="flex items-center justify-center gap-3 text-[#8f8f9f] font-mono text-xs py-1">
                <span className="w-12 h-0.5 bg-[#444654]"></span>
                <span className="flex items-center gap-1 text-[#4ae176] font-semibold">
                  <RefreshCw className={`w-3.5 h-3.5 ${isTransforming ? 'animate-spin' : ''}`} />
                  Herramienta MCP normalize_address (14 ms)
                </span>
                <span className="w-12 h-0.5 bg-[#444654]"></span>
              </div>

              {/* Después (salida estructurada) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#4ae176] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Registro estructurado verificado (listo para base de datos y CRM)
                </label>
                <div className="p-4 rounded-lg bg-[#111827] border border-[#232a39] font-mono text-xs text-[#dce2f6] shadow-inner overflow-x-auto">
                  <pre className="leading-relaxed">
                    <code>
{`{
  `}<span className="text-[#f472b6]">&quot;via_nombre_completo&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.via_nombre_completo}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;numero&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.numero ?? ''}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;piso&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.piso ?? ''}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;puerta&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.puerta ?? ''}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;codigo_postal&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.codigo_postal}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;municipio&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.municipio}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;municipio_id&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.municipio_id}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;provincia&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.provincia}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;unidad_raw&quot;</span>{`: `}<span className="text-[#86efac]">&quot;{currentResult.unidad_raw}&quot;</span>{`,
  `}<span className="text-[#f472b6]">&quot;confidence&quot;</span>{`: `}<span className="text-[#fbbf24]">&quot;{currentResult.confidence}&quot;</span>{`
}`}
                    </code>
                  </pre>
                </div>
              </div>

              {/* Resumen de precisión */}
              <div className="p-3 rounded-lg bg-[#232a39] border border-[#2e3544] flex items-center justify-between text-[#c5c5d6] text-xs">
                <span>
                  Falsos positivos: <strong className="text-white">&lt; 0,02%</strong>
                </span>
                <span>•</span>
                <span>
                  Compatibilidad DNI: <strong className="text-white">3.0 y 4.0</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
