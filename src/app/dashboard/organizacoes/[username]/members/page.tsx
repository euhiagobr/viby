'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function RedirectToEquipe() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.replace(`/dashboard/organizacoes/${params.username}/equipe`);
  }, [router, params.username]);

  return null;
}
