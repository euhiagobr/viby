"use client"

import * as React from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = React.useState(25 * 60)
  const [isActive, setIsActive] = React.useState(false)
  const totalTime = 25 * 60

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setIsActive(false)
      if (interval) clearInterval(interval)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, timeLeft])

  const toggleTimer = () => setIsActive(!isActive)
  const resetTimer = () => {
    setIsActive(false)
    setTimeLeft(totalTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = ((totalTime - timeLeft) / totalTime) * 100
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-card rounded-xl border border-border shadow-sm">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Timer Pomodoro</h3>
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-muted/30"
          />
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: offset }}
            className="text-secondary transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold font-mono tracking-tighter">
            {formatTime(timeLeft)}
          </span>
          <span className="text-xs text-muted-foreground uppercase font-semibold">
            {isActive ? "Foco" : "Pausado"}
          </span>
        </div>
      </div>
      <div className="flex gap-4 mt-6">
        <Button size="icon" variant="outline" onClick={resetTimer} className="rounded-full">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button size="lg" onClick={toggleTimer} className="rounded-full w-32 bg-primary">
          {isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {isActive ? "Pausar" : "Iniciar"}
        </Button>
      </div>
    </div>
  )
}
