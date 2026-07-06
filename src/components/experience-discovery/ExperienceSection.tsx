'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ExperienceCarousel } from './ExperienceCarousel';

interface ExperienceSectionProps {
  title: string;
  description: string;
  icon: string;
  items: React.ReactNode[];
  viewAllLink?: string;
}

export function ExperienceSection({
  title,
  description,
  icon,
  items,
  viewAllLink
}: ExperienceSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.4 }}
      className="w-full"
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        paddingInline: '32px',
        marginTop: '72px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '32px' }}>{icon}</span>
          <div>
            <h2
              className="text-gray-900 font-bold"
              style={{ fontSize: '28px' }}
            >
              {title}
            </h2>
            <p
              className="text-gray-600"
              style={{ fontSize: '16px', fontWeight: 400 }}
            >
              {description}
            </p>
          </div>
        </div>

        {viewAllLink && (
          <Link
            href={viewAllLink}
            className="hidden md:flex items-center gap-1 text-blue-600 font-semibold hover:text-blue-700 transition-colors whitespace-nowrap"
          >
            Ver todos
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Carousel */}
      <ExperienceCarousel items={items} />
    </motion.section>
  );
}
