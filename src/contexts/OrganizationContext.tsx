'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  collectionGroup, 
  doc, 
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { useParams, usePathname } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  banner?: string;
  type?: string;
  bio?: string;
  plan?: string;
  verified?: boolean;
  createdBy?: string;
  ownerId?: string;
  _memberData?: any;
  [key: string]: any;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  organizations: Organization[];
  pendingInvitations: any[];
  pendingPartnerships: any[];
  unreadSupportCount: number;
  loading: boolean;
  userRole: string | null;
  refreshOrg: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  currentOrg: null,
  setCurrentOrg: () => {},
  organizations: [],
  pendingInvitations: [],
  pendingPartnerships: [],
  unreadSupportCount: 0,
  loading: true,
  userRole: null,
  refreshOrg: async () => {},
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user, isInitialized } = useUser(auth);
  const db = useFirestore();
  const params = useParams();
  const pathname = usePathname();
  
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [pendingPartnerships, setPendingPartnerships] = useState<any[]>([]);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const orgIdsKey = organizations.map(o => o.id).sort().join(',');

  useEffect(() => {
    if (!isInitialized || !db || !user) {
      setOrganizations([]);
      setPendingInvitations([]);
      setUnreadSupportCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ownerQuery = query(collection(db, 'organizations'), where('ownerId', '==', user.uid));
    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    
    const unsubOwner = onSnapshot(ownerQuery, async (ownerSnap) => {
      const ownedOrgs = ownerSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        _memberData: { role: 'owner', status: 'accepted' } 
      } as Organization));

      setOrganizations(prev => {
        const others = prev.filter(p => !ownedOrgs.some(o => o.id === p.id));
        const combined = [...ownedOrgs, ...others];
        updateSelection(combined);
        return combined;
      });
      setLoading(false);
    });

    const unsubMembers = onSnapshot(membersQuery, async (memberSnap) => {
      try {
        const orgsPromises = memberSnap.docs.map(async (mDoc) => {
          const mData = mDoc.data();
          const orgId = mDoc.ref.parent.parent?.id;
          if (!orgId) return null;

          if (mData.status === 'accepted' || !mData.status) {
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            if (orgSnap.exists()) {
              return { id: orgSnap.id, ...orgSnap.data(), _memberData: mData } as Organization;
            }
          }
          return null;
        });

        const pendingPromises = memberSnap.docs.map(async (mDoc) => {
          const mData = mDoc.data();
          if (mData.status === 'pending') {
            const orgId = mDoc.ref.parent.parent?.id;
            if (!orgId) return null;
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            return orgSnap.exists() ? { id: orgSnap.id, orgName: orgSnap.data().name, ...mData } : null;
          }
          return null;
        });

        const memberOrgs = (await Promise.all(orgsPromises)).filter((o): o is Organization => o !== null);
        const pingsData = (await Promise.all(pendingPromises)).filter(p => p !== null);

        setPendingInvitations(pingsData);
        setOrganizations(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          const uniqueNew = memberOrgs.filter(o => !existingIds.has(o.id));
          const combined = [...prev, ...uniqueNew];
          updateSelection(combined);
          return combined;
        });
      } catch (e) {
        console.error("Erro ao sincronizar marcas:", e);
      }
    });

    // Listener para Suporte (Badges de resposta)
    const supportQuery = query(
      collection(db, "support_tickets"), 
      where("userId", "==", user.uid),
      where("status", "==", "Respondida")
    );
    const unsubSupport = onSnapshot(supportQuery, (snap) => {
      setUnreadSupportCount(snap.size);
    });

    const updateSelection = (orgsList: Organization[]) => {
      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('viby_current_org') : null;
      const currentActiveId = currentOrg?.id;

      if (orgsList.length > 0) {
        const toSelect = orgsList.find(o => o.id === savedOrgId) || 
                         orgsList.find(o => o.id === currentActiveId) || 
                         orgsList[0];
        
        if (toSelect && (!currentOrg || currentOrg.id !== toSelect.id)) {
          handleSetCurrentOrg(toSelect);
        } else if (currentOrg) {
          const updated = orgsList.find(o => o.id === currentOrg.id);
          if (updated) {
            setUserRole(updated._memberData?.role || (updated.ownerId === user.uid ? 'owner' : null));
          }
        }
      }
    };

    return () => {
      unsubOwner();
      unsubMembers();
      unsubSupport();
    };
  }, [db, user, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !db || !user || organizations.length === 0) {
      setPendingPartnerships([]);
      return;
    }

    const orgIds = organizations.map(o => o.id);
    const slicedIds = orgIds.slice(0, 30);

    const partnersQuery = query(
      collectionGroup(db, 'partners'),
      where('orgId', 'in', slicedIds),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(partnersQuery, async (snapshot) => {
      try {
        const pings = await Promise.all(snapshot.docs.map(async (pDoc) => {
          const pData = pDoc.data();
          const eventId = pDoc.ref.parent.parent?.id;
          if (!eventId) return null;

          const eventSnap = await getDoc(doc(db, 'events', eventId));
          if (!eventSnap.exists()) return null;
          
          const eventData = eventSnap.data();
          return {
            id: pDoc.id,
            eventId,
            eventTitle: eventData.title,
            inviterOrgId: pData.inviterOrgId,
            inviterOrgName: pData.inviterOrgName || eventData.organizer?.name || "Outra Marca",
            orgId: pData.orgId,
            orgName: pData.orgName,
            status: pData.status,
            invitedAt: pData.invitedAt,
            expiresAt: pData.expiresAt
          };
        }));

        setPendingPartnerships(pings.filter(p => p !== null));
      } catch (e) {
        console.error("Erro ao processar solicitações de parceria:", e);
      }
    });

    return () => unsubscribe();
  }, [db, user, isInitialized, orgIdsKey]);

  useEffect(() => {
    if (!isInitialized || !db || !user || loading) return;
    const usernameFromUrl = params?.username as string;
    if (usernameFromUrl && usernameFromUrl !== 'new' && !pathname?.includes('/organizacoes/new')) {
      const found = organizations.find(o => o.username === usernameFromUrl);
      if (found && currentOrg?.id !== found.id) {
        handleSetCurrentOrg(found);
      }
    }
  }, [params?.username, organizations, db, user, loading, pathname, isInitialized]);

  const refreshOrg = async () => {
    if (!db || !currentOrg) return;
    const orgSnap = await getDoc(doc(db, 'organizations', currentOrg.id));
    if (orgSnap.exists()) {
      const data = { id: orgSnap.id, ...orgSnap.data() } as Organization;
      setCurrentOrg(prev => prev ? { ...prev, ...data } : data);
    }
  };

  const handleSetCurrentOrg = (org: Organization | null) => {
    if (!user && org !== null) return;

    setCurrentOrg(org);
    const role = org?._memberData?.role || (org?.ownerId === user?.uid ? 'owner' : null);
    setUserRole(role);
    if (typeof window !== 'undefined') {
      if (org) {
        localStorage.setItem('viby_current_org', org.id);
        localStorage.setItem('viby_user_role', role || 'member');
      } else {
        localStorage.removeItem('viby_current_org');
        localStorage.removeItem('viby_user_role');
      }
    }
  };

  return (
    <OrganizationContext.Provider value={{ 
      currentOrg, 
      setCurrentOrg: handleSetCurrentOrg, 
      organizations, 
      pendingInvitations,
      pendingPartnerships,
      unreadSupportCount,
      loading,
      userRole,
      refreshOrg
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useCurrentOrganization = () => useContext(OrganizationContext);