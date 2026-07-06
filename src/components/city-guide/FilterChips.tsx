'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface FilterChip {
  id: string;
  label: string;
  icon?: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selectedChips: string[];
  onChipChange: (chipId: string) => void;
}

export function FilterChips({ chips, selectedChips, onChipChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-3 md:gap-4">
      {chips.map((chip, idx) => (
        <motion.button
          key={chip.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
          onClick={() => onChipChange(chip.id)}
          className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-semibold text-sm md:text-base transition-all whitespace-nowrap ${
            selectedChips.includes(chip.id)
              ? 'bg-primary text-white shadow-lg scale-105'
              : 'bg-white/90 text-gray-900 border border-gray-200 hover:border-primary hover:text-primary'
          }`}
        >
          {chip.icon && <span className="mr-2">{chip.icon}</span>}
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
