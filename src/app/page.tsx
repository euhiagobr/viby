
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { Loader2 } from "lucide-react"

export default function RootPage() {
  const auth = useAuth()
  const { user, loading } = useUser(auth)
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [user, loading, router])

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center animate-bounce">
          <span className="text-white font-bold text-3xl">V</span>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}
