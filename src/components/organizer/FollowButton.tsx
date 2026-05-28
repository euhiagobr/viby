
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, UserPlus, UserMinus } from "lucide-react";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { processGamificationEvent } from "@/lib/gamification-service";

interface FollowButtonProps {
  organizationId: string;
  targetType?: 'user' | 'organization';
  className?: string;
}

/**
 * Componente unificado para seguir Usuários e Organizações com integridade total.
 */
export function FollowButton({ organizationId, targetType = 'organization', className }: FollowButtonProps) {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [loading, setLoading] = React.useState(false);

  // Prevenir seguir a si mesmo
  const isSelf = user?.uid === organizationId;
  
  const followRef = React.useMemo(() => 
    (db && user && organizationId && !isSelf) ? doc(db, "follows", `${user.uid}_${organizationId}`) : null, 
    [db, user, organizationId, isSelf]
  );
  
  const { data: followDoc, loading: followLoading } = useDoc<any>(followRef);
  const isFollowing = !!followDoc;

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!db || !user) {
      toast({ title: "Ação necessária", description: "Faça login para acompanhar este perfil." });
      return;
    }

    if (isSelf) return;

    setLoading(true);
    try {
      const targetColl = targetType === 'user' ? 'users' : 'organizations';
      const targetRef = doc(db, targetColl, organizationId);
      const followerUserRef = doc(db, "users", user.uid);

      if (isFollowing) {
        // Unfollow
        await deleteDoc(followRef!);
        
        // Atualiza contadores em ambos os lados
        await updateDoc(targetRef, { followersCount: increment(-1), updatedAt: serverTimestamp() });
        await updateDoc(followerUserRef, { followingCount: increment(-1), updatedAt: serverTimestamp() });
        
        toast({ title: "Deixou de seguir" });
      } else {
        // Follow
        await setDoc(followRef!, {
          followerId: user.uid,
          followingId: organizationId,
          targetType,
          timestamp: serverTimestamp()
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
      toast({ variant: "destructive", title: "Erro na operação", description: "Tente novamente em alguns instantes." });
    } finally {
      setLoading(false);
    }
  };

  if (isSelf || followLoading) return null;

  return (
    <Button
      onClick={handleToggleFollow}
      disabled={loading}
      className={cn(
        "rounded-full px-8 h-12 font-black uppercase italic transition-all active:scale-95 gap-2 shadow-xl",
        isFollowing 
          ? "bg-white text-primary border-2 border-primary hover:bg-muted" 
          : "bg-secondary text-white shadow-secondary/20",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <UserMinus className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {isFollowing ? "Seguindo" : "Seguir"}
    </Button>
  );
}
