
"use client"

import * as React from "react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, ShieldCheck, Globe, Mail, MapPin, User, Lock, Eye, Database, Globe2 } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { useTranslation } from "@/i18n/i18n-context"

export default function PoliticaPrivacidadePage() {
  const { t } = useTranslation()
  const db = useFirestore()
  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  
  const siteName = settings?.siteName || "Viby"

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl ? (
              <div className="w-8 h-8 relative flex items-center justify-center">
                <img src={settings.logoUrl} alt={siteName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">{siteName.charAt(0)}</span>
              </div>
            )}
            <span className="text-xl font-bold tracking-tight">{siteName}</span>
          </Link>
          <Button variant="ghost" asChild className="font-semibold">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.back')}
            </Link>
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 md:py-20 flex-1">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" />
              {t('privacy.title')}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-primary">
              {t('privacy.title').split(' ')[0]} <span className="text-secondary">{t('privacy.title').split(' ').slice(1).join(' ')}</span>
            </h1>
            <p className="text-muted-foreground font-medium">
              {t('privacy.updated_at')}
            </p>
          </div>

          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none">
              <div className="space-y-8 text-foreground/80 leading-relaxed font-medium text-sm md:text-base">
                <p>
                  {t('privacy.intro').replace('{siteName}', siteName)}
                </p>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">1.</span> {t('privacy.section1_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-2 border-l-4 border-secondary">
                      <p className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> {t('privacy.section1_item1_label')}
                      </p>
                      <p className="text-xs">{t('privacy.section1_item1_desc')}</p>
                    </div>
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-2 border-l-4 border-secondary">
                      <p className="font-black text-xs uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> {t('privacy.section1_item2_label')}
                      </p>
                      <p className="text-xs">{t('privacy.section1_item2_desc')}</p>
                    </div>
                  </div>
                  <div className="bg-primary/5 p-6 rounded-2xl border-2 border-dashed border-primary/10 flex items-start gap-4">
                    <Lock className="w-5 h-5 text-primary shrink-0 mt-1" />
                    <div>
                      <p className="font-bold text-sm text-primary uppercase tracking-tighter">{t('privacy.section1_finance_label')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('privacy.section1_finance_desc').replace('{siteName}', siteName)}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">2.</span> {t('privacy.section2_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section2_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">3.</span> {t('privacy.section3_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section3_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">4.</span> {t('privacy.section4_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section4_desc').replace('{siteName}', siteName)}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">5.</span> {t('privacy.section5_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section5_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">6.</span> {t('privacy.section6_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section6_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">7.</span> {t('privacy.section7_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section7_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">8.</span> {t('privacy.section8_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section8_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">9.</span> {t('privacy.section9_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section9_desc')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">10.</span> {t('privacy.section10_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section10_desc')}</p>
                </section>

                <section className="space-y-6">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">11.</span> {t('privacy.section11_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section11_desc')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <User className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">{t('privacy.section11_owner')}</p>
                        <p className="font-bold">Hiago Alves</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <MapPin className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">{t('privacy.section11_location')}</p>
                        <p className="font-bold">Porto Alegre / RS</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl md:col-span-2">
                      <Mail className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">{t('privacy.section11_email')}</p>
                        <p className="font-bold">privacidade@viby.club</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">12.</span> {t('privacy.section12_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('privacy.section12_desc')}</p>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
