'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { ExperienceCardPremium } from '@/components/experiences/ExperienceCardPremium';
import { CityModuleSection } from './CityModuleSection';

interface CityExperiencesModuleProps {
  experiences: any[];
  cityName: string;
}

export function CityExperiencesModule({ experiences, cityName }: CityExperiencesModuleProps) {
  if (!experiences || experiences.length === 0) return null;

  return (
    <CityModuleSection
      title="Experiências em Destaque"
      description="Viva momentos únicos e inesquecíveis"
      icon={<Sparkles className="w-6 h-6" />}
      viewAllHref={`/experiencias?cidade=${encodeURIComponent(cityName)}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {experiences.slice(0, 6).map((experience) => (
          <ExperienceCardPremium key={experience.id} experience={experience} />
        ))}
      </div>
    </CityModuleSection>
  );
}
