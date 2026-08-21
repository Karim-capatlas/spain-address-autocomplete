// React wrapper placeholder - will be implemented in Phase 3
// Types will be imported from @spain-address/core once built

export interface AddressRecord {
  id: string
  via_nombre: string
  via_tipo: string
  via_nombre_completo: string
  municipio: string
  municipio_id: string
  provincia: string
  provincia_id: string
  comunidad_autonoma: string
  comunidad_autonoma_id: string
  codigo_postal: string
  label: string
  lat?: number
  lon?: number
}

export interface AddressSearchProps {
  typesenseHost: string
  typesenseApiKey: string
  typesensePort?: number
  placeholder?: string
  perPage?: number
  filterProvincia?: string
  onSelect: (address: AddressRecord) => void
  onClear?: () => void
  className?: string
  inputClassName?: string
  dropdownClassName?: string
}

export function AddressSearch(_props: AddressSearchProps) {
  throw new Error('Not yet implemented')
}
