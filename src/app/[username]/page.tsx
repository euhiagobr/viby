"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useFirestore, useDoc, useAuth, useUser } from "@/firebase"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Componente Unificado que resolve se o username é User ou Organization
export default function UniversalProfilePage() {
  const params = useParams()
  const router = useRouter()
  const db = useFirestore()
  const username = (params.username as string).toLowerCase()

  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<any>(null)
  const [type, setType] = React.useState<'user' | 'organization' | null>(null)

  React.useEffect(() => {
    if (!db || !username) return

    const resolveUsername = async () => {
      setLoading(true)
      try {
        const usernameRef = doc(db, "usernames", username)
        const usernameSnap = await getDoc(usernameRef)

        if (!usernameSnap.exists()) {
          setLoading(false)
          return
        }

        const { uid, type: resolvedType } = usernameSnap.data()
        setType(resolvedType)

        const targetColl = resolvedType === 'user' ? 'users' : 'organizations'
        const targetId = resolvedType === 'user' ? uid : uid // No modelo org o uid é o ID da org

        const dataSnap = await getDoc(doc(db, targetColl, targetId))
        if (dataSnap.exists()) {
          setData({ id: dataSnap.id, ...dataSnap.data() })
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    resolveUsername()
  }, [db, username])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-secondary" /></div>
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">Perfil não encontrado</h2>
        <Button asChild><Link href="/dashboard">Voltar ao Início</Link></Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
       {/* Aqui o layout se adapta baseado no type */}
       <header className="bg-white border-b h-16 flex items-center px-8 sticky top-0 z-50">
         <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
         <h1 className="ml-4 font-black italic uppercase tracking-tighter">Viby / {data.username}</h1>
       </header>

       <div className="container mx-auto py-20">
          <div className="max-w-4xl mx-auto space-y-8">
             <div className="flex flex-col items-center text-center gap-6">
                <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-muted">
                   <img src={data.avatar} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-2">
                   <h2 className="text-4xl font-black italic uppercase tracking-tight">{data.name || data.displayName}</h2>
                   <p className="text-secondary font-bold">@{data.username}</p>
                   <p className="text-muted-foreground font-medium max-w-lg mx-auto">{data.bio}</p>
                </div>
                <div className="flex gap-4">
                   <Button className="rounded-full px-8 font-black uppercase text-xs italic bg-secondary text-white">Seguir {type === 'organization' ? 'Marca' : 'Usuário'}</Button>
                </div>
             </div>
             
             <div className="pt-10 border-t border-dashed border-border">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-8 text-center">
                  {type === 'organization' ? 'Eventos Publicados' : 'Experiências do Usuário'}
                </h3>
                <div className="text-center py-20 opacity-30 italic">Nenhum conteúdo público disponível no momento.</div>
             </div>
          </div>
       </div>
    </div>
  )
}