"use client"

import React from "react"

interface ProgressPrideBackgroundProps {
  children: React.ReactNode
}

/**
 * @fileOverview Componente de fundo animado com as cores da Progress Pride Flag.
 * Utiliza gradiente fluido e animação de fluxo.
 */
export default function ProgressPrideBackground({ children }: ProgressPrideBackgroundProps) {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      
      {/* PROGRESS PRIDE BACKGROUND */}
      <div className="absolute inset-0 -z-10">
        <div className="w-full h-full progress-pride-bg" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10">
        {children}
      </div>

      <style jsx>{`
        .progress-pride-bg {
          background: linear-gradient(
            90deg,
            #000000,
            #8b4513,
            #e40303,
            #ff8c00,
            #ffed00,
            #008026,
            #24408e,
            #732982,
            #00a3e0,
            #ffafc8,
            #ffffff
          );
          background-size: 300% 300%;
          animation: prideFlow 12s ease infinite;
          filter: saturate(1.2) brightness(0.9);
        }

        @keyframes prideFlow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  )
}
