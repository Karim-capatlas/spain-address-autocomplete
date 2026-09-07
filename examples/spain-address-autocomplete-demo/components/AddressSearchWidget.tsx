'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { type AddressRecord, type DireccionNormalizada } from '@/lib/data';

export function AddressSearchEs({
  endpoint = '/api/address-search',
  scopeProvincia,
  maxGroups = 8,
  groupLimit = 3,
  detectCp = true,
  debounceMs = 250,
  placeholder = 'Calle, municipio, código postal…',
  size = 'sm',
  detail = 'none',
  poweredByHref,
  poweredByLabel,
  typesenseHost,
  typesensePort = 8108,
  typesenseApiKey,
  typesenseProtocol = 'http',
  onAddressSelected,
  onAddressNormalized,
  onAddressCleared,
}: {
  endpoint?: string;
  scopeProvincia?: string;
  maxGroups?: number;
  groupLimit?: number;
  detectCp?: boolean;
  debounceMs?: number;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  detail?: 'none' | 'chip' | 'inline-card';
  poweredByHref?: string;
  poweredByLabel?: string;
  typesenseHost?: string;
  typesensePort?: number;
  typesenseApiKey?: string;
  typesenseProtocol?: 'http' | 'https';
  onAddressSelected?: (record: AddressRecord) => void;
  onAddressNormalized?: (record: DireccionNormalizada) => void;
  onAddressCleared?: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLElement>(null);
  const [darkMode, setDarkMode] = useState(false);
  const onAddressSelectedRef = useRef(onAddressSelected);
  const onAddressNormalizedRef = useRef(onAddressNormalized);
  const onAddressClearedRef = useRef(onAddressCleared);

  // Keep refs current
  useEffect(() => { onAddressSelectedRef.current = onAddressSelected; }, [onAddressSelected]);
  useEffect(() => { onAddressNormalizedRef.current = onAddressNormalized; }, [onAddressNormalized]);
  useEffect(() => { onAddressClearedRef.current = onAddressCleared; }, [onAddressCleared]);

  // Dark mode listener
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mq.matches);
    mq.addEventListener('change', (e) => setDarkMode(e.matches));
  }, []);

  // Register custom element
  useEffect(() => {
    import('@spain-address/widget/dist/components/address-search-es.js').then(({ defineCustomElement }) => {
      defineCustomElement();
    });
  }, []);

  // Create widget element ONCE on mount
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const widget = document.createElement('address-search-es');
    widget.setAttribute('endpoint', endpoint);
    widget.setAttribute('max-groups', String(maxGroups));
    widget.setAttribute('group-limit', String(groupLimit));
    widget.setAttribute('detect-cp', String(detectCp));
    widget.setAttribute('debounce-ms', String(debounceMs));
    widget.setAttribute('size', size);
    widget.setAttribute('detail', detail);
    if (poweredByHref) widget.setAttribute('powered-by-href', poweredByHref);
    if (poweredByLabel) widget.setAttribute('powered-by-label', poweredByLabel);
    if (scopeProvincia) widget.setAttribute('scope-provincia', scopeProvincia);
    if (placeholder) widget.setAttribute('placeholder', placeholder);
    if (typesenseHost) {
      widget.setAttribute('typesense-host', typesenseHost);
      widget.setAttribute('typesense-port', String(typesensePort));
      widget.setAttribute('typesense-api-key', typesenseApiKey || 'xyz');
      widget.setAttribute('typesense-protocol', typesenseProtocol);
    }
    widget.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    widget.style.width = '100%';
    widget.style.display = 'block';

    // Stable event listeners using refs
    const handleAddressSelected = (e: Event) => {
      onAddressSelectedRef.current?.((e as CustomEvent).detail as AddressRecord);
    };
    const handleAddressNormalized = (e: Event) => {
      onAddressNormalizedRef.current?.((e as CustomEvent).detail as DireccionNormalizada);
    };
    const handleAddressCleared = () => {
      onAddressClearedRef.current?.();
    };

    widget.addEventListener('addressSelected', handleAddressSelected);
    widget.addEventListener('addressNormalized', handleAddressNormalized);
    widget.addEventListener('addressCleared', handleAddressCleared);

    wrapper.appendChild(widget);
    widgetRef.current = widget;

    return () => {
      widget.removeEventListener('addressSelected', handleAddressSelected);
      widget.removeEventListener('addressNormalized', handleAddressNormalized);
      widget.removeEventListener('addressCleared', handleAddressCleared);
      widget.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update attributes when props change (no recreate)
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    widget.setAttribute('endpoint', endpoint);
    widget.setAttribute('max-groups', String(maxGroups));
    widget.setAttribute('group-limit', String(groupLimit));
    widget.setAttribute('detect-cp', String(detectCp));
    widget.setAttribute('debounce-ms', String(debounceMs));
    widget.setAttribute('size', size);
    widget.setAttribute('detail', detail);
    if (poweredByHref) widget.setAttribute('powered-by-href', poweredByHref);
    else widget.removeAttribute('powered-by-href');
    if (poweredByLabel) widget.setAttribute('powered-by-label', poweredByLabel);
    else widget.removeAttribute('powered-by-label');
    if (scopeProvincia) widget.setAttribute('scope-provincia', scopeProvincia);
    else widget.removeAttribute('scope-provincia');
    if (placeholder) widget.setAttribute('placeholder', placeholder);
    if (typesenseHost) {
      widget.setAttribute('typesense-host', typesenseHost);
      widget.setAttribute('typesense-port', String(typesensePort));
      widget.setAttribute('typesense-api-key', typesenseApiKey || 'xyz');
      widget.setAttribute('typesense-protocol', typesenseProtocol);
    }
    widget.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [endpoint, scopeProvincia, maxGroups, groupLimit, detectCp, debounceMs, placeholder, size, detail, poweredByHref, poweredByLabel, typesenseHost, typesensePort, typesenseApiKey, typesenseProtocol, darkMode]);

  return <div ref={wrapperRef} className="relative w-full" />;
}

export default AddressSearchEs;
