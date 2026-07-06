'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ExperienceCarouselProps {
  items: React.ReactNode[];
}

export function ExperienceCarousel({ items }: ExperienceCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      setCanScrollLeft(scrollRef.current.scrollLeft > 0);
      setCanScrollRight(
        scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10
      );
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = 320 + 24;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    scrollRef.current?.addEventListener('scroll', checkScroll);

    return () => {
      window.removeEventListener('resize', checkScroll);
      scrollRef.current?.removeEventListener('scroll', checkScroll);
    };
  }, []);

  return (
    <div className="relative">
      {/* Carousel */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide scroll-smooth flex gap-6"
        onScroll={checkScroll}
      >
        {items.map((item, idx) => (
          <div key={idx} className="flex-shrink-0">
            {item}
          </div>
        ))}
      </div>

      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-all"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <ChevronLeft className="w-5 h-5 text-gray-900" />
        </button>
      )}

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-gray-50 transition-all"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <ChevronRight className="w-5 h-5 text-gray-900" />
        </button>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
