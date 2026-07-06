'use client';

import React from 'react';
import { ChefHat, Utensils, Sparkles, MapPin, Heart, Users, TrendingUp, Gift } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface CategoryCardProps {
  title: string;
  icon: React.ReactNode;
  link: string;
  count?: number;
}

function CategoryCard({ title, icon, link, count }: CategoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
    >
      <Link href={link}>
        <div className="flex flex-col items-center text-center cursor-pointer group">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 group-hover:shadow-lg transition-all duration-300">
            <div className="text-4xl md:text-5xl text-primary">
              {icon}
            </div>
          </div>
          <h3 className="font-bold text-base md:text-lg text-gray-900 mb-1">
            {title}
          </h3>
          {count !== undefined && (
            <p className="text-xs md:text-sm text-gray-500">
              {count} {count === 1 ? 'item' : 'itens'}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

interface ExploreByCategoryProps {
  stats: {
    restaurantes: number;
    eventos: number;
    experiencias: number;
    promocoes: number;
  };
}

export function ExploreByCategory({ stats }: ExploreByCategoryProps) {
  const categories = [
    {
      title: 'Comer & Beber',
      icon: '🍴',
      link: '#comer',
      count: stats.restaurantes
    },
    {
      title: 'Eventos',
      icon: '🎭',
      link: '#eventos',
      count: stats.eventos
    },
    {
      title: 'Experiências',
      icon: '✨',
      link: '#experiencias',
      count: stats.experiencias
    },
    {
      title: 'Promoções',
      icon: '🎁',
      link: '#promocoes',
      count: stats.promocoes
    }
  ];

  return (
    <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mb-12 md:mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
            Explorar por categoria
          </h2>
        </motion.div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {categories.map((category, idx) => (
            <CategoryCard
              key={category.title}
              title={category.title}
              icon={category.icon}
              link={category.link}
              count={category.count}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
