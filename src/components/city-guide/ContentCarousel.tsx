'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface ContentCarouselProps {
  items: React.ReactNode[];
  itemsPerView?: number;
  gap?: number;
}

export function ContentCarousel({
  items,
  itemsPerView = 3,
  gap = 24
}: ContentCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      setCanScrollLeft(scrollContainerRef.current.scrollLeft > 0);
      setCanScrollRight(
        scrollContainerRef.current.scrollLeft <
          scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth - 10
      );
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300 + gap;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });

      setTimeout(checkScroll, 300);
    }
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    scrollContainerRef.current?.addEventListener('scroll', checkScroll);

    return () => {
      window.removeEventListener('resize', checkScroll);
      scrollContainerRef.current?.removeEventListener('scroll', checkScroll);
    };
  }, []);

  return (
    <div className="relative">
      {/* Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide scroll-smooth"
        onScroll={checkScroll}
      >
        <div className="flex gap-6" style={{ gap: `${gap}px` }}>
          {items.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="flex-shrink-0 w-72"
            >
              {item}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-all hover:bg-gray-50"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-gray-900" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-all hover:bg-gray-50"
          aria-label="Scroll right"
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
