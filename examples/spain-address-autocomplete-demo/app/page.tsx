'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Playground } from '@/components/Playground';
import { Frameworks } from '@/components/Frameworks';
import { ApiReference } from '@/components/ApiReference';
import { McpSection } from '@/components/McpSection';
import { Architecture } from '@/components/Architecture';
import { Quickstart } from '@/components/Quickstart';
import { Footer } from '@/components/Footer';
import { CommandPalette } from '@/components/CommandPalette';

export default function Home() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global ⌘K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#0c1321] text-[#dce2f6] font-sans antialiased flex flex-col selection:bg-[#435ad2] selection:text-white">
      {/* Top Sticky Navigation Bar */}
      <Header onOpenSearch={() => setIsSearchOpen(true)} />

      {/* Main Content Sections */}
      <main className="flex-1 w-full pt-[3.25rem]">
        {/* 1. Hero Section & Metrics */}
        <Hero />

        {/* 2. Interactive Testing Sandbox & Event Inspector */}
        <Playground />

        {/* 3. Omnichannel Delivery / Embed in 2 Minutes */}
        <Frameworks />

        {/* 4. REST & Cascade Geo APIs */}
        <ApiReference />

        {/* 5. Anthropic MCP Server for LLMs & Identity OCR */}
        <McpSection />

        {/* 6. End-to-End System Architecture */}
        <Architecture />

        {/* 7. Self-Hosting in Production Quickstart */}
        <Quickstart />
      </main>

      {/* Footer */}
      <Footer />

      {/* Command Palette Modal (⌘K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
