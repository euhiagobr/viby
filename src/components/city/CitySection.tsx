'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CitySectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  dark?: boolean;
}

export function CitySection({
  title,
  subtitle,
  icon,
  children,
  dark = false
}: CitySectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
      className={`py-20 md:py-32 px-4 md:px-8 ${dark ? 'bg-gray-950' : 'bg-white'}`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16 md:mb-28 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {icon && (
                <div className={`text-3xl md:text-4xl ${dark ? 'text-white' : 'text-gray-900'}`}>
                  {icon}
                </div>
              )}
              <h2 className={`text-4xl md:text-5xl font-black tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </h2>
            </div>

            {subtitle && (
              <p className={`text-lg md:text-xl font-light leading-relaxed ml-12 md:ml-16 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        {children}
      </div>
    </motion.section>
  );
}
