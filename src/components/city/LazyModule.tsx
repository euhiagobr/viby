'use client';

import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyModuleProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function LazyModule({ children, fallback }: LazyModuleProps) {
  return (
    <Suspense fallback={fallback || <ModuleSkeleton />}>
      {children}
    </Suspense>
  );
}

function ModuleSkeleton() {
  return (
    <div className="py-12 md:py-16 px-4 md:px-8 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
