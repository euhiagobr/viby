'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface CityModuleSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  viewAllHref?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function CityModuleSection({
  title,
  description,
  children,
  viewAllHref,
  icon,
  className = ''
}: CityModuleSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true, margin: '-100px' }}
      className={`py-12 md:py-16 px-4 md:px-8 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          {icon && <div className="text-primary">{icon}</div>}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
            {description && (
              <p className="text-gray-600 text-sm md:text-base mt-1">{description}</p>
            )}
          </div>
        </div>

        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
          >
            <span className="text-sm font-medium hidden sm:inline">Ver todos</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        )}
      </div>

      {/* Content */}
      <div>
        {children}
      </div>
    </motion.section>
  );
}
