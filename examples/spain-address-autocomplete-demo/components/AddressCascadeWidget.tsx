'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { type AddressRecord } from '@/lib/data';

export interface CascadeStep { step: 'provincia' | 'municipio' | 'cp' | 'street' }
export interface CascadeState {
  provincia_id: string;
  provincia: string;
  municipio_id: string;
  municipio: string;
  codigo_postal: string;
  ccaa: string;
  numero: string;
  piso: string;
  puerta: string;
  portal: string;
  bloque: string;
  escalera: string;
}
export interface CascadeChangedDetail extends CascadeState { step: 'provincia' | 'municipio' | 'cp' | 'street' }

/** Imperative handle exposed by the wrapper (mirrors the element's @Method surface). */
export interface AddressCascadeEsHandle {
  clear: () => Promise<void>;
  getState: () => Promise<(CascadeState & { street: AddressRecord | null }) | undefined>;
  setSelection: (record: AddressRecord | null) => Promise<void>;
}

interface AddressCascadeEsProps {
  cascadeEndpoint?: string;
  endpoint?: string;
  size?: 'sm' | 'md' | 'lg';
  namePrefix?: string;
  poweredByHref?: string;
  poweredByLabel?: string;
  debounceMs?: number;
  placeholder?: string;
  detectCp?: boolean;
  maxGroups?: number;
  groupLimit?: number;
  typesenseHost?: string;
  typesensePort?: number;
  typesenseApiKey?: string;
  typesenseProtocol?: 'http' | 'https';
  onCascadeChanged?: (detail: CascadeChangedDetail) => void;
  onAddressSelected?: (record: AddressRecord) => void;
  onAddressCleared?: () => void;
  onError?: (message: string, code?: number) => void;
}

