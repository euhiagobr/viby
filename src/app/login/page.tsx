
"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { Loader2, User, Mail, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react"
import Link from "next/link"
import Footer from "@/components/layout/Footer"
import Image from "next/image"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/i18n/i18n-context"

function LoginContent() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()
  const { user, profile, loading: authLoading, isInitialized } = useUser(auth)
  const db = useFirestore()

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db])
  const { data: settings } = useDoc<any>(settingsRef)
  const siteName = settings?.siteName || "Viby"

  useEffect(() => {
    if (!isInitialized || authLoading) return;

    if (user) {
      const hasMandatoryData = !!(profile?.username && profile?.cpfHash);
      const isComplete = profile !== null && hasMandatoryData && !profile?.needsCPFUpdate;

      if (!isComplete) {
        router.replace("/onboarding");
      } else {
        const redirect = searchParams.get('redirect') || "/dashboard";
        router.replace(redirect);
      }
    }
  }, [user, profile, isInitialized, authLoading, router, searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!auth || !db) return

    setLoading(true)
    try {
      let emailToUse = identifier.trim().toLowerCase();

      if (!identifier.includes("@")) {
        const usernameClean = identifier.replace('@', '').toLowerCase().trim();
        const usernameRef = doc(db, "usernames", usernameClean)
        const usernameSnap = await getDoc(usernameRef)
        
        if (!usernameSnap.exists()) throw new Error("Usuário não encontrado.")
        emailToUse = usernameSnap.data().email
      }

      await signInWithEmailAndPassword(auth, emailToUse, password)
      toast({ title: t('common.success') })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no login", description: "Credenciais incorretas." })
    } finally {
      setLoading(false)
    }
  }

  const showSync = !isInitialized || authLoading;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt={siteName} 
                width={120} 
                height={40} 
                style={{ height: 'auto' }}
                className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105" 
                priority 
                unoptimized 
              />
            ) : (
              <>
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <span className="text-xl font-bold tracking-tight italic uppercase text-primary ml-1">{siteName}</span>
              </>
            )}
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="font-semibold text-xs uppercase tracking-widest">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> {t('common.back')}</Link>
            </Button>
          </div>
        </div>
      </nav>
      {/* REST OF COMPONENT OMITTED FOR BREVITY */}
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>}>
      <LoginContent />
    </React.Suspense>
  )
}
