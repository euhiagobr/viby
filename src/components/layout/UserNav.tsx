"use client"

import * as React from "react"
import { useAuth, useUser, useFirestore } from "@/firebase"
import { doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LayoutGrid, User, LogOut } from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"

export function UserNav() {
  const auth = useAuth()
  const { user } = useUser(auth)
  const db = useFirestore()
  const router = useRouter()
  const [profile, setProfile] = React.useState<any>(null)

  React.useEffect(() => {
    if (db && user) {
      getDoc(doc(db, "users", user.uid)).then(snap => {
        if (snap.exists()) setProfile(snap.data())
      })
    }
  }, [db, user])

  const handleLogout = async () => {
    if (!auth) return
    try {
      await signOut(auth)
      toast({ title: "Até logo!", description: "Você saiu da sua conta." })
      router.push("/")
      router.refresh()
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao sair" })
    }
  }

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-secondary/20 p-0 hover:bg-transparent focus-visible:ring-secondary">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar || user.photoURL || ""} alt={user.displayName || ""} />
            <AvatarFallback className="font-bold text-xs uppercase bg-muted">
              {profile?.name?.charAt(0) || user.displayName?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-2xl" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-black uppercase italic tracking-tight">{profile?.name || user.displayName || "Usuário"}</p>
            <p className="text-[10px] font-medium text-muted-foreground leading-none">@{profile?.username || "vibyuser"}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="focus:bg-secondary/10 cursor-pointer rounded-lg mx-1 my-0.5">
          <Link href="/dashboard" className="flex w-full items-center gap-2 py-2">
            <LayoutGrid className="h-4 w-4 text-secondary" />
            <span className="font-bold text-xs uppercase tracking-widest">Meu Painel</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="focus:bg-secondary/10 cursor-pointer rounded-lg mx-1 my-0.5">
          <Link href={`/${profile?.username || ""}`} className="flex w-full items-center gap-2 py-2">
            <User className="h-4 w-4 text-secondary" />
            <span className="font-bold text-xs uppercase tracking-widest">Meu Perfil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="focus:bg-destructive/10 text-destructive cursor-pointer rounded-lg mx-1 my-0.5">
          <div className="flex w-full items-center gap-2 py-2">
            <LogOut className="h-4 w-4" />
            <span className="font-bold text-xs uppercase tracking-widest">Sair</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
