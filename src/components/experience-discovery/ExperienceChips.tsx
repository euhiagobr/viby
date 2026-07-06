'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Chip {
  id: string;
  label: string;
}

interface ExperienceChipsProps {
  chips: Chip[];
  selectedChips: string[];
  onChipChange: (chipId: string) => void;
}

export function ExperienceChips({
  chips,
  selectedChips,
  onChipChange
}: ExperienceChipsProps) {
  return (
    <div className="w-full" style={{ maxWidth: '1440px', margin: '0 auto', paddingInline: '32px', marginTop: '32px' }}>
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {chips.map((chip, idx) => (
          <motion.button
            key={chip.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onChipChange(chip.id)}
            className={`flex-shrink-0 font-medium transition-all ${
              selectedChips.includes(chip.id)
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-900 hover:bg-gray-50'
            }`}
            style={{
              height: '44px',
              paddingInline: '24px',
              borderRadius: '999px',
              boxShadow: selectedChips.includes(chip.id)
                ? '0 4px 12px rgba(37, 99, 235, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.08)',
              fontSize: '14px',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            {chip.label}
          </motion.button>
        ))}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
