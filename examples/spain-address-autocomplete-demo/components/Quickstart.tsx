'use client';

import React, { useState } from 'react';
import { Rocket, ChevronRight, Copy, Check, CheckCircle, Terminal } from 'lucide-react';
import { QUICKSTART_SCRIPTS } from '@/lib/data';

export function Quickstart() {
  const [activeStep, setActiveStep] = useState<string>('1');
  const [copied, setCopied] = useState(false);

  const steps = [
    {
      id: '1',
      title: 'Clonar e instalar',
      desc: 'Clona el monorepo y compila ESM',
    },
    {
      id: '2',
      title: 'Clúster Typesense',
      desc: 'Levanta el contenedor con Docker',
    },
    {
      id: '3',
      title: 'Importar snapshot',
      desc: 'Indexa 749K registros de calles',
    },
    {
      id: '4',
      title: 'Desplegar y exponer',
      desc: 'Lanza el proxy + Cloudflare Tunnel',
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(QUICKSTART_SCRIPTS[activeStep]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="w-full py-16 bg-[#0c1321]" id="quickstart">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-8">
          <div className="flex items-center gap-1.5 text-[#bac3ff] text-[11px] font-bold uppercase tracking-widest mb-1.5">
            <Rocket className="w-3.5 h-3.5 text-[#435ad2]" />
            Autoalojamiento en producción
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#dce2f6] tracking-tight">
            Lanza tu clúster en 4 pasos
          </h2>
          <p className="text-sm sm:text-base text-[#c5c5d6] mt-2">
            Ejecuta tu propio pipeline autónomo de resolución de direcciones españolas sobre Docker, Coolify, Railway o un VPS Ubuntu sin contenedores.
          </p>
        </div>

        {/* Quickstart Step Wizard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Step Navigation (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-2">
            {steps.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`text-left p-3.5 rounded-xl transition-all flex items-center justify-between border ${
                    isActive
                      ? 'bg-[#19202e] border-[#bac3ff]/40 shadow-lg text-[#dce2f6]'
                      : 'bg-[#151b2a] border-[#2e3544] text-[#8f8f9f] hover:bg-[#19202e] hover:text-[#dce2f6]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full font-bold flex items-center justify-center font-mono text-xs ${
                        isActive
                          ? 'bg-[#bac3ff] text-[#00105b]'
                          : 'bg-[#232a39] text-[#c5c5d6]'
                      }`}
                    >
                      {step.id}
                    </span>
                    <div>
                      <div className="text-xs font-bold">{step.title}</div>
                      <div className="text-[11px] text-[#8f8f9f]">{step.desc}</div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isActive ? 'text-[#bac3ff] translate-x-0.5' : 'text-[#444654]'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Terminal Output Viewer (8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="p-5 sm:p-6 rounded-xl bg-[#1e293b] border border-[#2e3544] shadow-2xl flex flex-col h-full">
              <div className="flex items-center justify-between pb-3 border-b border-[#2e3544]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ffb4ab]"></span>
                  <span className="w-3 h-3 rounded-full bg-[#fbbf24]"></span>
                  <span className="w-3 h-3 rounded-full bg-[#4ae176]"></span>
                  <span className="font-mono text-xs text-[#8f8f9f] ml-2 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" />
                    bash - terminal
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 font-mono text-xs text-[#c5c5d6] hover:text-white px-2.5 py-1 rounded bg-[#111827] border border-[#2e3544] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4ae176]" />
                      <span className="text-[#4ae176]">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar código</span>
                    </>
                  )}
                </button>
              </div>

              {/* Terminal Dynamic Body */}
              <pre className="font-mono text-xs text-[#dce2f6] overflow-x-auto flex-1 p-2 leading-relaxed whitespace-pre my-3">
                <code>{QUICKSTART_SCRIPTS[activeStep]}</code>
              </pre>

              {/* Deployment Tip */}
              <div className="pt-3 border-t border-[#2e3544] flex flex-wrap items-center justify-between text-xs text-[#8f8f9f] gap-2">
                <span className="flex items-center gap-1.5 text-[#4ae176]">
                  <CheckCircle className="w-4 h-4" />
                  Requisito de memoria: 1 GB de RAM mínimo
                </span>
                <span className="font-mono text-[11px]">Linux / macOS / WSL2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Environment Variables Table */}
        <div className="mt-12 p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-md">
          <div className="flex items-center justify-between pb-4 border-b border-[#232a39] mb-4">
            <h3 className="text-sm font-bold text-[#dce2f6]">
              Variables de entorno necesarias (.env)
            </h3>
            <span className="px-2 py-0.5 rounded bg-[#232a39] font-mono text-xs text-[#8f8f9f] border border-[#444654]/60">
              Puerto predeterminado 8787
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#8f8f9f] text-[10px] font-bold uppercase tracking-wider border-b border-[#232a39]">
                  <th className="pb-3">Nombre de variable</th>
                  <th className="pb-3">Descripción</th>
                  <th className="pb-3">Valor predeterminado</th>
                  <th className="pb-3">Visibilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232a39]">
                <tr className="hover:bg-[#232a39]/40 transition-colors">
                  <td className="py-3 font-mono text-[#c084fc] font-semibold">TYPESENSE_API_KEY</td>
                  <td className="py-3 text-[#c5c5d6]">Clave API maestra para la gestión del índice y las consultas</td>
                  <td className="py-3 font-mono text-[#86efac]">&quot;secret-cluster-key&quot;</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-[#93000a]/40 text-[#ffb4ab] border border-[#93000a] text-[10px] font-bold uppercase tracking-wider">
                      Privada
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-[#232a39]/40 transition-colors">
                  <td className="py-3 font-mono text-[#c084fc] font-semibold">TYPESENSE_HOST</td>
                  <td className="py-3 text-[#c5c5d6]">URL interna del motor Typesense</td>
                  <td className="py-3 font-mono text-[#86efac]">&quot;http://127.0.0.1:8108&quot;</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-[#232a39] text-[#c5c5d6] border border-[#444654] text-[10px] font-bold uppercase tracking-wider">
                      Interna
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-[#232a39]/40 transition-colors">
                  <td className="py-3 font-mono text-[#c084fc] font-semibold">PORT_PROXY</td>
                  <td className="py-3 text-[#c5c5d6]">Puerto vinculado por el BFF de búsqueda Hono</td>
                  <td className="py-3 font-mono text-[#fbbf24]">8787</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-[#007633]/30 text-[#78ff96] border border-[#007633] text-[10px] font-bold uppercase tracking-wider">
                      Pública
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-[#232a39]/40 transition-colors">
                  <td className="py-3 font-mono text-[#c084fc] font-semibold">PORT_CASCADE</td>
                  <td className="py-3 text-[#c5c5d6]">Puerto vinculado por el servicio de cascade geográfico Hono</td>
                  <td className="py-3 font-mono text-[#fbbf24]">5978</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-[#007633]/30 text-[#78ff96] border border-[#007633] text-[10px] font-bold uppercase tracking-wider">
                      Pública
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
