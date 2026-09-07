'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Sliders,
  Cpu,
  Zap,
  Accessibility,
  Copy,
  Check,
  Code2,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { AddressRecord, PROVINCES_LIST, type DireccionNormalizada } from '@/lib/data';
import { AddressSearchEs } from './AddressSearchWidget';
import { AddressCascadeEs, type AddressCascadeEsHandle, type CascadeChangedDetail } from './AddressCascadeWidget';

export function Playground() {
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [maxGroups, setMaxGroups] = useState(8);
  const [groupLimit, setGroupLimit] = useState(3);
  const [detectCp, setDetectCp] = useState(true);
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('sm');
  const [detail, setDetail] = useState<'none' | 'chip' | 'inline-card'>('inline-card');
  const [activeTab, setActiveTab] = useState<'json' | 'events' | 'cascade'>('json');
  const [copied, setCopied] = useState(false);
  const [latency, setLatency] = useState(0);
  const [lastEmittedEvent, setLastEmittedEvent] = useState('');
  const [currentRecord, setCurrentRecord] = useState<DireccionNormalizada | null>(null);

  // Estado del cascade
  const [cascadeEndpoint, setCascadeEndpoint] = useState('/api/geo');
  const [cascadeNamePrefix, setCascadeNamePrefix] = useState('');
  const [cascadeSize, setCascadeSize] = useState<'sm' | 'md' | 'lg'>('sm');
  const [cascadeState, setCascadeState] = useState<Record<string, string>>({});
  const cascadeRef = useRef<AddressCascadeEsHandle>(null);

  const [eventLogs, setEventLogs] = useState<Array<{ id: string; time: string; event: string; detail: string }>>([
    {
      id: '1',
      time: '03:10:10.120',
      event: 'componentMount',
      detail: '<address-search-es /> montado — conectado a /api/address-search',
    },
  ]);

  const [cascadeEventLogs, setCascadeEventLogs] = useState<Array<{ id: string; time: string; event: string; detail: string }>>([
    {
      id: '1',
      time: '03:10:10.120',
      event: 'componentMount',
      detail: '<address-cascade-es /> montado — conectado a /api/geo',
    },
  ]);

  const addLog = useCallback((event: string, detail: string) => {
    setLastEmittedEvent(event);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setEventLogs((prev) => [
      ...prev.slice(-19),
      { id: `${Date.now()}-${Math.random()}`, time: timeStr, event, detail },
    ]);
  }, []);

  const addCascadeLog = useCallback((event: string, detail: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    setCascadeEventLogs((prev) => [
      ...prev.slice(-19),
      { id: `${Date.now()}-${Math.random()}`, time: timeStr, event, detail },
    ]);
  }, []);

  const handleAddressSelected = (record: AddressRecord) => {
    addLog('addressSelected', `Seleccionado: ${record.label ?? record.via_nombre_completo} (${record.codigo_postal}, ${record.municipio})`);
  };

  const handleAddressNormalized = (record: DireccionNormalizada) => {
    setCurrentRecord(record);
    addLog('addressNormalized', `Normalizado: ${record.via_nombre_completo} nº ${record.numero ?? '—'} (${record.unidad_raw || 'sin unidad'})`);
  };

  const handleAddressCleared = () => {
    setCurrentRecord(null);
    addLog('addressCleared', 'El usuario ha borrado la selección');
  };

  const handleCopyJson = () => {
    if (!currentRecord) return;
    navigator.clipboard.writeText(JSON.stringify(currentRecord, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedProvince(val);
    addLog('scopeChanged', `Ámbito de provincia: ${val === 'all' ? 'Todas las provincias' : val}`);
  };

  const handleCascadeChanged = (detail: CascadeChangedDetail) => {
    addCascadeLog('cascadeChanged', `${detail.step}: ${detail.provincia ?? ''} → ${detail.municipio ?? ''} → CP ${detail.codigo_postal ?? ''}`);
    setCascadeState({
      provincia: detail.provincia ?? '',
      municipio: detail.municipio ?? '',
      codigo_postal: detail.codigo_postal ?? '',
      ccaa: detail.ccaa ?? '',
      numero: detail.numero ?? '',
      piso: detail.piso ?? '',
      puerta: detail.puerta ?? '',
      portal: detail.portal ?? '',
      bloque: detail.bloque ?? '',
      escalera: detail.escalera ?? '',
    });
  };

  const handleCascadeAddressSelected = (record: AddressRecord) => {
    addCascadeLog('addressSelected', `Seleccionado: ${record.label ?? record.via_nombre_completo} (${record.codigo_postal}, ${record.municipio})`);
  };

  const handleCascadeCleared = () => {
    addCascadeLog('addressCleared', 'Cascade borrado');
    setCascadeState({});
  };

  const handleClearCascade = async () => {
    await cascadeRef.current?.clear();
    addCascadeLog('clear()', 'clear() imperativo invocado');
    setCascadeState({});
  };

  return (
    <section className="w-full bg-[#070e1c] py-14 border-y border-[#19202e]" id="playground">
      <div className="max-w-[75rem] mx-auto px-4 sm:px-6">
        {/* Cabecera de la sección */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[#bac3ff] text-[11px] font-bold uppercase tracking-widest mb-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#435ad2]" />
              Zona de pruebas interactiva del widget React
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#dce2f6] tracking-tight">
              Widget React de autocompletado de direcciones de España
            </h2>
            <p className="text-xs sm:text-sm text-[#8f8f9f] mt-1">
              Demostración interactiva en vivo de{' '}
              <a
                href="https://github.com/Karim-capatlas/spain-address-autocomplete"
                target="_blank"
                rel="noreferrer"
                className="text-[#bac3ff] hover:underline font-mono inline-flex items-center gap-1"
              >
                Karim-capatlas/spain-address-autocomplete
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#232a39] font-mono text-xs text-[#c5c5d6] border border-[#2e3544]">
              Tasa de telemetría: <span className="text-[#4ae176] font-bold">Stream en vivo</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#435ad2] text-[#e0e2ff] text-[10px] font-bold uppercase tracking-wider">
              React 19 y Next.js
            </span>
          </div>
        </div>

        {/* Diseño dividido del playground */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Izquierda: simulador del formulario del widget (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="p-5 sm:p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-xl flex flex-col gap-5">
              {/* Cabecera dentro de la tarjeta */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#232a39]">
                <div className="flex items-center gap-2 text-[#dce2f6] font-semibold text-sm">
                  <Code2 className="w-4 h-4 text-[#bac3ff]" />
                  <span className="font-mono text-[#bac3ff]">&lt;address-search-es /&gt;</span>
                  <span>Web Component</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#8f8f9f] font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#4ae176] animate-pulse"></span>
                  <span>Motor listo / activo</span>
                </div>
              </div>

              {/* Barra de filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Ámbito de provincia */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Ámbito de provincia
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                  >
                    {PROVINCES_LIST.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Máx. grupos */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Máx. grupos
                  </label>
                  <select
                    value={maxGroups}
                    onChange={(e) => { setMaxGroups(Number(e.target.value)); addLog('filterChanged', `Máx. grupos: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                  </select>
                </div>

                {/* Límite de grupo */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Límite de grupo
                  </label>
                  <select
                    value={groupLimit}
                    onChange={(e) => { setGroupLimit(Number(e.target.value)); addLog('filterChanged', `Límite de grupo: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                  </select>
                </div>

                {/* Tamaño */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Tamaño
                  </label>
                  <select
                    value={size}
                    onChange={(e) => { setSize(e.target.value as 'sm' | 'md' | 'lg'); addLog('filterChanged', `size: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                  >
                    <option value="sm">sm (32px)</option>
                    <option value="md">md (40px)</option>
                    <option value="lg">lg (48px)</option>
                  </select>
                </div>

                {/* Detalle de selección */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Detalle de selección
                  </label>
                  <select
                    value={detail}
                    onChange={(e) => { setDetail(e.target.value as 'none' | 'chip' | 'inline-card'); addLog('filterChanged', `detail: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                  >
                    <option value="none">none (rellenar input)</option>
                    <option value="chip">chip (legado)</option>
                    <option value="inline-card">inline-card</option>
                  </select>
                </div>
              </div>

              {/* Web Component real */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[#bac3ff] uppercase tracking-wider">
                  Entrada de dirección en vivo
                </label>
                <AddressSearchEs
                  endpoint="/api/address-search"
                  scopeProvincia={selectedProvince !== 'all' ? selectedProvince : undefined}
                  maxGroups={maxGroups}
                  groupLimit={groupLimit}
                  detectCp={detectCp}
                  debounceMs={250}
                  size={size}
                  detail={detail}
                  placeholder="Calle, número, municipio, código postal…"
                  onAddressSelected={handleAddressSelected}
                  onAddressNormalized={handleAddressNormalized}
                  onAddressCleared={handleAddressCleared}
                />
              </div>

              {/* Conmutador de detección estricta de CP */}
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">Detección difusa de CP</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectCp}
                    onChange={(e) => { setDetectCp(e.target.checked); addLog('filterChanged', `detectCp: ${e.target.checked}`); }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#232a39] peer-checked:bg-[#435ad2] rounded-full transition-colors"></div>
                  <div className="absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4"></div>
                </label>
              </div>

              {/* Presets rápidos */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-[#8f8f9f]">Prueba estos presets:</span>
                {[
                  { label: 'Gran Vía Madrid', query: 'Gran Vía 12' },
                  { label: 'Paseo Castellana', query: 'Paseo de la Castellana 259 D' },
                  { label: 'Rambla Catalunya', query: 'Rambla de Catalunya 45' },
                  { label: 'CP 28013', query: '28013' },
                  { label: 'OCR: clle mayor alcala', query: 'clle mayor alcala 12 4º B' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addLog('presetLoaded', `Preset: "${preset.query}"`)}
                    className="px-2 py-0.5 rounded bg-[#232a39] text-[#bac3ff] hover:bg-[#bac3ff] hover:text-[#001f8f] font-mono text-[11px] border border-[#444654]/50 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarjeta del widget Cascade */}
            <div className="p-5 sm:p-6 rounded-xl bg-[#19202e] border border-[#2e3544] shadow-xl flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#232a39]">
                <div className="flex items-center gap-2 text-[#dce2f6] font-semibold text-sm">
                  <GitBranch className="w-4 h-4 text-[#bac3ff]" />
                  <span className="font-mono text-[#bac3ff]">&lt;address-cascade-es /&gt;</span>
                  <span>Web Component</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#8f8f9f] font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-[#4ae176] animate-pulse"></span>
                  <span>Motor listo / activo</span>
                </div>
              </div>

              {/* Filtros del cascade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Endpoint del cascade
                  </label>
                  <input
                    type="text"
                    value={cascadeEndpoint}
                    onChange={(e) => { setCascadeEndpoint(e.target.value); addCascadeLog('filterChanged', `cascadeEndpoint: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                    placeholder="/api/geo"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Prefijo de nombre
                  </label>
                  <input
                    type="text"
                    value={cascadeNamePrefix}
                    onChange={(e) => { setCascadeNamePrefix(e.target.value); addCascadeLog('filterChanged', `namePrefix: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                    placeholder="form_"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#8f8f9f] uppercase tracking-wider">
                    Tamaño
                  </label>
                  <select
                    value={cascadeSize}
                    onChange={(e) => { setCascadeSize(e.target.value as 'sm' | 'md' | 'lg'); addCascadeLog('filterChanged', `size: ${e.target.value}`); }}
                    className="w-full h-9 px-3 rounded-lg bg-[#232a39] text-[#dce2f6] text-xs border border-[#444654]/60 focus:outline-none focus:ring-2 focus:ring-[#bac3ff]"
                  >
                    <option value="sm">sm (32px)</option>
                    <option value="md">md (40px)</option>
                    <option value="lg">lg (48px)</option>
                  </select>
                </div>
              </div>

              {/* Web Component real */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#bac3ff] uppercase tracking-wider">
                    Formulario cascade en vivo — autocompletado tolerante a erratas
                  </label>
                  <button
                    type="button"
                    onClick={handleClearCascade}
                    className="px-2 py-0.5 rounded bg-[#232a39] text-[#bac3ff] hover:bg-[#bac3ff] hover:text-[#001f8f] font-mono text-[11px] border border-[#444654]/50 transition-colors"
                  >
                    Borrar (clear())
                  </button>
                </div>
                <AddressCascadeEs
                  ref={cascadeRef}
                  cascadeEndpoint={cascadeEndpoint}
                  endpoint="/api/address-search"
                  size={cascadeSize}
                  namePrefix={cascadeNamePrefix}
                  debounceMs={250}
                  placeholder="Buscar calle…"
                  detectCp={false}
                  maxGroups={8}
                  groupLimit={3}
                  onCascadeChanged={handleCascadeChanged}
                  onAddressSelected={handleCascadeAddressSelected}
                  onAddressCleared={handleCascadeCleared}
                />
              </div>

              {/* Estado del cascade */}
              {cascadeState.codigo_postal && (
                <div className="flex flex-wrap items-center gap-2 py-1 px-3 rounded-lg bg-[#232a39] border border-[#444654]/40 text-[11px] font-mono text-[#c5c5d6]">
                  <span className="text-[#8f8f9f]">Estado:</span>
                  <span className="text-[#4ae176]">{cascadeState.provincia}</span>
                  <span className="text-[#444654]">→</span>
                  <span className="text-[#4ae176]">{cascadeState.municipio}</span>
                  <span className="text-[#444654]">→</span>
                  <span className="text-[#4ae176]">CP {cascadeState.codigo_postal}</span>
                  {cascadeState.ccaa && (
                    <>
                      <span className="text-[#444654]">·</span>
                      <span className="text-[#c0c1ff]">{cascadeState.ccaa}</span>
                    </>
                  )}
                  {(cascadeState.numero || cascadeState.piso || cascadeState.puerta) && (
                    <>
                      <span className="text-[#444654]">·</span>
                      <span className="text-[#c0c1ff]">
                        nº {cascadeState.numero || '—'} {cascadeState.piso ? `${cascadeState.piso}` : ''}
                        {cascadeState.puerta ? ` ${cascadeState.puerta}` : ''}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tarjetas de características destacadas */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-[#19202e] border border-[#232a39] flex flex-col items-center">
                <Cpu className="w-4 h-4 text-[#bac3ff] mb-1" />
                <span className="text-xs font-semibold text-[#dce2f6]">Shadow DOM</span>
                <span className="font-mono text-[10px] text-[#8f8f9f]">Cero fugas de CSS</span>
              </div>
              <div className="p-3 rounded-lg bg-[#19202e] border border-[#232a39] flex flex-col items-center">
                <Zap className="w-4 h-4 text-[#4ae176] mb-1" />
                <span className="text-xs font-semibold text-[#dce2f6]">Debounce (250 ms)</span>
                <span className="font-mono text-[10px] text-[#8f8f9f]">Llamadas Typesense limitadas</span>
              </div>
              <div className="p-3 rounded-lg bg-[#19202e] border border-[#232a39] flex flex-col items-center">
                <Accessibility className="w-4 h-4 text-[#c0c1ff] mb-1" />
                <span className="text-xs font-semibold text-[#dce2f6]">Combobox WAI-ARIA</span>
                <span className="font-mono text-[10px] text-[#8f8f9f]">Navegación 100% por teclado</span>
              </div>
            </div>
          </div>

          {/* Derecha: telemetría en tiempo real e inspector JSON (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="rounded-xl bg-[#1e293b] border border-[#2e3544] shadow-2xl overflow-hidden flex flex-col h-full">
              {/* Cabecera con pestañas */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#111827] border-b border-[#2e3544]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('json')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === 'json'
                        ? 'bg-[#232a39] text-[#dce2f6] font-semibold border border-[#444654]'
                        : 'text-[#8f8f9f] hover:text-[#dce2f6]'
                    }`}
                  >
                    JSON formateado
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('events')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === 'events'
                        ? 'bg-[#232a39] text-[#dce2f6] font-semibold border border-[#444654]'
                        : 'text-[#8f8f9f] hover:text-[#dce2f6]'
                    }`}
                  >
                    Traza de eventos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cascade')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === 'cascade'
                        ? 'bg-[#232a39] text-[#dce2f6] font-semibold border border-[#444654]'
                        : 'text-[#8f8f9f] hover:text-[#dce2f6]'
                    }`}
                  >
                    Eventos cascade
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[#4ae176] font-semibold">200 OK</span>
                  <span className="font-mono text-xs text-[#8f8f9f]">{latency}ms</span>
                </div>
              </div>

              {/* Contenido del panel principal */}
              <div className="p-4 font-mono text-xs overflow-x-auto flex-1 text-[#dce2f6] bg-[#0c1321]/60">
                {activeTab === 'json' ? (
                  <pre className="leading-relaxed whitespace-pre font-mono">
                    {currentRecord ? (
                      <code>
                        {'{\n'}
                        {'  '}<span className="text-[#f472b6]">"via_tipo"</span>: <span className="text-[#86efac]">"{currentRecord.via_tipo || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"via_nombre"</span>: <span className="text-[#86efac]">"{currentRecord.via_nombre || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"via_nombre_completo"</span>: <span className="text-[#86efac]">"{currentRecord.via_nombre_completo || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"numero"</span>: <span className="text-[#86efac]">"{currentRecord.numero ?? ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"piso"</span>: <span className="text-[#86efac]">"{currentRecord.piso ?? ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"puerta"</span>: <span className="text-[#86efac]">"{currentRecord.puerta ?? ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"portal"</span>: <span className="text-[#86efac]">"{currentRecord.portal ?? ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"bloque"</span>: <span className="text-[#86efac]">"{currentRecord.bloque ?? ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"escalera"</span>: <span className="text-[#86efac]">"{currentRecord.escalera ?? ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"municipio"</span>: <span className="text-[#86efac]">"{currentRecord.municipio || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"municipio_id"</span>: <span className="text-[#86efac]">"{currentRecord.municipio_id || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"provincia"</span>: <span className="text-[#86efac]">"{currentRecord.provincia || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"provincia_id"</span>: <span className="text-[#86efac]">"{currentRecord.provincia_id || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"comunidad_autonoma"</span>: <span className="text-[#86efac]">"{currentRecord.comunidad_autonoma || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"codigo_postal"</span>: <span className="text-[#86efac]">"{currentRecord.codigo_postal || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"unidad_raw"</span>: <span className="text-[#86efac]">"{currentRecord.unidad_raw || ''}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"confidence"</span>: <span className="text-[#fbbf24]">"{currentRecord.confidence}"</span>,{'\n'}
                        {'  '}<span className="text-[#f472b6]">"label"</span>: <span className="text-[#86efac]">"{currentRecord.label || ''}"</span>{'\n'}
                        {'}'}
                      </code>
                    ) : (
                      <span className="text-[#8f8f9f]">// Selecciona una dirección para ver la salida estructurada</span>
                    )}
                  </pre>
                ) : activeTab === 'events' ? (
                  <div className="flex flex-col gap-2 font-mono text-xs">
                    {eventLogs.map((log) => (
                      <div key={log.id} className="p-2 rounded bg-[#111827] border border-[#232a39] flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#8f8f9f]">{log.time}</span>
                          <span className="text-[#38bdf8] font-bold uppercase">{log.event}</span>
                        </div>
                        <div className="text-[#c5c5d6] text-xs">{log.detail}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 font-mono text-xs">
                    {cascadeEventLogs.map((log) => (
                      <div key={log.id} className="p-2 rounded bg-[#111827] border border-[#232a39] flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-[#8f8f9f]">{log.time}</span>
                          <span className="text-[#a78bfa] font-bold uppercase">{log.event}</span>
                        </div>
                        <div className="text-[#c5c5d6] text-xs">{log.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pie del inspector */}
              <div className="p-3 bg-[#111827] border-t border-[#2e3544] flex items-center justify-between text-[#8f8f9f] font-mono text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ae176]"></span>
                  Evento emitido:{' '}
                  <span className={`font-semibold ${activeTab === 'cascade' ? 'text-[#a78bfa]' : 'text-[#38bdf8]'}`}>
                    {activeTab === 'cascade' ? (cascadeEventLogs.length ? cascadeEventLogs[cascadeEventLogs.length - 1].event : 'ninguno') : (lastEmittedEvent || 'ninguno')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  disabled={!currentRecord}
                  className="flex items-center gap-1 hover:text-[#dce2f6] text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4ae176]" />
                      <span className="text-[#4ae176]">¡Copiado!</span>
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
          </div>
        </div>
      </div>
    </section>
  );
}

export default Playground;
