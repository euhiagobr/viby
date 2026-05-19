
"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  where, 
  writeBatch,
  serverTimestamp 
} from "firebase/firestore"
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, 
  Search, 
  Users, 
  Building2, 
  User as UserIcon,
  Trash2,
  Edit,
  Save,
  Upload,
  Info,
  Check,
  X
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"

const BUSINESS_CATEGORIES = {
  "Organizadores": ["Produtora de eventos", "Agência de marketing", "Agência de eventos", "Cerimonialista", "Organizador independente", "Assessoria de eventos"],
  "Casas e locais": ["Casa noturna", "Bar", "Pub", "Restaurante", "Café", "Lounge", "Hotel", "Resort", "Centro de eventos", "Arena", "Teatro", "Auditório", "Espaço cultural", "Galeria", "Parque", "Estádio", "Rooftop", "Coworking", "Centro de convenções"],
  "Música e entretenimento": ["Banda", "Cantor(a)", "DJ", "Grupo musical", "Artista", "Performer", "Drag queen", "Humorista", "Influenciador(a)", "Apresentador(a)"],
  "Eventos corporativos": ["Empresa privada", "Startup", "Consultoria", "RH/Treinamentos"],
  "Gastronomia": ["Buffet", "Food truck", "Confeitaria", "Hamburgueria", "Pizzaria", "Choperia", "Vinícola", "Cafeteria"],
  "Casamentos e festas": ["Decoradora", "Floricultura", "Fotografia", "Filmagem", "Sonorização", "Iluminação", "Locação de móveis", "Bartender", "Segurança", "Recreação infantil"],
  "Cultura e educação": ["Escola", "Universidade", "Curso", "ONG cultural", "Biblioteca", "Museu", "Coletivo artístico"],
  "Saúde e bem-estar": ["Academia", "Estúdio de yoga", "Clínica", "Espaço terapêutico", "Personal trainer"],
  "Turismo": ["Agência de turismo", "Guia turístico", "Operadora turística", "Passeios e experiências"],
  "Esportes": ["Clube esportivo", "Assessoria esportiva", "Equipe esportiva", "Academia funcional"],
  "Comunidade e causas": ["ONG", "Coletivo", "Associação", "Fundação", "Projeto social", "Movimento social"],
  "Governo e setor público": ["Prefeitura", "Secretaria", "Câmara municipal", "Governo estadual", "Governo federal", "Universidade pública"],
  "Religioso": ["Igreja", "Centro espírita", "Templo", "Comunidade religiosa"]
}

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 128 128" 
      className={cn("w-5 h-5", className)} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        fill="#0095f6" 
        d="M117.2 60.1l-6.5-6.6 2.3-9c1.1-4.4-1.2-8.9-5.3-10.7l-8.4-3.7-2.3-9c-1.1-4.4-5.2-7.4-9.7-7l-9.2.7-6.5-6.6c-3.2-3.2-8.2-3.2-11.4 0l-6.5 6.6-9.2-.7c-4.5-.4-8.6 2.6-9.7 7l-2.3 9-8.4 3.7c-4.1 1.8-6.4 6.3-5.3 10.7l2.3 9-6.5 6.6c-3.2 3.2-3.2 8.2 0 11.4l6.5 6.6-2.3 9c-1.1 4.4 1.2 8.9 5.3 10.7l8.4 3.7 2.3 9c1.1 4.4 5.2 7.4 9.7 7l9.2-.7 6.5 6.6c1.6 1.6 3.7 2.4 5.7 2.4s4.1-.8 5.7-2.4l6.5-6.6 9.2.7c.4 0 .7.1 1.1.1 4.1 0 7.9-3 8.6-7.1l2.3-9 8.4-3.7c4.1-1.8 6.4-6.3 5.3-10.7l-2.3-9 6.5-6.6c3.2-3.2 3.2-8.2 0-11.4z"
      />
      <path 
        fill="#fff" 
        d="M57.6 86.8c-1.8 0-3.5-.7-4.8-2L38.2 70.2c-2.7-2.7-2.7-7 0-9.6s7-2.7 9.6 0l9.8 9.8 22.8-22.8c2.7-2.7 7-2.7 9.6 0s2.7 7 0 9.6L62.4 84.8c-1.3 1.3-3 2-4.8 2z"
      />
    </svg>
  )
}

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const [search, setSearch] = React.useState("")
  const [editingUser, setEditingUser] = React.useState<any>(null)
  const [originalUser, setOriginalUser] = React.useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [checkingUsername, setCheckingUsername] = React.useState(false)
  const [usernameStatus, setUsernameStatus] = React.useState<'idle' | 'valid' | 'invalid' | 'taken'>('idle')

  const storage = React.useMemo(() => {
    if (!app) return null;
    return getStorage(app, "gs://viby");
  }, [app])

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "users"), orderBy("createdAt", "desc"))
  }, [db])

  const { data: users, loading } = useCollection<any>(usersQuery)

  const filteredUsers = React.useMemo(() => {
    if (!users) return []
    return users.filter(user => 
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.username?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
    )
  }, [users, search])

  const handleEditClick = (user: any) => {
    setEditingUser({ ...user })
    setOriginalUser({ ...user })
    setUsernameStatus('idle')
    setIsEditModalOpen(true)
  }

  React.useEffect(() => {
    if (!db || !editingUser?.username || !originalUser) return
    
    const newUsername = editingUser.username.toLowerCase().trim()
    const oldUsername = (originalUser.username || "").toLowerCase().trim()

    if (newUsername === oldUsername) {
      setUsernameStatus('idle')
      setCheckingUsername(false)
      return
    }

    const regex = /^[a-zA-Z0-9]+$/
    if (newUsername.length < 5 || newUsername.length > 20 || !regex.test(newUsername)) {
      setUsernameStatus('invalid')
      setCheckingUsername(false)
      return
    }

    setUsernameStatus('idle')
    setCheckingUsername(true)

    const timer = setTimeout(async () => {
      try {
        const usernameRef = doc(db, "usernames", newUsername)
        const usernameSnap = await getDoc(usernameRef)
        
        if (usernameSnap.exists()) {
          setUsernameStatus('taken')
        } else {
          setUsernameStatus('valid')
        }
      } catch (e) {
        console.error(e)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [editingUser?.username, originalUser, db])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !storage || !editingUser) return

    setUploadProgress(0)

    try {
      const storageRef = ref(storage, `profiles/${editingUser.id}/avatar_${Date.now()}`)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error(error)
          setUploadProgress(null)
          toast({ variant: "destructive", title: "Erro no upload" })
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setEditingUser(prev => ({ ...prev, avatar: downloadURL }))
          setUploadProgress(null)
          toast({ title: "Imagem carregada!" })
        }
      )
    } catch (err) {
      setUploadProgress(null)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingUser || isSaving) return

    const newUsername = editingUser.username.toLowerCase().trim()
    const oldUsername = (originalUser.username || "").toLowerCase().trim()
    const usernameChanged = newUsername !== oldUsername

    if (usernameChanged && usernameStatus !== 'valid') {
      toast({ variant: "destructive", title: "Erro", description: "O nome de usuário escolhido não está disponível ou é inválido." })
      return
    }

    setIsSaving(true)
    
    try {
      const batch = writeBatch(db)

      if (usernameChanged) {
        if (oldUsername) {
          batch.delete(doc(db, "usernames", oldUsername))
        }
        batch.set(doc(db, "usernames", newUsername), { uid: editingUser.id })
      }

      const userRef = doc(db, "users", editingUser.id)
      
      const { followersCount, rating, totalEvents, id, ...dataToUpdate } = editingUser;

      batch.update(userRef, {
        ...dataToUpdate,
        username: newUsername,
        updatedAt: serverTimestamp()
      })

      await batch.commit()

      const eventsQuery = query(collection(db, "events"), where("organizerId", "==", editingUser.id))
      const eventsSnap = await getDocs(eventsQuery)
      
      if (!eventsSnap.empty) {
        const eventBatch = writeBatch(db)
        eventsSnap.forEach((eventDoc) => {
          eventBatch.update(eventDoc.ref, {
            organizer: {
              name: editingUser.name,
              avatar: editingUser.avatar || "",
              isVerified: !!editingUser.isVerified,
              username: newUsername
            }
          })
        })
        await eventBatch.commit()
      }

      toast({ title: "Sucesso!", description: "Dados do usuário e índices de busca atualizados." })
      setIsEditModalOpen(false)
      setEditingUser(null)
    } catch (error: any) {
      const permissionError = new FirestorePermissionError({
        path: `users/${editingUser.id}`,
        operation: "update",
        requestResourceData: editingUser
      })
      errorEmitter.emit("permission-error", permissionError)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!db) return
    if (!confirm(`Tem certeza que deseja excluir o usuário @${username}? Esta ação é irreversível.`)) return

    try {
      await deleteDoc(doc(db, "users", userId))
      if (username) {
        await deleteDoc(doc(db, "usernames", username.toLowerCase().trim()))
      }
      toast({ title: "Usuário removido", description: "Os dados e o índice de nome de usuário foram excluídos." })
    } catch (error) {
       const permissionError = new FirestorePermissionError({
          path: `users/${userId}`,
          operation: "delete"
        })
        errorEmitter.emit("permission-error", permissionError)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-secondary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
        <p className="text-muted-foreground">Visualize, edite ou remova organizadores da plataforma.</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                Usuários Cadastrados
              </CardTitle>
              <CardDescription>Total de {filteredUsers.length} usuários.</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome ou @user..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[250px] font-bold">Usuário</TableHead>
                <TableHead className="font-bold">Conta</TableHead>
                <TableHead className="font-bold">Cargo</TableHead>
                <TableHead className="text-center font-bold">Status</TableHead>
                <TableHead className="text-right font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={user.avatar} className="object-cover" />
                          <AvatarFallback className="font-bold text-xs">{user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm truncate max-w-[150px]">{user.name}</span>
                          <span className="text-[10px] text-muted-foreground">@{user.username}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {user.accountType === 'Empresa' ? 'Empresa' : 'Pessoal'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'admin' ? (
                        <Badge className="bg-secondary text-white text-[10px] font-bold">Admin</Badge>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">Membro</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <div className={cn(
                          "rounded-full h-8 w-8 flex items-center justify-center",
                          !user.isVerified && "opacity-20 grayscale"
                        )}>
                          <InstagramVerifiedBadge className="w-6 h-6" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-secondary" onClick={() => handleEditClick(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Edit className="w-6 h-6 text-secondary" />
              Editar Perfil: {editingUser?.name}
            </DialogTitle>
            <DialogDescription>
              Altere as informações cadastrais. A mudança de nome de usuário atualizará automaticamente a URL de perfil do usuário.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUser} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-8">
                <div className="space-y-4 flex flex-col items-center">
                  <div className="relative group">
                    <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                      <AvatarImage src={editingUser?.avatar} alt={editingUser?.name} className="object-cover" />
                      <AvatarFallback className="text-4xl font-bold bg-muted">
                        {editingUser?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <label 
                      htmlFor="admin-avatar-upload" 
                      className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Upload className="w-6 h-6" />
                    </label>
                    <input id="admin-avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full max-w-xs space-y-2">
                      <Progress value={uploadProgress} className="h-1.5" />
                      <p className="text-[10px] text-center text-muted-foreground font-bold uppercase">Carregando: {Math.round(uploadProgress)}%</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5" /> Identidade & Acesso
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nome Completo</Label>
                      <Input 
                        id="edit-name" 
                        value={editingUser?.name || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-username">Nome de Usuário (@)</Label>
                      <div className="relative">
                        <Input 
                          id="edit-username" 
                          value={editingUser?.username || ""} 
                          maxLength={20}
                          onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                          className={cn(
                            usernameStatus === 'valid' ? 'border-green-500 pr-10' : 
                            usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive pr-10' : 'pr-10'
                          )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingUsername ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          ) : usernameStatus === 'valid' ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                            <X className="w-3.5 h-3.5 text-destructive" />
                          ) : null}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Min 5, máx 20 caracteres. Isso atualiza a coleção 'usernames'.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">E-mail</Label>
                      <Input 
                        id="edit-email" 
                        type="email"
                        value={editingUser?.email || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo no Sistema</Label>
                      <Select 
                        value={editingUser?.role || "user"} 
                        onValueChange={(val) => setEditingUser({ ...editingUser, role: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Membro (Usuário)</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Selo Verificado</Label>
                      <p className="text-xs text-muted-foreground">Exibir selo azul (estilo Instagram) no perfil e cards.</p>
                    </div>
                    <Switch 
                      checked={editingUser?.isVerified || false} 
                      onCheckedChange={(checked) => setEditingUser({ ...editingUser, isVerified: checked })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Detalhes Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      <Input 
                        type="date"
                        value={editingUser?.birthDate || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, birthDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sexo / Gênero</Label>
                      <Select 
                        value={editingUser?.gender || ""} 
                        onValueChange={(val) => setEditingUser({ ...editingUser, gender: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="feminino">Feminino</SelectItem>
                          <SelectItem value="homem trans">Homem Trans</SelectItem>
                          <SelectItem value="mulher trans">Mulher Trans</SelectItem>
                          <SelectItem value="agênero">Agênero</SelectItem>
                          <SelectItem value="prefiro não dizer">Prefiro não dizer</SelectItem>
                          <SelectItem value="empresa">Empresa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Biografia (Máx 150 caracteres)</Label>
                      <span className="text-[10px] font-bold text-muted-foreground">{(editingUser?.bio || "").length}/150</span>
                    </div>
                    <Textarea 
                      value={editingUser?.bio || ""} 
                      maxLength={150}
                      onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                      className="resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Localização & Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input 
                        value={editingUser?.city || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input 
                        value={editingUser?.state || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>País</Label>
                      <Input 
                        value={editingUser?.country || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, country: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Instagram (@)</Label>
                      <Input 
                        value={editingUser?.instagram || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, instagram: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>WhatsApp</Label>
                      <Input 
                        value={editingUser?.whatsapp || ""} 
                        onChange={(e) => setEditingUser({ ...editingUser, whatsapp: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" /> Informações de Empresa
                    </h3>
                    <Select 
                      value={editingUser?.accountType || "Usuário"} 
                      onValueChange={(val) => setEditingUser({ ...editingUser, accountType: val })}
                    >
                      <SelectTrigger className="w-[150px] h-8 text-[10px] font-bold uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Usuário">Tipo: Pessoa</SelectItem>
                        <SelectItem value="Empresa">Tipo: Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editingUser?.accountType === 'Empresa' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Razão Social</Label>
                          <Input 
                            value={editingUser?.legalName || ""} 
                            onChange={(e) => setEditingUser({ ...editingUser, legalName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CNPJ</Label>
                          <Input 
                            value={editingUser?.cnpj || ""} 
                            onChange={(e) => {
                              const numbers = e.target.value.replace(/\D/g, "");
                              let formatted = numbers;
                              if (numbers.length > 2) formatted = numbers.substring(0, 2) + "." + numbers.substring(2);
                              if (numbers.length > 5) formatted = formatted.substring(0, 6) + "." + numbers.substring(5);
                              if (numbers.length > 8) formatted = formatted.substring(0, 10) + "/" + numbers.substring(8);
                              if (numbers.length > 12) formatted = formatted.substring(0, 15) + "-" + numbers.substring(12);
                              setEditingUser({ ...editingUser, cnpj: formatted.substring(0, 18) })
                            }} 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria de Negócio</Label>
                        <Select 
                          value={editingUser?.businessCategory || ""} 
                          onValueChange={(val) => setEditingUser({ ...editingUser, businessCategory: val })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {Object.entries(BUSINESS_CATEGORIES).map(([category, items]) => (
                              <SelectGroup key={category}>
                                <SelectLabel className="bg-muted/50 py-1.5 px-3 text-[10px] font-black uppercase">{category}</SelectLabel>
                                {items.map(item => (
                                  <SelectItem key={`${category}-${item}`} value={item}>{item}</SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex gap-3">
                  <Info className="w-5 h-5 text-orange-500 shrink-0" />
                  <p className="text-[10px] text-orange-700 font-medium">
                    As métricas de desempenho (seguidores, avaliação, total de eventos e interesses) são sincronizadas automaticamente e não podem ser alteradas manualmente para preservar a integridade do sistema.
                  </p>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/20 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl font-bold">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || uploadProgress !== null || (originalUser?.username !== editingUser?.username && usernameStatus !== 'valid')} className="bg-secondary text-white font-bold rounded-xl px-8">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
