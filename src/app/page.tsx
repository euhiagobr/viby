import LandingPageClient from "@/app/LandingPageClient";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useTranslation } from "@/i18n/server";

export default async function Home() {
  const { t } = await useTranslation();

  const headerTexts = {
    announce: t('header.announce'),
    dashboard: t('header.dashboard'),
    login: t('header.login'),
  };

  return (
    <main>
      <PublicHeader texts={headerTexts} />
      <LandingPageClient />
    </main>
  );
}
