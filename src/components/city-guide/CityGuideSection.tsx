'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface CityGuideSectionProps {
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  className?: string;
  viewMoreLink?: string;
}

export function CityGuideSection({
  title,
  subtitle,
  icon,
  children,
  className = '',
  viewMoreLink
}: CityGuideSectionProps) {
  return (
    <section className={`py-20 md:py-28 px-4 md:px-8 lg:px-16 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mb-12 md:mb-16 flex items-start justify-between"
        >
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl md:text-5xl">{icon}</div>
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-gray-600 text-base md:text-lg font-light mt-2">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
          {viewMoreLink && (
            <Link
              href={viewMoreLink}
              className="hidden md:flex items-center gap-1 text-primary font-bold hover:gap-2 transition-all whitespace-nowrap"
            >
              Ver todos
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </motion.div>

        {/* Content */}
        <div>
          {children}
        </div>
      </div>
    </section>
  );
}
