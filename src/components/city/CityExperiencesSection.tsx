'use client';

import React from 'react';
import { CitySection } from './CitySection';
import { ExperienceCardPremium } from '@/components/experiences/ExperienceCardPremium';

interface CityExperiencesSectionProps {
  experiences: any[];
}

export function CityExperiencesSection({ experiences = [] }: CityExperiencesSectionProps) {
  if (!experiences || experiences.length === 0) return null;

  return (
    <CitySection
      title="Viva a Cidade"
      subtitle="Experiências únicas e inesquecíveis para descobrir"
      icon="✨"
      dark
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {experiences.slice(0, 6).map((exp) => (
          <ExperienceCardPremium key={exp.id} experience={exp} />
        ))}
      </div>
    </CitySection>
  );
}
