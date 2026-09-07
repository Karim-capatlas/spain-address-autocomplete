'use client';

import React, { useState } from 'react';
import { Network, Play, Copy, Check, Server, Database, Globe } from 'lucide-react';

export function ApiReference() {
  const [activeEndpoint, setActiveEndpoint] = useState<string>('/api/address-search?q=gran%20via');
  const [copied, setCopied] = useState(false);

  const handleSimulate = (endpoint: string) => {
    setActiveEndpoint(endpoint);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify({
      status: 'success',
      search_time_ms: 12,
      total: 131,
      groups: [{
        municipio_id: '28079',
        municipio: 'Madrid',
        provincia: 'Madrid',
        provincia_id: '28',
        codigo_postal: '28013',
        found: 42,
        items: [{
          id: 'a3f1b2c4d5e6f7a8',
          via_tipo: 'Calle',
          via_nombre: 'Gran Vía',
          via_nombre_completo: 'Calle Gran Vía',
          municipio: 'Madrid',
          codigo_postal: '28013',
          label: 'Calle Gran Vía, Madrid (28013)',
        }],
      }],
    }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="w-full py-16 bg-[#070e1c] border-y border-[#19202e]" id="api">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6">
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[#bac3ff] text-[11px] font-bold uppercase tracking-widest mb-1.5">
              <Network className="w-3.5 h-3.5 text-[#435ad2]" />
              Arquitectura del backend
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#dce2f6] tracking-tight">
              APIs REST y cascade geográfico
            </h2>
            <p className="text-sm text-[#c5c5d6] mt-2 max-w-xl">
              Dos microservicios diferenciados escritos en TypeScript de alto rendimiento sobre el runtime Hono. Protegidos contra la filtración de claves mediante escudos de proxy internos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full bg-[#19202e] border border-[#2e3544] font-mono text-xs text-[#dce2f6] flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#4ae176]" />
              Endpoint base: <code className="text-[#86efac]">https://calle.alami.es</code>
            </span>
          </div>
        </div>

        {/* Two Core Services Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Module A: Proxy Search API */}
          <div className="flex flex-col p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-[#232a39]">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-[#435ad2] text-[#e0e2ff] text-[10px] font-bold uppercase">
                  Módulo A
                </span>
                <h3 className="text-base font-bold text-[#dce2f6]">
                  @spain-address/proxy (BFF)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#232a39] font-mono text-xs text-[#4ae176]">
                12 ms promedio
              </span>
            </div>
            <p className="text-xs text-[#8f8f9f] my-4">
              Intermediario de consultas difusas de calles con agrupación por municipio, inferencia de código postal y ofuscación de seguridad de Typesense.
            </p>

            {/* Endpoints List */}
            <div className="flex flex-col gap-3 flex-1">
              {/* Item 1 */}
              <div
                className={`p-3.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                  activeEndpoint.startsWith('/api/address-search?q=')
                    ? 'bg-[#232a39] border-[#bac3ff]/40 shadow-inner'
                    : 'bg-[#151b2a] border-[#2e3544] hover:border-[#444654]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold text-[10px]">
                      GET
                    </span>
                    <span className="text-[#dce2f6] font-semibold">/api/address-search</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulate('/api/address-search?q=gran%20via')}
                    className="px-2.5 py-1 rounded bg-[#435ad2] text-white hover:bg-[#bac3ff] hover:text-[#001f8f] font-mono text-xs transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Simular
                  </button>
                </div>
                <span className="text-xs text-[#c5c5d6]">
                  Búsqueda difusa de calles con autocompletado de prefijos y agregación por municipio.
                </span>
                <div className="text-[#8f8f9f] font-mono text-[11px] mt-0.5">
                  Parámetros: <code className="text-[#38bdf8]">q=gran%20via</code> • <code className="text-[#38bdf8]">provincia=28</code> • <code className="text-[#38bdf8]">limit=5</code>
                </div>
              </div>

              {/* Item 2 */}
              <div
                className={`p-3.5 rounded-lg border transition-all flex flex-col gap-1.5 ${
                  activeEndpoint.includes('cp=28013')
                    ? 'bg-[#232a39] border-[#bac3ff]/40 shadow-inner'
                    : 'bg-[#151b2a] border-[#2e3544] hover:border-[#444654]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold text-[10px]">
                      GET
                    </span>
                    <span className="text-[#dce2f6] font-semibold">/api/address-search?cp=28013</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulate('/api/address-search?cp=28013')}
                    className="px-2.5 py-1 rounded bg-[#435ad2] text-white hover:bg-[#bac3ff] hover:text-[#001f8f] font-mono text-xs transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Simular
                  </button>
                </div>
                <span className="text-xs text-[#c5c5d6]">
                  Resolución directa por código postal. Devuelve los límites postales del tramo, el nombre del distrito y el ID INE primario del municipio.
                </span>
              </div>
            </div>
          </div>

          {/* Module B: Cascade Geo API */}
          <div className="flex flex-col p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-[#232a39]">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-[#3131c0] text-[#b0b2ff] text-[10px] font-bold uppercase">
                  Módulo B
                </span>
                <h3 className="text-base font-bold text-[#dce2f6]">
                  @spain-address/cascade
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#232a39] font-mono text-xs text-[#4ae176]">
                6 ms en memoria
              </span>
            </div>
            <p className="text-xs text-[#8f8f9f] my-4">
              Motor de selector cascade jerárquico: Comunidades Autónomas ➔ Provincias ➔ Municipios ➔ Códigos postales validados.
            </p>

            {/* Endpoints List */}
            <div className="flex flex-col gap-3 flex-1">
              {/* Item 1 */}
              <div
                className={`p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                  activeEndpoint === '/api/geo/provincias'
                    ? 'bg-[#232a39] border-[#c0c1ff]/40 shadow-inner'
                    : 'bg-[#151b2a] border-[#2e3544] hover:border-[#444654]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold text-[10px]">
                      GET
                    </span>
                    <span className="text-[#dce2f6] font-semibold">/api/geo/provincias</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulate('/api/geo/provincias')}
                    className="px-2.5 py-1 rounded bg-[#3131c0] text-white hover:bg-[#c0c1ff] hover:text-[#1000a9] font-mono text-xs transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Simular
                  </button>
                </div>
                <span className="text-xs text-[#c5c5d6]">
                  Las 52 provincias oficiales del INE con códigos ISO 3166-2, nombres oficiales y claves de Comunidad Autónoma.
                </span>
              </div>

              {/* Item 2 */}
              <div
                className={`p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                  activeEndpoint === '/api/geo/municipios'
                    ? 'bg-[#232a39] border-[#c0c1ff]/40 shadow-inner'
                    : 'bg-[#151b2a] border-[#2e3544] hover:border-[#444654]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold text-[10px]">
                      GET
                    </span>
                    <span className="text-[#dce2f6] font-semibold">/api/geo/municipios</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulate('/api/geo/municipios')}
                    className="px-2.5 py-1 rounded bg-[#3131c0] text-white hover:bg-[#c0c1ff] hover:text-[#1000a9] font-mono text-xs transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Simular
                  </button>
                </div>
                <span className="text-xs text-[#c5c5d6]">
                  Lista de municipios filtrada. Ejemplo: devuelve los 179 ayuntamientos oficiales de la Comunidad de Madrid.
                </span>
              </div>

              {/* Item 3 */}
              <div
                className={`p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                  activeEndpoint === '/api/geo/cps'
                    ? 'bg-[#232a39] border-[#c0c1ff]/40 shadow-inner'
                    : 'bg-[#151b2a] border-[#2e3544] hover:border-[#444654]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold text-[10px]">
                      GET
                    </span>
                    <span className="text-[#dce2f6] font-semibold">/api/geo/cps</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulate('/api/geo/cps')}
                    className="px-2.5 py-1 rounded bg-[#3131c0] text-white hover:bg-[#c0c1ff] hover:text-[#1000a9] font-mono text-xs transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Simular
                  </button>
                </div>
                <span className="text-xs text-[#c5c5d6]">
                  Códigos postales de un municipio (ID INE de 5 dígitos), que alimentan el combobox de CP del cascade.
                </span>
              </div>

              {/* Item 4 */}
              <div
                className={`p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                  activeEndpoint === '/api/geo/validate-cp'
                    ? 'bg-[#232a39] border-[#c0c1ff]/40 shadow-inner'
                    : 'bg-[#151b2a] border-[#2e3544] hover:border-[#444654]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e] font-bold text-[10px]">
                      GET
                    </span>
                    <span className="text-[#dce2f6] font-semibold">/api/geo/validate-cp</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSimulate('/api/geo/validate-cp')}
                    className="px-2.5 py-1 rounded bg-[#3131c0] text-white hover:bg-[#c0c1ff] hover:text-[#1000a9] font-mono text-xs transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Simular
                  </button>
                </div>
                <span className="text-xs text-[#c5c5d6]">
                  Verificador estricto de integridad del código postal frente a los registros territoriales oficiales del INE.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Mock Response Console */}
        <div className="mt-8 p-4 sm:p-5 rounded-xl bg-[#19202e] border border-[#2e3544] flex flex-col gap-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#8f8f9f]">
              Respuesta simulada de la API (
              <span className="text-[#86efac] font-semibold">GET {activeEndpoint}</span>)
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-[#4ae176] font-semibold">Estado: 200 OK</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#111827] text-[#c5c5d6] hover:text-white border border-[#2e3544] text-xs font-mono transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#4ae176]" />
                    <span className="text-[#4ae176]">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar JSON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="font-mono text-xs text-[#dce2f6] p-4 rounded-lg bg-[#111827] border border-[#232a39] overflow-x-auto leading-relaxed max-h-80">
    <code>{JSON.stringify({
      status: 'success',
      search_time_ms: 12,
      total: 131,
      groups: [{
        municipio_id: '28079',
        municipio: 'Madrid',
        provincia: 'Madrid',
        provincia_id: '28',
        codigo_postal: '28013',
        found: 42,
        items: [{
          id: 'a3f1b2c4d5e6f7a8',
          via_tipo: 'Calle',
          via_nombre: 'Gran Vía',
          via_nombre_completo: 'Calle Gran Vía',
          municipio: 'Madrid',
          codigo_postal: '28013',
          label: 'Calle Gran Vía, Madrid (28013)',
        }],
      }],
    }, null, 2)}</code>
  </pre>
        </div>
      </div>
    </section>
  );
}
