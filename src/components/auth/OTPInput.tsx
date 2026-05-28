
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface OTPInputProps {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}

export function OTPInput({ value, onChange, disabled }: OTPInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase()
    if (val.length > 1) return

    const newValue = value.split("")
    newValue[index] = val
    const joined = newValue.join("")
    onChange(joined)

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="flex justify-between gap-2 max-w-sm mx-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={cn(
            "w-12 h-14 text-center text-2xl font-black rounded-xl border-2 border-dashed border-secondary/30 bg-white focus:border-secondary focus:ring-0 focus:outline-none transition-all uppercase italic",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  )
}
