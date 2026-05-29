"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X, Tag as TagIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventTagsProps {
  tags: string[]
  onChange?: (tags: string[]) => void
  isPublic?: boolean
  className?: string
}

export function EventTags({ tags, onChange, isPublic, className }: EventTagsProps) {
  const [input, setInput] = React.useState("")

  const handleAdd = () => {
    const t = input.trim().toLowerCase().replace(/#/g, "")
    if (t && !tags.includes(t) && onChange) {
      onChange([...tags, t])
    }
    setInput("")
  }

  if (isPublic) {
    if (!tags || tags.length === 0) return null
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {tags.map(t => (
          <Badge key={t} variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] uppercase px-3">
            #{t}
          </Badge>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        <Input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="Adicionar tag (ex: openbar)" 
          className="rounded-xl h-11"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <Button type="button" onClick={handleAdd} variant="outline" className="h-11 rounded-xl">
          <TagIcon className="w-4 h-4 mr-2" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <Badge key={t} className="bg-primary/5 text-primary border-primary/10 gap-1 px-3 py-1 uppercase text-[10px] font-black">
            #{t}
            <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => onChange?.(tags.filter(item => item !== t))} />
          </Badge>
        ))}
      </div>
    </div>
  )
}
