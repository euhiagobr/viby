
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, UserPlus, UserMinus, ShieldCheck } from "lucide-react";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { processGamificationEvent } from "@/lib/gamification-service";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

interface FollowButtonProps {
  organizationId: string;
  username?: string;
  targetType?: 'user' | 'organization';
  className?: string;
}

/**
 * Componente unificado para seguir Usuários e Organizações.
 * Bloqueia o unfollow para o perfil oficial 'viby'.
 */
export function FollowButton({ organizationId, username, targetType = 'organization', className }: FollowButtonProps) {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [loading, setLoading] = React.useState(false);

  // Prevenir seguir a si mesmo
  const isSelf = user?.uid === organizationId;
  
  // Regra de Negócio: Página oficial 'viby' é seguimento obrigatório
  const isOfficialViby = username?.toLowerCase() === 'viby';
  
  const followRef = React.useMemo(() => 
    (db && user && organizationId && !isSelf) ? doc(db, "follows", `${user.uid}_${organizationId}`) : null, 
    [db, user, organizationId, isSelf]
  );
  
  const { data: followDoc, loading: followLoading } = useDoc<any>(followRef);
  const isFollowing = !!followDoc;

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!db || !user || !followRef) {
      toast({ title: "Ação necessária", description: "Faça login para acompanhar este perfil." });
      return;
    }

    if (isSelf) return;

    // Trava de Unfollow para @viby
    if (isOfficialViby && isFollowing) {
      toast({ title: "Página Oficial", description: "Você não pode deixar de seguir a Viby." });
      return;
    }

    setLoading(true);
    try {
      const targetColl = targetType === 'user' ? 'users' : 'organizations';
      const targetRef = doc(db, targetColl, organizationId);
      const followerUserRef = doc(db, "users", user.uid);

      if (isFollowing) {
        // Unfollow
        await deleteDoc(followRef).catch(async (err) => {
          if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: followRef.path,
              operation: 'delete'
            }));
          }
          throw err;
        });
        
        // Atualiza contadores em ambos os lados
        await updateDoc(targetRef, { followersCount: increment(-1), updatedAt: serverTimestamp() });
        await updateDoc(followerUserRef, { followingCount: increment(-1), updatedAt: serverTimestamp() });
        
        toast({ title: "Deixou de seguir" });
      } else {
        // Follow
        const followData = {
          followerId: user.uid,
          followingId: organizationId,
          targetType,
          timestamp: serverTimestamp()
        };

        await setDoc(followRef, followData).catch(async (err) => {
          if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: followRef.path,
              operation: 'create',
              requestResourceData: followData
            }));
          }
          throw err;
        });
        
        await updateDoc(targetRef, { followersCount: increment(1), updatedAt: serverTimestamp() });
        await updateDoc(followerUserRef, { followingCount: increment(1), updatedAt: serverTimestamp() });

        // Gamificação
        const targetSnap = await getDoc(targetRef);
        const targetName = targetSnap.exists() ? (targetSnap.data().name || targetSnap.data().displayName) : "Alguém";
        
        await processGamificationEvent(db, user.uid, targetType === 'user' ? 'on_follow_user' : 'on_follow_org', {
          targetId: organizationId,
          orgName: targetType === 'organization' ? targetName : null,
          targetName: targetName
        }, `${user.uid}_${organizationId}`);

        toast({ title: "Seguindo!", description: `Agora você acompanha as novidades de ${targetName}.` });
      }
    } catch (e) {
      console.error("[Follow Error]", e);
      // O erro já foi emitido para o FirebaseErrorListener se for permissão
    } finally {
      setLoading(false);
    }
  };

  if (isSelf || followLoading) return null;

  // Se for seguimento obrigatório, desabilitamos a interatividade mas mantemos o estilo de "Seguindo"
  const isDisabled = loading || (isOfficialViby && isFollowing);

  return (
    <Button
      onClick={handleToggleFollow}
      disabled={isDisabled}
      className={cn(
        "rounded-full px-8 h-12 font-black uppercase italic transition-all active:scale-95 gap-2 shadow-xl",
        isFollowing 
          ? "bg-white text-primary border-2 border-primary hover:bg-muted" 
          : "bg-secondary text-white shadow-secondary/20",
        isOfficialViby && isFollowing && "opacity-80 cursor-default",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        isOfficialViby ? <ShieldCheck className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {isFollowing ? (isOfficialViby ? "Membro Viby" : "Seguindo") : "Seguir"}
    </Button>
  );
}
