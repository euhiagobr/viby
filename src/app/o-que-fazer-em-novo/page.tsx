'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CidadeGuidePage() {
  const router = useRouter();

  useEffect(() => {
    // Redireciona para a home
    router.replace('/');
  }, [router]);

  return null;
}
