
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, UserMinus, ShieldCheck } from "lucide-react";
import { useAuth, useUser, useFirestore, useDoc } from "@/firebase";
import { doc, setDoc, deleteDoc, serverTimestamp, increment, updateDoc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { processGamificationEvent } from "@/lib/gamification-service";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError, type SecurityRuleContext } from "@/firebase/errors";

interface FollowButtonProps {
  organizationId: string;
  username?: string;
  targetType?: 'user' | 'organization';
  className?: string;
}

export function FollowButton({ organizationId, username, targetType = 'organization', className }: FollowButtonProps) {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const [isToggling, setIsToggling] = React.useState(false);

  const isSelf = user?.uid === organizationId;
  const isOfficialViby = username?.toLowerCase() === 'viby';
  
  const followRef = React.useMemo(() => 
    (db && user && organizationId && !isSelf) ? doc(db, "follows", `${user.uid}_${organizationId}`) : null, 
    [db, user, organizationId, isSelf]
  );
  
  const { data: followDoc, loading: followLoading } = useDoc<any>(followRef);
  const isFollowing = !!followDoc;

  const handleToggleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!db || !user || !followRef) {
      toast({ title: "Ação necessária", description: "Faça login para acompanhar este perfil." });
      return;
    }

    if (isSelf) return;

    if (isOfficialViby && isFollowing) {
      toast({ title: "Página Oficial", description: "Você não pode deixar de seguir a Viby." });
      return;
    }

    setIsToggling(true);
    const targetColl = targetType === 'user' ? 'users' : 'organizations';
    const targetRef = doc(db, targetColl, organizationId);
    const followerUserRef = doc(db, "users", user.uid);

    if (isFollowing) {
      deleteDoc(followRef)
        .then(() => {
          updateDoc(targetRef, { followersCount: increment(-1), updatedAt: serverTimestamp() });
          updateDoc(followerUserRef, { followingCount: increment(-1), updatedAt: serverTimestamp() });
          toast({ title: "Deixou de seguir" });
        })
        .catch(async (err) => {
          const permissionError = new FirestorePermissionError({
            path: followRef.path,
            operation: 'delete'
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setIsToggling(false));
    } else {
      const followData = {
        followerId: user.uid,
        followingId: organizationId,
        targetType,
        timestamp: serverTimestamp()
      };

      setDoc(followRef, followData)
        .then(async () => {
          updateDoc(targetRef, { followersCount: increment(1), updatedAt: serverTimestamp() });
          updateDoc(followerUserRef, { followingCount: increment(1), updatedAt: serverTimestamp() });

          const targetSnap = await getDoc(targetRef);
          const targetName = targetSnap.exists() ? (targetSnap.data().name || targetSnap.data().displayName) : "Alguém";
          
          processGamificationEvent(db, user.uid, targetType === 'user' ? 'on_follow_user' : 'on_follow_org', {
            targetId: organizationId,
            orgName: targetType === 'organization' ? targetName : null,
            targetName: targetName
          }, `${user.uid}_${organizationId}`);

          toast({ title: "Seguindo!", description: `Agora você acompanha as novidades de ${targetName}.` });
        })
        .catch(async (err) => {
          const permissionError = new FirestorePermissionError({
            path: followRef.path,
            operation: 'create',
            requestResourceData: followData
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setIsToggling(false));
    }
  };

  if (isSelf || followLoading) return null;

  const isDisabled = isToggling || (isOfficialViby && isFollowing);

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
      {isToggling ? (
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
