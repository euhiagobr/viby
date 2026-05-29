"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Upload, ImageIcon, Camera } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface EventHeaderProps {
  title: string
  onTitleChange?: (val: string) => void
  image?: string
  onImageUpload?: (file: File) => void
  uploadProgress?: number | null
  isPublic?: boolean
}

export function EventHeader({ title, onTitleChange, image, onImageUpload, uploadProgress, isPublic }: EventHeaderProps) {
  if (isPublic) return null;

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-none shadow-sm rounded-[2rem]">
        <CardContent className="p-6">
          <div 
            className="relative aspect-video rounded-[1.5rem] bg-muted overflow-hidden cursor-pointer group" 
            onClick={() => !isPublic && document.getElementById('event-header-up')?.click()}
          >
            {image ? (
              <img src={image} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="Preview" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20">
                <Upload className="w-10 h-10 mb-2" />
                <p className="text-[10px] font-black uppercase">Carregar Foto de Capa</p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="text-white w-8 h-8" />
            </div>
            <input id="event-header-up" type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && onImageUpload?.(e.target.files[0])} />
          </div>
          {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-4" />}
        </CardContent>
      </Card>

      <div className="space-y-2 px-1">
        <Label className="text-[10px] font-black uppercase opacity-60">Título do Evento</Label>
        <Input 
          value={title} 
          onChange={e => onTitleChange?.(e.target.value)} 
          required 
          className="rounded-xl h-14 text-xl font-black italic uppercase tracking-tighter border-dashed border-secondary/30"
          placeholder="Dê um nome impactante..."
        />
      </div>
    </div>
  )
}
