'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ArrowRight, Play, BookOpen, Bot, Terminal, Code2, Layers } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Sección' | 'API' | 'Herramienta MCP' | 'Framework' | 'CLI';
  description: string;
  href?: string;
  icon: any;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: 'playground',
    title: 'Zona de pruebas interactiva',
    category: 'Sección',
    description: 'Prueba el autocompletado de direcciones con telemetría JSON en vivo',
    href: '#playground',
    icon: Play,
  },
  {
    id: 'api',
    title: 'APIs REST y cascade geográfico',
    category: 'API',
    description: 'Endpoints de búsqueda proxy y cascadas geográficas jerárquicas',
    href: '#api',
    icon: BookOpen,
  },
  {
    id: 'mcp-norm',
    title: 'normalize_address (MCP)',
    category: 'Herramienta MCP',
    description: 'Transforma escaneos OCR ruidosos de DNI/NIE en registros INE estructurados',
    href: '#mcp',
    icon: Bot,
  },
  {
    id: 'mcp-search',
    title: 'search_addresses (MCP)',
    category: 'Herramienta MCP',
    description: 'Consulta difusa facetada sobre 749.000 calles oficiales',
    href: '#mcp',
    icon: Bot,
  },
  {
    id: 'framework-react',
    title: 'Integración React y Next.js',
    category: 'Framework',
    description: 'Componente React nativo con definiciones TypeScript',
    href: '#playground',
    icon: Code2,
  },
  {
    id: 'framework-web',
    title: 'Web Component <address-search-es>',
    category: 'Framework',
    description: 'Elemento personalizado Shadow DOM sin dependencias',
    href: '#playground',
    icon: Layers,
  },
  {
    id: 'quickstart',
    title: 'Autoalojamiento y despliegue con Docker',
    category: 'CLI',
    description: 'Lanza tu clúster Typesense en 4 pasos',
    href: '#quickstart',
    icon: Terminal,
  },
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setSearch('');
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filtered = COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          const target = filtered[selectedIndex].href;
          if (target) {
            window.location.hash = target;
          }
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl bg-[#19202e] border border-[#2e3544] rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#232a39] bg-[#151b2a]">
          <Search className="w-5 h-5 text-[#8f8f9f] mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar documentación, endpoints, herramientas MCP…"
            className="w-full bg-transparent text-[#dce2f6] placeholder:text-[#8f8f9f] text-sm focus:outline-none"
          />
          <button
            onClick={handleClose}
            className="p-1 rounded text-[#8f8f9f] hover:text-[#dce2f6] hover:bg-[#232a39] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[#8f8f9f] text-xs">
              No se encontraron resultados para &quot;{search}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => onClose()}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-[#435ad2] text-white'
                      : 'hover:bg-[#232a39] text-[#c5c5d6]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#151b2a] text-[#bac3ff]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate text-[#dce2f6] group-hover:text-white">
                          {item.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-[#232a39] text-[#8f8f9f]'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-white/80' : 'text-[#8f8f9f]'
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 ml-2 ${
                      isSelected ? 'text-white' : 'text-[#444654]'
                    }`}
                  />
                </a>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[#111827] border-t border-[#232a39] flex items-center justify-between text-[11px] text-[#8f8f9f] font-mono">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[#232a39] text-[#dce2f6] border border-[#444654]">
                ↑
              </kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-[#232a39] text-[#dce2f6] border border-[#444654]">
                ↓
              </kbd>{' '}
              Navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#232a39] text-[#dce2f6] border border-[#444654]">
                ↵
              </kbd>{' '}
              Seleccionar
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#232a39] text-[#dce2f6] border border-[#444654]">
              ESC
            </kbd>{' '}
            Cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
