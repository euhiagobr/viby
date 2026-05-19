"use client"

import * as React from "react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore"
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
  ExternalLink, 
  Building2, 
  User as UserIcon,
  MapPin,
  Trash2
} from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { cn } from "@/lib/utils"

function InstagramVerifiedBadge({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M22.5 12.5C22.5 18.0228 18.0228 22.5 12.5 22.5C6.97715 22.5 2.5 18.0228 2.5 12.5C2.5 6.97715 6.97715 2.5 12.5 2.5C18.0228 2.5 22.5 6.97715 22.5 12.5Z" 
        fill="#0095F6"
      />
      <path 
        d="M10 14.5L7.5 12L6.5 13L10 16.5L17.5 9L16.5 8L10 14.5Z" 
        fill="white" 
        stroke="white" 
        strokeWidth="0.5"
      />
    </svg>
  )
}

export default function AdminUsuariosPage() {
  const db = useFirestore()
  const [search, setSearch] = React.useState("")

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

  const handleToggleVerify = async (userId: string, currentStatus: boolean) => {
    if (!db) return

    const userRef = doc(db, "users", userId)
    const newStatus = !currentStatus

    updateDoc(userRef, { isVerified: newStatus })
      .then(() => {
        toast({ 
          title: newStatus ? "Usuário Verificado" : "Verificação Removida",
          description: `O status de verificação foi atualizado.`
        })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: `users/${userId}`,
          operation: "update",
          requestResourceData: { isVerified: newStatus }
        })
        errorEmitter.emit("permission-error", permissionError)
      })
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!db) return
    if (!confirm(`Tem certeza que deseja excluir o usuário @${username}? Esta ação é irreversível.`)) return

    try {
      await deleteDoc(doc(db, "users", userId))
      if (username) {
        await deleteDoc(doc(db, "usernames", username.toLowerCase()))
      }
      toast({ title: "Usuário removido", description: "Os dados do Firestore foram excluídos." })
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
        <p className="text-muted-foreground">Visualize, verifique ou remova organizadores da plataforma.</p>
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
                          <AvatarImage src={user.avatar} />
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                          "rounded-full h-8 w-8",
                          !user.isVerified && "opacity-20 grayscale"
                        )}
                        onClick={() => handleToggleVerify(user.id, !!user.isVerified)}
                      >
                        <InstagramVerifiedBadge className="w-6 h-6" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold px-3">
                          <Link href={`/${user.username}`} target="_blank">Perfil</Link>
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
    </div>
  )
}
