"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useFirebaseApp } from "@/firebase"
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  Check, 
  X, 
  Upload, 
  Building2,
  Globe
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const ORG_TYPES = [
  {
    category: "Arte, Cultura e Entretenimento",
    items: ["Produtora de Eventos", "Casa Noturna", "Bar", "Pub", "Festival", "Coletivo Cultural", "Companhia Artística", "Banda", "DJ", "Artista", "Músico(a)", "Escola de Dança", "Teatro", "Cinema", "Centro Cultural", "Galeria de Arte", "Estúdio Criativo"]
  },
  {
    category: "Beleza, Moda e Lifestyle",
    items: ["Salão de Beleza", "Barbearia", "Clínica de Estética", "Estilista", "Marca de Moda", "Loja de Roupas", "Loja Vintage", "Estúdio de Tatuagem", "Spa", "Makeup Studio", "Agência de Modelos", "Fashion Brand"]
  },
  {
    category: "Gastronomia",
    items: ["Restaurante", "Cafeteria", "Hamburgueria", "Food Truck", "Buffet", "Confeitaria", "Pizzaria", "Vinícola", "Cervejaria", "Adega", "Bar de Drinks", "Chef", "Cozinha Autorais"]
  },
  {
    category: "Empresas e Negócios",
    items: ["Empresa", "Startup", "Agência de Marketing", "Agência Digital", "Coworking", "Consultoria", "Escritório", "Loja", "E-commerce", "Marca", "Franquia", "Empresa de Tecnologia"]
  },
  {
    category: "Saúde e Bem-estar",
    items: ["Academia", "Crossfit", "Estúdio de Yoga", "Clínica", "Psicologia", "Nutrição", "Personal Trainer", "Espaço Terapêutico"]
  },
  {
    category: "Educação e Desenvolvimento",
    items: ["Escola", "Universidade", "Curso", "Escola de Idiomas", "Escola Técnica", "Projeto Educacional", "Mentor(a)", "Palestrante", "Centro de Treinamento"]
  },
  {
    category: "Turismo e Hospitalidade",
    items: ["Hotel", "Hostel", "Pousada", "Agência de Turismo", "Parque", "Resort", "Espaço de Eventos"]
  },
  {
    category: "Comunidade e Instituições",
    items: ["ONG", "Associação", "Coletivo", "Fundação", "Organização Social", "Instituição Pública", "Prefeitura", "Secretaria", "Câmara Municipal", "Projeto Social", "Igreja", "Organização Religiosa", "Centro Comunitário"]
  },
  {
    category: "Esporte e Comunidades",
    items: ["Clube", "Time", "Organização Esportiva", "Liga", "Atlética", "Grupo de Corrida", "Comunidade Gamer", "Equipe de E-sports"]
  },
  {
    category: "Tecnologia e Games",
    items: ["Estúdio de Jogos", "Comunidade Tech", "Empresa de Software", "Desenvolvedora", "Plataforma Digital", "Criador de Conteúdo", "Streamer", "Podcast"]
  },
  {
    category: "Comércio e Experiências",
    items: ["Shopping", "Feira", "Mercado", "Loja Geek", "Livraria", "Pet Shop", "Sex Shop", "Tabacaria", "Floricultura"]
  },
  {
    category: "Categoria Genérica",
    items: ["Outro"]
  }
]

export default function NovaOrganizacaoPage() {
  const router = useRouter()
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const app = useFirebaseApp()

  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    type: "",
    bio: "",
    avatar: ""
  })

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, 'viby');
  }, [app])

  useEffect(() => {
    if (!db || !formData.username) {
      setUsernameStatus('idle')
      return
    }

    const newUsername = formData.username.toLowerCase().trim()
    const regex = /^[a-zA-Z0-9_-]+$/
    
    if (newUsername.length < 3 || !regex.test(newUsername)) {
      setUsernameStatus('invalid')
      return
    }

    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", newUsername)
        const usernameSnap = await getDoc(usernameRef)
        setUsernameStatus(usernameSnap.exists() ? 'taken' : 'valid')
      } catch (e) {
        console.error(e)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.username, db])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !user) return

    setUploadProgress(0)
    try {
      const fileName = `organizations/avatars/${Date.now()}_${file.name}`
      const storageRef = ref(storage, fileName)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        () => { setUploadProgress(null); toast({ variant: "destructive", title: "Erro no upload" }) },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFormData(prev => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Avatar carregado!" })
        }
      )
    } catch (err) { setUploadProgress(null) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !user || usernameStatus !== 'valid') return

    setLoading(true)
    const orgId = crypto.randomUUID()
    const normalizedUsername = formData.username.toLowerCase().trim()

    try {
      await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, "usernames", normalizedUsername)
        const orgRef = doc(db, "organizations", orgId)
        const memberRef = doc(db, "organizations", orgId, "members", user.uid)

        const usernameSnap = await transaction.get(usernameRef)
        if (usernameSnap.exists()) throw new Error("Username já ocupado.")

        // 1. Reserva o username globalmente
        transaction.set(usernameRef, { uid: orgId, type: 'organization' })

        // 2. Cria a organização
        transaction.set(orgRef, {
          id: orgId,
          ...formData,
          username: normalizedUsername,
          slug: normalizedUsername,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          verified: false
        })

        // 3. Adiciona o criador como OWNER
        transaction.set(memberRef, {
          userId: user.uid,
          role: 'owner',
          createdAt: serverTimestamp()
        })
      })

      toast({ title: "Organização criada!", description: "Você já pode começar a publicar eventos." })
      router.push(`/dashboard/organizations`)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao criar", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/organizations">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Nova Organização</h1>
          <p className="text-muted-foreground">Crie um perfil para sua produtora, marca ou coletivo.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
            <CardDescription>Essas informações aparecerão na página pública da organização.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative group">
                <Avatar className="h-24 w-24 border-2 border-muted shadow-sm">
                  <AvatarImage src={formData.avatar} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <label htmlFor="org-avatar" className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="w-5 h-5" />
                </label>
                <input id="org-avatar" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
              {uploadProgress !== null && <Progress value={uploadProgress} className="w-32 h-1" />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Organização</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Viby Produtora" 
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username exclusivo (@)</Label>
                <div className="relative">
                  <Input 
                    id="username" 
                    placeholder="viby-eventos" 
                    value={formData.username}
                    onChange={e => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    className={cn(
                      usernameStatus === 'valid' ? 'border-green-500 pr-10' : 
                      usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10'
                    )}
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : 
                     usernameStatus === 'valid' ? <Check className="w-4 h-4 text-green-500" /> : 
                     usernameStatus === 'taken' || usernameStatus === 'invalid' ? <X className="w-4 h-4 text-destructive" /> : null}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Este será o link público: viby.club/{formData.username || 'seu-nome'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Organização</Label>
              <Select 
                value={formData.type} 
                onValueChange={val => setFormData(prev => ({ ...prev, type: val }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {ORG_TYPES.map((group) => (
                    <SelectGroup key={group.category}>
                      <SelectLabel className="bg-muted/50 py-2 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {group.category}
                      </SelectLabel>
                      {group.items.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Descrição</Label>
              <Textarea 
                id="bio" 
                placeholder="Conte um pouco sobre o que vocês fazem..." 
                value={formData.bio}
                onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="min-h-[100px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-6 py-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
            Cancelar
          </button>
          <Button 
            type="submit" 
            className="bg-secondary text-white hover:bg-secondary/90 px-10 h-12 rounded-xl font-bold shadow-lg" 
            disabled={loading || usernameStatus !== 'valid'}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar Organização
          </Button>
        </div>
      </form>
    </div>
  )
}
