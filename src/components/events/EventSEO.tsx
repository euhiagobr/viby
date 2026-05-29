"use client"

import * as React from "react"
import { Metadata } from "next"

interface EventSEOProps {
  event: any
  username: string
}

/**
 * Componente funcional para manipulação de metadados SEO.
 * Nota: No Next.js 15, os metadados reais são definidos no page.tsx (server), 
 * este componente fornece o JSON-LD para o cliente.
 */
export function EventSEO({ event, username }: EventSEOProps) {
  if (!event) return null

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.title,
    "description": event.description || event.shortDescription,
    "startDate": event.date?.toDate ? event.date.toDate().toISOString() : event.date,
    "endDate": event.endDate?.toDate ? event.endDate.toDate().toISOString() : event.endDate,
    "image": [event.image],
    "location": {
      "@type": "Place",
      "name": event.address?.neighborhood || event.location,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": `${event.address?.street}, ${event.address?.number}`,
        "addressLocality": event.address?.city,
        "addressRegion": event.address?.state,
        "postalCode": event.address?.cep,
        "addressCountry": "BR"
      }
    },
    "organizer": {
      "@type": "Organization",
      "name": event.organizer?.name,
      "url": `https://viby.club/${username}`
    }
  }

  return (
    <script 
      type="application/ld+json" 
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} 
    />
  )
}
