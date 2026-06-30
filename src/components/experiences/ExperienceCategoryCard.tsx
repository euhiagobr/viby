
'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ExperienceCategoryCardProps {
  category: any;
  isActive: boolean;
  onClick: () => void;
}

export function ExperienceCategoryCard({ category, isActive, onClick }: ExperienceCategoryCardProps) {
  // Imagem mockada baseada na categoria para o marketplace
  const mockImage = React.useMemo(() => {
    const seed = category.name.length;
    return `https://picsum.photos/seed/${seed * 7}/600/600`;
  }, [category.name]);

  return (
    <button 
      onClick={onClick}
      className={cn(
        "group relative aspect-square w-full rounded-[2rem] overflow-hidden transition-all duration-500",
        isActive ? "ring-4 ring-secondary ring-offset-4" : "hover:scale-[1.02]"
      )}
    >
      <img 
        src={mockImage} 
        alt={category.name} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
      />
      <div className={cn(
        "absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/20",
        isActive && "bg-secondary/40"
      )} />
      
      <div className="absolute inset-x-0 bottom-0 p-6 text-center">
         <span className="text-sm md:text-lg font-black uppercase italic tracking-tighter text-white drop-shadow-xl block transition-transform group-hover:translate-y-[-5px]">
            {category.name}
         </span>
      </div>
    </button>
  );
}
