'use client';

import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, Layers, FileCode2 } from 'lucide-react';

export function Frameworks() {
  const [activeTab, setActiveTab] = useState<'web' | 'react' | 'vue' | 'fetch'>('web');
  const [copied, setCopied] = useState(false);

  const snippets = {
    web: {
      file: 'index.html',
      badge: 'Cero dependencias externas',
      badgeColor: 'text-[#4ae176]',
      code: `<!-- 1. Incluir el script (CDN o bundle local) -->
<script type="module" src="https://cdn.jsdelivr.net/npm/@spain-address/widget/dist/index.js"></script>

<!-- 2. Montar el elemento personalizado con la URL del proxy -->
<address-search-es
  endpoint="https://api.tudominio.es/api/address-search"
  placeholder="Introduce calle, número y municipio..."
  scope-provincia="28"
  highlight-first="true"
  debounce-ms="150">
</address-search-es>

<!-- 3. Suscribirse al evento normalizado -->
<script>
  const searchEl = document.querySelector('address-search-es');
  searchEl.addEventListener('addressNormalized', (event) => {
    const { via_tipo, via_nombre, numero, piso, puerta, codigo_postal, municipio_id } = event.detail;
    console.log('Registro INE estandarizado:', event.detail);
  });
</script>`,
    },
    react: {
      file: 'CheckoutAddressForm.tsx',
      badge: 'Definiciones nativas TypeScript incluidas',
      badgeColor: 'text-[#bac3ff]',
      code: `import React, { useState } from 'react';
import { AddressSearchEs, type AddressRecord, type DireccionNormalizada } from '@spain-address/widget/react';

export function ShippingForm() {
  const [address, setAddress] = useState<DireccionNormalizada | null>(null);

  return (
    <div className="form-group space-y-3">
      <label className="text-sm font-medium">Dirección de facturación (España)</label>
      <AddressSearchEs
        endpoint="/api/address-search"
        placeholder="Escribe calle o código postal..."
        onAddressSelected={(e) => console.log('Calle:', e.detail)}
        onAddressNormalized={(e) => setAddress(e.detail)}
        onAddressCleared={() => setAddress(null)}
      />
      {address && (
        <div className="p-3 bg-slate-900 rounded border border-slate-700 text-sm">
          <p className="font-semibold text-emerald-400">Dirección normalizada:</p>
          <p>{address.via_nombre_completo}, {address.numero}</p>
          <p>{address.codigo_postal} {address.municipio} ({address.provincia})</p>
          <p className="text-xs text-slate-400 font-mono">INE: {address.municipio_id}</p>
        </div>
      )}
    </div>
  );
}`,
    },
    vue: {
      file: 'AddressField.vue',
      badge: 'Vue 3 Composition API',
      badgeColor: 'text-[#4ae176]',
      code: `<script setup lang="ts">
import { ref } from 'vue';
import { AddressSearchEs, type AddressRecord } from '@spain-address/widget/vue';

const selectedAddress = ref<AddressRecord | null>(null);

function handleSelect(event: CustomEvent<AddressRecord>) {
  selectedAddress.value = event.detail;
  console.log('Dirección española verificada:', event.detail);
}
</script>

<template>
  <div class="address-wrapper">
    <label class="form-label">Dirección postal</label>
    <AddressSearchEs
      endpoint="/api/address-search"
      scope-provincia="28"
      @addressSelected="handleSelect"
      @addressCleared="selectedAddress = null"
    />
  </div>
</template>`,
    },
    fetch: {
      file: 'server.ts / cURL',
      badge: 'HTTP de baja latencia con streaming',
      badgeColor: 'text-[#c0c1ff]',
      code: `// Fetch rápido sin ninguna librería de interfaz
const res = await fetch('https://api.tudominio.es/api/normalize?q=Calle+Mayor+12+4%C2%BA+B&provincia=28', {
  headers: {
    'Accept': 'application/json',
    'X-Client-App': 'checkout-service'
  }
});

const data = await res.json();
console.log(\`Dirección normalizada en \${data.took_ms}ms\`);
// data -> { via_nombre_completo, numero, piso, puerta, codigo_postal, municipio_id, ... }`,
    },
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(snippets[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="w-full py-16 bg-[#0c1321]">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-8">
          <div className="flex items-center gap-1.5 text-[#c0c1ff] text-[11px] font-bold uppercase tracking-widest mb-1.5">
            <Code2 className="w-3.5 h-3.5 text-[#c0c1ff]" />
            Distribución omnicanal
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#dce2f6] tracking-tight">
            Incrusta en cualquier sitio en menos de 2 minutos
          </h2>
          <p className="text-sm sm:text-base text-[#c5c5d6] mt-2">
            Un único elemento personalizado estándar empaquetado con envoltorios nativos de React, composables de Vue 3, directivas de Angular y primitivas ESM de fetch.
          </p>
        </div>

        {/* Framework Multi-tabs */}
        <div className="rounded-xl bg-[#19202e] border border-[#2e3544] overflow-hidden shadow-xl">
          {/* Tabs Nav */}
          <div className="flex items-center gap-1 px-4 pt-3 bg-[#151b2a] border-b border-[#2e3544] overflow-x-auto">
            {[
              { id: 'web', label: 'Web Component', icon: FileCode2 },
              { id: 'react', label: 'React (Next.js)', icon: Code2 },
              { id: 'vue', label: 'Vue 3 (Nuxt)', icon: Layers },
              { id: 'fetch', label: 'Node / Direct REST', icon: Terminal },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  type="button"
                  className={`px-4 py-2.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition-all border-t-2 ${
                    isActive
                      ? 'bg-[#1e293b] text-[#bac3ff] border-[#bac3ff]'
                      : 'text-[#8f8f9f] hover:text-[#dce2f6] border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Panel */}
          <div className="p-5 sm:p-6 bg-[#1e293b]">
            <div className="flex items-center justify-between text-xs font-mono pb-3 border-b border-[#2e3544]/80">
              <span className="text-[#8f8f9f] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
                {snippets[activeTab].file}
              </span>
              <div className="flex items-center gap-3">
                <span className={snippets[activeTab].badgeColor}>
                  {snippets[activeTab].badge}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#111827] text-[#c5c5d6] hover:text-white border border-[#2e3544] transition-colors"
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
            </div>

            <pre className="font-mono text-xs text-[#dce2f6] overflow-x-auto pt-4 leading-relaxed whitespace-pre">
              <code>{snippets[activeTab].code}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
