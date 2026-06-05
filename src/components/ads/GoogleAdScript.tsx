"use client"

import * as React from "react"

/**
 * Componente que atua como marcador para o script global injetado no layout.
 * O script real foi movido para o src/app/layout.tsx em uma tag <script> pura
 * para evitar o erro "AdSense head tag doesn't support data-nscript attribute".
 */
export function GoogleAdScript() {
  return null;
}