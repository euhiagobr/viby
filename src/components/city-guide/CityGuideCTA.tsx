'use client';

import React from 'react';
import { Heart, Plus } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export function CityGuideCTA() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      className="py-16 md:py-20 px-4 md:px-8 lg:px-16 bg-white border-t border-gray-200"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Save Favorites */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left py-8 md:py-12">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <Heart className="w-8 h-8 md:w-10 md:h-10 text-red-500 fill-red-500" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              Salve seus favoritos
            </h3>
            <p className="text-gray-600 mb-6 max-w-sm">
              Crie uma conta e salve todos os lugares, eventos e experiências que você quer visitar
            </p>
            <Link
              href="/cadastro"
              className="inline-block px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Criar conta
            </Link>
          </div>

          {/* Create Listing */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left py-8 md:py-12 border-t md:border-t-0 md:border-l md:pl-8 md:border-gray-200">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Plus className="w-8 h-8 md:w-10 md:h-10 text-primary" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              Crie seu próprio anúncio
            </h3>
            <p className="text-gray-600 mb-6 max-w-sm">
              Faça parte da comunidade Viby e comece a compartilhar seus eventos, experiências ou negócio
            </p>
            <Link
              href="/anunciar"
              className="inline-block px-8 py-3 bg-white text-primary border-2 border-primary font-bold rounded-lg hover:bg-primary/5 transition-colors"
            >
              Comece agora
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
