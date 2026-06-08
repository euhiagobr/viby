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
  unreadNotificationsCount: number;
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
  unreadNotificationsCount: 0,
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
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized || !db || !user) {
      setOrganizations([]);
      setPendingInvitations([]);
      setUnreadSupportCount(0);
      setUnreadNotificationsCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Ouvinte para Organizações que o usuário É DONO
    const ownerQuery = query(collection(db, 'organizations'), where('ownerId', '==', user.uid));
    const unsubOwner = onSnapshot(ownerQuery, (ownerSnap) => {
      const ownedOrgs = ownerSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        _memberData: { role: 'owner', status: 'accepted' } 
      } as Organization));

      setOrganizations(prev => {
        const others = prev.filter(p => !ownedOrgs.some(o => o.id === p.id));
        const combined = [...ownedOrgs, ...others];
        return combined;
      });
      setLoading(false);
    });

    // 2. Ouvinte para Convites e Membros via Collection Group
    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    const unsubMembers = onSnapshot(membersQuery, async (memberSnap) => {
      try {
        const acceptedPromises: Promise<Organization | null>[] = [];
        const pendingInvites: any[] = [];

        for (const mDoc of memberSnap.docs) {
          const mData = mDoc.data();
          const orgId = mDoc.ref.parent.parent?.id;
          
          if (!orgId) continue;

          if (mData.status === 'accepted' || !mData.status) {
            acceptedPromises.push(
              getDoc(doc(db, 'organizations', orgId)).then(snap => 
                snap.exists() ? { id: snap.id, ...snap.data(), _memberData: mData } as Organization : null
              )
            );
          } else if (mData.status === 'pending') {
            pendingInvites.push(
              getDoc(doc(db, 'organizations', orgId)).then(snap => 
                snap.exists() ? { id: snap.id, orgName: snap.data().name, ...mData } : null
              )
            );
          }
        }

        const memberOrgs = (await Promise.all(acceptedPromises)).filter((o): o is Organization => o !== null);
        const pingsData = (await Promise.all(pendingInvites)).filter(p => p !== null);

        setPendingInvitations(pingsData);
        setOrganizations(prev => {
          // Merge inteligente: mantém ownedOrgs e adiciona memberOrgs, evitando duplicatas
          const combined = [...prev];
          memberOrgs.forEach(m => {
            const idx = combined.findIndex(o => o.id === m.id);
            if (idx === -1) combined.push(m);
            else combined[idx] = { ...combined[idx], ...m };
          });
          return combined;
        });
      } catch (e) {
        console.error("Context Sync Error:", e);
      }
    });

    // 3. Ouvintes de Notificações e Suporte
    const supportQuery = query(collection(db, "support_tickets"), where("userId", "==", user.uid), where("status", "==", "Respondida"));
    const unsubSupport = onSnapshot(supportQuery, (snap) => setUnreadSupportCount(snap.size));

    const notificationsQuery = query(collection(db, "notifications"), where("targetUid", "==", user.uid), where("read", "==", false));
    const unsubNotifications = onSnapshot(notificationsQuery, (snap) => setUnreadNotificationsCount(snap.size));

    return () => {
      unsubOwner();
      unsubMembers();
      unsubSupport();
      unsubNotifications();
    };
  }, [db, user, isInitialized]);

  // Sincronização da Organização Selecionada
  useEffect(() => {
    if (organizations.length > 0) {
      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('viby_current_org') : null;
      const toSelect = organizations.find(o => o.id === savedOrgId) || 
                       organizations.find(o => o.id === currentOrg?.id) || 
                       organizations[0];
      
      if (toSelect && (!currentOrg || currentOrg.id !== toSelect.id)) {
        handleSetCurrentOrg(toSelect);
      }
    }
  }, [organizations.length, organizations]);

  const handleSetCurrentOrg = (org: Organization | null) => {
    setCurrentOrg(org);
    const role = org?._memberData?.role || (org?.ownerId === user?.uid ? 'owner' : null);
    setUserRole(role);
    if (typeof window !== 'undefined' && org) {
      localStorage.setItem('viby_current_org', org.id);
      localStorage.setItem('viby_user_role', role || 'member');
    }
  };

  const refreshOrg = async () => {
    if (!db || !currentOrg) return;
    const orgSnap = await getDoc(doc(db, 'organizations', currentOrg.id));
    if (orgSnap.exists()) {
      const data = { id: orgSnap.id, ...orgSnap.data() } as Organization;
      setCurrentOrg(prev => prev ? { ...prev, ...data } : data);
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
      unreadNotificationsCount,
      loading,
      userRole,
      refreshOrg
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useCurrentOrganization = () => useContext(OrganizationContext);