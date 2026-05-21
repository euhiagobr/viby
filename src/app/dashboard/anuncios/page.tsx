"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCurrentOrganization } from "@/contexts/OrganizationContext"
import { Loader2 } from "lucide-react"

/**
 * Redirecionamento legado para a nova estrutura de anúncios por marca.
 */
export default function LegacyAdsRedirect() {
  const router = useRouter()
  const { currentOrg, loading } = useCurrentOrganization()

  useEffect(() => {
    if (!loading) {
      if (currentOrg) {
        router.replace(`/dashboard/organizacoes/${currentOrg.username}/anuncios`)
      } else {
        router.replace("/dashboard/organizacoes")
      }
    }
  }, [currentOrg, loading, router])

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
    </div>
  )
}
