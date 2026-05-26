
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface FollowButtonProps {
  organizationId: string;
  className?: string;
}

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

    setLoading(true);
    try {
      if (isFollowing) {
        await deleteDoc(followRef!);
        await updateDoc(doc(db, "organizations", organizationId), {
          followersCount: increment(-1)
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
          followersCount: increment(1)
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
      ) : (
        <Heart className={cn("w-4 h-4", isFollowing && "fill-current")} />
      )}
      {isFollowing ? "Seguindo" : "Seguir Marca"}
    </Button>
  );
}
