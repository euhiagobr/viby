
"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Image as ImageIcon, Maximize2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface OrganizerGalleryProps {
  gallery: any[];
}

export function OrganizerGallery({ gallery }: OrganizerGalleryProps) {
  const [selectedImg, setSelectedImg] = React.useState<string | null>(null);

  if (!gallery || gallery.length === 0) return null;

  return (
    <section className="space-y-8">
      <div className="flex items-center gap-3 px-2">
        <div className="p-2 bg-primary/5 rounded-lg text-primary">
          <ImageIcon className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Galeria de Experiências</h2>
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {gallery.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-[2rem] overflow-hidden bg-muted group cursor-pointer"
            onClick={() => setSelectedImg(item.url)}
          >
            <Image
              src={item.url}
              alt={item.caption || "Gallery"}
              width={400}
              height={600}
              className="w-full object-cover transition-transform duration-700 group-hover:scale-110"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="text-white w-8 h-8" />
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selectedImg} onOpenChange={() => setSelectedImg(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 overflow-hidden bg-transparent border-none">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <button 
              onClick={() => setSelectedImg(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            {selectedImg && (
              <img 
                src={selectedImg} 
                className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl" 
                alt="Fullscreen" 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
