import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spain Address Autocomplete | Servidor MCP y Web Component con Typesense',
  description:
    'Normalización de direcciones españolas, autocompletado y servidor MCP. Convierte direcciones OCR desordenadas de documentos de identidad españoles en registros geográficos INE estandarizados y validados.',
  openGraph: {
    title: 'Spain Address Autocomplete | Servidor MCP y Web Component con Typesense',
    description:
      'Normalización de direcciones españolas, autocompletado y servidor MCP. Más de 749K calles, 52 provincias y 8.106 municipios.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spain Address Autocomplete',
    description:
      'Normalización de direcciones españolas, autocompletado y servidor MCP impulsado por Typesense.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
