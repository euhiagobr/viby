
"use client"

import * as React from "react"
import { useFirestore, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileText, Globe, Mail, MapPin, User } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import { useTranslation } from "@/i18n/i18n-context"

export default function TermosDeUsoPage() {
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
              <FileText className="w-3 h-3" />
              {t('footer.legal')}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-primary">
              {t('terms.title').split(' ')[0]} <span className="text-secondary">{t('terms.title').split(' ').slice(1).join(' ')}</span>
            </h1>
            <p className="text-muted-foreground font-medium">
              {t('terms.updated_at')}
            </p>
          </div>

          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-8 md:p-12 prose prose-slate max-w-none">
              <div className="space-y-8 text-foreground/80 leading-relaxed font-medium text-sm md:text-base">
                <p>
                  {t('terms.intro').replace('{siteName}', siteName)}
                </p>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">1.</span> {t('terms.section1_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('terms.section1_desc1').replace('{siteName}', siteName)}</p>
                  <p>{t('terms.section1_desc2')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">2.</span> {t('terms.section2_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('terms.section2_desc1')}</p>
                  <p>{t('terms.section2_desc2')}</p>
                  <div className="bg-muted/30 p-6 rounded-2xl border-l-4 border-secondary space-y-2">
                    <p className="font-black text-xs uppercase tracking-widest text-primary mb-2">{t('terms.section2_responsibilities_title')}</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>{t('terms.section2_responsibilities_item1')}</li>
                      <li>{t('terms.section2_responsibilities_item2')}</li>
                      <li>{t('terms.section2_responsibilities_item3')}</li>
                    </ul>
                  </div>
                  <p>{t('terms.section2_desc3').replace('{siteName}', siteName)}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">3.</span> {t('terms.section3_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('terms.section3_desc1')}</p>
                  <p>{t('terms.section3_desc2')}</p>
                  <p>{t('terms.section3_desc3')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">4.</span> {t('terms.section4_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('terms.section4_desc1')}</p>
                  <p>{t('terms.section4_desc2').replace('{siteName}', siteName)}</p>
                  <div className="bg-muted/30 p-6 rounded-2xl border-l-4 border-secondary space-y-2">
                    <p className="font-black text-xs uppercase tracking-widest text-primary mb-2">{t('terms.section4_responsibilities_title')}</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>{t('terms.section4_responsibilities_item1')}</li>
                      <li>{t('terms.section4_responsibilities_item2')}</li>
                      <li>{t('terms.section4_responsibilities_item3')}</li>
                      <li>{t('terms.section4_responsibilities_item4')}</li>
                      <li>{t('terms.section4_responsibilities_item5')}</li>
                    </ul>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">5.</span> {t('terms.section5_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('terms.section5_desc1')}</p>
                  <p>{t('terms.section5_desc2')}</p>
                  <p>{t('terms.section5_desc3')}</p>
                  <p>{t('terms.section5_desc4')}</p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">6.</span> {t('terms.section6_title').split(' ').slice(1).join(' ')}
                  </h2>
                  <p>{t('terms.section6_desc1')}</p>
                  <p>{t('terms.section6_desc2')}</p>
                </section>

                <section className="space-y-6">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">15.</span> {t('terms.section15_title')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <User className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">{t('privacy.section11_owner')}</p>
                        <p className="font-bold">Hiago Alves</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/20 rounded-xl">
                      <Mail className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-[10px] font-black uppercase opacity-60">{t('privacy.section11_email')}</p>
                        <p className="font-bold">suporte@viby.club</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-primary flex items-center gap-3">
                    <span className="text-secondary">16.</span> {t('terms.section16_title')}
                  </h2>
                  <p>{t('terms.section16_desc')}</p>
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
