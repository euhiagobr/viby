'use client';

import React from 'react';
import { CityGuideSection } from './CityGuideSection';
import { ContentCarousel } from './ContentCarousel';
import { GenericContentCard } from './GenericContentCard';

interface SectionProps {
  items: any[];
}

export function TrendingSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category={item.category || item.type || 'Evento'}
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      time={item.time}
      link={`/${item.type || 'evento'}/${item.id}`}
      isFree={item.isFree}
      compact
    />
  ));

  return (
    <CityGuideSection
      title="Em alta"
      subtitle="Os mais procurados agora"
      icon="🔥"
      viewMoreLink="#trending"
    >
      <ContentCarousel items={cardItems} itemsPerView={4} gap={16} />
    </CityGuideSection>
  );
}

export function NearYouSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category={item.category || item.type || 'Evento'}
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      time={item.time}
      link={`/${item.type || 'evento'}/${item.id}`}
      isFree={item.isFree}
      compact
    />
  ));

  return (
    <CityGuideSection
      title="Perto de você"
      subtitle="Ordenado por distância"
      icon="📍"
      viewMoreLink="#perto"
    >
      <ContentCarousel items={cardItems} itemsPerView={5} gap={16} />
    </CityGuideSection>
  );
}

export function DateNightSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category={item.category || item.type || 'Evento'}
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      time={item.time}
      link={`/${item.type || 'evento'}/${item.id}`}
      isFree={item.isFree}
      compact
    />
  ));

  return (
    <CityGuideSection
      title="Para um encontro"
      subtitle="Romântico, especial e inesquecível"
      icon="❤️"
      viewMoreLink="#encontro"
    >
      <ContentCarousel items={cardItems} itemsPerView={4} gap={16} />
    </CityGuideSection>
  );
}

export function FamilySection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category={item.category || item.type || 'Evento'}
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      time={item.time}
      link={`/${item.type || 'evento'}/${item.id}`}
      isFree={item.isFree}
      compact
    />
  ));

  return (
    <CityGuideSection
      title="Para fazer em família"
      subtitle="Diversão garantida para todas as idades"
      icon="👨‍👩‍👧"
      viewMoreLink="#familia"
    >
      <ContentCarousel items={cardItems} itemsPerView={4} gap={16} />
    </CityGuideSection>
  );
}

export function TonightSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category={item.category || item.type || 'Evento'}
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      time={item.time}
      link={`/${item.type || 'evento'}/${item.id}`}
      isFree={item.isFree}
      compact
    />
  ));

  return (
    <CityGuideSection
      title="Hoje à noite"
      subtitle="O que está acontecendo agora"
      icon="🌙"
      viewMoreLink="#noite"
    >
      <ContentCarousel items={cardItems} itemsPerView={4} gap={16} />
    </CityGuideSection>
  );
}

export function RestaurantsSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category="Restaurante"
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      link={`/restaurante/${item.id}`}
      isFree={false}
    />
  ));

  return (
    <CityGuideSection
      title="Onde comer hoje"
      subtitle="Restaurantes, bares e cafés"
      icon="🍴"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardItems.slice(0, 9)}
      </div>
    </CityGuideSection>
  );
}

export function EventsSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category="Evento"
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      time={item.time}
      link={`/evento/${item.id}`}
      isFree={item.isFree}
    />
  ));

  return (
    <CityGuideSection
      title="Eventos desta semana"
      subtitle="Programação completa"
      icon="🎭"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardItems.slice(0, 9)}
      </div>
    </CityGuideSection>
  );
}

export function ExperiencesSection({ items }: SectionProps) {
  const cardItems = items.map((item) => (
    <GenericContentCard
      key={item.id}
      id={item.id}
      title={item.title}
      image={item.image || item.imageUrl || '/images/placeholder.jpg'}
      location={item.location || item.city || 'Localização não informada'}
      category="Experiência"
      rating={item.rating}
      reviewCount={item.reviewCount}
      price={item.price}
      priceLabel={item.priceLabel}
      link={`/experiencia/${item.id}`}
      isFree={item.isFree}
    />
  ));

  return (
    <CityGuideSection
      title="Experiências imperdíveis"
      subtitle="Viva momentos únicos"
      icon="✨"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cardItems.slice(0, 9)}
      </div>
    </CityGuideSection>
  );
}
