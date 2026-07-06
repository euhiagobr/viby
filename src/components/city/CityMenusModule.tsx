'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CityModuleSection } from './CityModuleSection';
import { motion } from 'framer-motion';

interface CityMenusModuleProps {
  menus: any[];
  cityName: string;
}

export function CityMenusModule({ menus, cityName }: CityMenusModuleProps) {
  if (!menus || menus.length === 0) return null;

  return (
    <CityModuleSection
      title="Cardápios Digitais"
      description="Explore os cardápios dos restaurantes"
      icon={<BookOpen className="w-6 h-6" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {menus.slice(0, 6).map((menu) => (
          <motion.div
            key={menu.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            viewport={{ once: true }}
          >
            <Link href={`/${menu.username || menu.organizationId}/cardapio`}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                {/* Image */}
                {menu.organizationAvatar && (
                  <div className="relative w-full h-48 bg-gray-200">
                    <Image
                      src={menu.organizationAvatar}
                      alt={menu.organizationName}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                    {menu.organizationName}
                  </h3>

                  <div className="flex items-center gap-2 text-primary text-sm font-medium group">
                    <span>Ver Cardápio</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </CityModuleSection>
  );
}
