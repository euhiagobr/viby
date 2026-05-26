
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2, Lock } from "lucide-react";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface FollowButtonProps {
  organizationId: string;
  className?: string;
}

const VIBY_OFFICIAL_UID = 'd3c9fdc1-7fcc-4a70-ab99-79729fad2bf9';

export function FollowButton({ organizationId, className }: FollowButtonProps) {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [loading, setLoading] = React.useState(false);

  const followRef = React.useMemo(() => 
    (db && user && organizationId) ? doc(db, "follows", `${user.uid}_${organizationId}`) : null, 
    [db, user, organizationId]
  );
  
  const { data: followDoc, loading: followLoading } = useDoc<any>(followRef);
  const isFollowing = !!followDoc;

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!db || !user) {
      toast({ title: "Ação necessária", description: "Faça login para seguir esta marca." });
      return;
    }

    // Bloqueio de unfollow para conta oficial
    if (isFollowing && organizationId === VIBY_OFFICIAL_UID) {
      toast({ 
        variant: "destructive", 
        title: "Ação não permitida", 
        description: "Você não pode deixar de seguir a conta oficial da Viby." 
      });
      return;
    }

    setLoading(true);
    try {
      if (isFollowing) {
        await deleteDoc(followRef!);
        await updateDoc(doc(db, "organizations", organizationId), {
          followersCount: increment(-1),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Deixou de seguir" });
      } else {
        await setDoc(followRef!, {
          followerId: user.uid,
          followingId: organizationId,
          targetType: 'organization',
          timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, "organizations", organizationId), {
          followersCount: increment(1),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Seguindo!", description: "Você receberá atualizações desta marca." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na operação" });
    } finally {
      setLoading(false);
    }
  };

  if (followLoading) return <div className="w-32 h-10 animate-pulse bg-muted rounded-full" />;

  const isOfficial = organizationId === VIBY_OFFICIAL_UID;

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
      ) : isFollowing && isOfficial ? (
        <Lock className="w-4 h-4" />
      ) : (
        <Heart className={cn("w-4 h-4", isFollowing && "fill-current")} />
      )}
      {isFollowing ? (isOfficial ? "Seguindo (Oficial)" : "Seguindo") : "Seguir Marca"}
    </Button>
  );
}
