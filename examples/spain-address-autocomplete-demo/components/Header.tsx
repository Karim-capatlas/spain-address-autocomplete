'use client'

import React, { useState, useEffect } from 'react'
import { Search, Menu, X } from 'lucide-react'

interface HeaderProps {
  onOpenSearch: () => void
}

export function Header({ onOpenSearch }: HeaderProps) {
  const [activeSection, setActiveSection] = useState('playground')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['playground', 'api', 'mcp', 'architecture', 'quickstart']
      const scrollY = window.scrollY + 120
      for (const section of sections) {
        const el = document.getElementById(section)
        if (el) {
          const top = el.offsetTop
          const height = el.offsetHeight
          if (scrollY >= top && scrollY < top + height) {
            setActiveSection(section)
            break
          }
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0c1321]/85 backdrop-blur-xl border-b border-[#232a39]/60 shadow-[0_1px_8px_rgba(0,0,0,0.25)]">
      <div className="h-[3.25rem] max-w-[75rem] mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <a href="#" className="flex items-center gap-2 shrink-0 group">
            <div className="relative h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center bg-[#19202e] border border-[#2e3544]">
              <img
                src="https://lh3.googleusercontent.com/aida/AEtjO1XTDAb9RGlNEbHtKTZx_5ZahhY4k3rj8JIIIUp2YT2OpsImVzvTsANVD4fTS-UBYwbLna2kBupeSKQ7zs5VP3DghvyxHULFhMrBR1geQfZD-1gKYgZb50x_MYWLrqGRDl-t7cqD6c4iUoJ0tE0sA7eS2ImTDXxXaIOsX-qEo1dXkctqHVdL8_IYjAmH_HiL29MiBeH2SSbA0mIWjTmfgYBPU9mNJ71omrz7n299Zq6tQA-jx_ECBSXyRuab"
                alt="spain-address-autocomplete Logo"
                width={28}
                height={28}
                className="h-7 w-7 object-contain group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-headline-sm text-[16px] font-bold text-[#dce2f6] tracking-tight truncate hidden sm:block">
              spain-address-autocomplete
            </span>
          </a>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center gap-0.5 shrink-0 bg-[#151b2a]/60 p-1 rounded-full border border-[#232a39]">
          {[
            { id: 'playground', label: 'Zona de pruebas', href: '#playground' },
            { id: 'api', label: 'API Proxy', href: '#api' },
            { id: 'mcp', label: 'Herramientas MCP', href: '#mcp' },
            { id: 'architecture', label: 'Arquitectura', href: '#architecture' },
            { id: 'quickstart', label: 'Inicio rápido', href: '#quickstart' },
          ].map((item) => {
            const isActive = activeSection === item.id
            return (
              <a
                key={item.id}
                href={item.href}
                className={`px-3 py-1 text-[13px] font-medium transition-all rounded-full ${
                  isActive
                    ? 'text-[#00105b] font-semibold bg-[#bac3ff] shadow-sm'
                    : 'text-[#c5c5d6] hover:text-[#dce2f6] hover:bg-[#232a39]/50'
                }`}
              >
                {item.label}
              </a>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#151b2a] text-[#c5c5d6] hover:text-[#dce2f6] hover:bg-[#19202e] border border-[#2e3544]/80 transition-all text-[12px]"
            type="button"
          >
            <Search className="w-3.5 h-3.5 text-[#8f8f9f]" />
            <span>Buscar en la documentación…</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#232a39] text-[#dce2f6] font-mono text-[10px] border border-[#444654]/60">
              ⌘K
            </kbd>
          </button>

          <a
            href="#quickstart"
            className="px-2.5 py-1.5 rounded-full bg-[#bac3ff] text-[#001f8f] font-semibold text-[12px] hover:bg-[#dee0ff] transition-all transform hover:-translate-y-0.5 shadow-sm whitespace-nowrap"
          >
            Empezar
          </a>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-1.5 rounded-lg bg-[#19202e] text-[#dce2f6] hover:bg-[#232a39] border border-[#2e3544]"
            aria-label="Alternar menú móvil"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#0c1321] border-b border-[#232a39] px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenSearch()
              }}
              className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-[#151b2a] text-sm text-[#c5c5d6] border border-[#2e3544]"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#8f8f9f]" /> Buscar documentación
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#232a39] text-[10px] font-mono">⌘K</kbd>
            </button>
          </div>
          {[
            { id: 'playground', label: 'Zona de pruebas', href: '#playground' },
            { id: 'api', label: 'API Proxy', href: '#api' },
            { id: 'mcp', label: 'Herramientas MCP', href: '#mcp' },
            { id: 'architecture', label: 'Arquitectura', href: '#architecture' },
            { id: 'quickstart', label: 'Inicio rápido', href: '#quickstart' },
          ].map((item) => (
            <a
              key={item.id}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === item.id
                  ? 'bg-[#435ad2]/30 text-[#bac3ff] border border-[#435ad2]/50'
                  : 'text-[#c5c5d6] hover:bg-[#19202e] hover:text-white'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </header>
  )
}

export default Header