export const AddressCascadeEs = forwardRef<AddressCascadeEsHandle, AddressCascadeEsProps>(
  function AddressCascadeEs(
    {
      cascadeEndpoint = '',
      endpoint = '',
      size = 'sm',
      namePrefix = '',
      poweredByHref,
      poweredByLabel,
      debounceMs = 250,
      placeholder = 'Escribe una calle…',
      detectCp = false,
      maxGroups = 8,
      groupLimit = 3,
      typesenseHost,
      typesensePort = 8108,
      typesenseApiKey,
      typesenseProtocol = 'http',
      onCascadeChanged,
      onAddressSelected,
      onAddressCleared,
      onError,
    },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<HTMLElement>(null);
    const [darkMode, setDarkMode] = useState(false);
    const onCascadeChangedRef = useRef(onCascadeChanged);
    const onAddressSelectedRef = useRef(onAddressSelected);
    const onAddressClearedRef = useRef(onAddressCleared);
    const onErrorRef = useRef(onError);

    // Keep refs current
    useEffect(() => { onCascadeChangedRef.current = onCascadeChanged; }, [onCascadeChanged]);
    useEffect(() => { onAddressSelectedRef.current = onAddressSelected; }, [onAddressSelected]);
    useEffect(() => { onAddressClearedRef.current = onAddressCleared; }, [onAddressCleared]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    // Dark mode listener
    useEffect(() => {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkMode(mq.matches);
      mq.addEventListener('change', (e) => setDarkMode(e.matches));
    }, []);

    // Register custom element
    useEffect(() => {
      import('@spain-address/widget/dist/components/address-cascade-es.js').then(({ defineCustomElement }) => {
        defineCustomElement();
      });
    }, []);

    // Expose the imperative @Method API (clear / getState / setSelection).
    useImperativeHandle(ref, () => ({
      clear: async () => {
        await (widgetRef.current as unknown as { clear?: () => Promise<void> })?.clear?.();
      },
      getState: async () => {
        const el = widgetRef.current as unknown as {
          getState?: () => Promise<CascadeState & { street: AddressRecord | null }>;
        } | null;
        return el?.getState ? await el.getState() : undefined;
      },
      setSelection: async (record: AddressRecord | null) => {
        await (widgetRef.current as unknown as {
          setSelection?: (r: AddressRecord | null) => Promise<void>;
        })?.setSelection?.(record);
      },
    }), []);

    // Create widget element ONCE on mount
    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const widget = document.createElement('address-cascade-es');
      widget.setAttribute('cascade-endpoint', cascadeEndpoint);
      widget.setAttribute('size', size);
      if (endpoint) widget.setAttribute('endpoint', endpoint);
      if (namePrefix) widget.setAttribute('name-prefix', namePrefix);
      widget.setAttribute('debounce-ms', String(debounceMs));
      widget.setAttribute('placeholder', placeholder);
      widget.setAttribute('detect-cp', String(detectCp));
      widget.setAttribute('max-groups', String(maxGroups));
      widget.setAttribute('group-limit', String(groupLimit));
      if (poweredByHref) widget.setAttribute('powered-by-href', poweredByHref);
      if (poweredByLabel) widget.setAttribute('powered-by-label', poweredByLabel);
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
      const handleCascadeChanged = (e: Event) => {
        onCascadeChangedRef.current?.((e as CustomEvent<CascadeChangedDetail>).detail);
      };
      const handleAddressSelected = (e: Event) => {
        onAddressSelectedRef.current?.((e as CustomEvent).detail as AddressRecord);
      };
      const handleAddressCleared = () => {
        onAddressClearedRef.current?.();
      };
      const handleError = (e: Event) => {
        const d = (e as CustomEvent).detail as { message: string; code?: number };
        onErrorRef.current?.(d.message, d.code);
      };

      widget.addEventListener('cascadeChanged', handleCascadeChanged);
      widget.addEventListener('addressSelected', handleAddressSelected);
      widget.addEventListener('addressCleared', handleAddressCleared);
      widget.addEventListener('error', handleError);

      wrapper.appendChild(widget);
      widgetRef.current = widget;

      return () => {
        widget.removeEventListener('cascadeChanged', handleCascadeChanged);
        widget.removeEventListener('addressSelected', handleAddressSelected);
        widget.removeEventListener('addressCleared', handleAddressCleared);
        widget.removeEventListener('error', handleError);
        widget.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update attributes when props change (no recreate)
    useEffect(() => {
      const widget = widgetRef.current;
      if (!widget) return;

      widget.setAttribute('cascade-endpoint', cascadeEndpoint);
      widget.setAttribute('size', size);
      if (endpoint) widget.setAttribute('endpoint', endpoint);
      else widget.removeAttribute('endpoint');
      if (namePrefix) widget.setAttribute('name-prefix', namePrefix);
      else widget.removeAttribute('name-prefix');
      widget.setAttribute('debounce-ms', String(debounceMs));
      widget.setAttribute('placeholder', placeholder);
      widget.setAttribute('detect-cp', String(detectCp));
      widget.setAttribute('max-groups', String(maxGroups));
      widget.setAttribute('group-limit', String(groupLimit));
      if (poweredByHref) widget.setAttribute('powered-by-href', poweredByHref);
      else widget.removeAttribute('powered-by-href');
      if (poweredByLabel) widget.setAttribute('powered-by-label', poweredByLabel);
      else widget.removeAttribute('powered-by-label');
      if (typesenseHost) {
        widget.setAttribute('typesense-host', typesenseHost);
        widget.setAttribute('typesense-port', String(typesensePort));
        widget.setAttribute('typesense-api-key', typesenseApiKey || 'xyz');
        widget.setAttribute('typesense-protocol', typesenseProtocol);
      }
      widget.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    }, [cascadeEndpoint, endpoint, size, namePrefix, debounceMs, placeholder, detectCp, maxGroups, groupLimit, poweredByHref, poweredByLabel, typesenseHost, typesensePort, typesenseApiKey, typesenseProtocol, darkMode]);

    return <div ref={wrapperRef} className="relative w-full" />;
  },
);

export default AddressCascadeEs;
