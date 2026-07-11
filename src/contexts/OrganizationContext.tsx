
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
import { useParams } from 'next/navigation';

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
  
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [pendingPartnerships, setPendingPartnerships] = useState<any[]>([]);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const orgUsernameInUrl = params?.username as string;

  // Função para mudar a organização com persistência
  const setCurrentOrg = useCallback((org: Organization | null) => {
    if (!org) {
      setCurrentOrgState(null);
      if (typeof window !== 'undefined') localStorage.removeItem('viby_current_org');
      return;
    }

    setCurrentOrgState(org);
    if (typeof window !== 'undefined') {
      localStorage.setItem('viby_current_org', org.id);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized || !db || !user) {
      if (isInitialized) setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Organizações que o usuário é dono
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

    // 2. Convites e Parcerias via Collection Group
    const membersCG = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    const unsubMembers = onSnapshot(membersCG, async (memberSnap) => {
      const invites: any[] = [];
      const acceptedPromises: Promise<Organization | null>[] = [];

      for (const mDoc of memberSnap.docs) {
        const mData = mDoc.data();
        const orgId = mDoc.ref.parent.parent?.id;
        
        if (!orgId) continue;

        if (mData.status === 'pending') {
          invites.push({ id: orgId, ...mData, type: 'team_invite' });
        } else if (mData.status === 'accepted' || !mData.status) {
          acceptedPromises.push(
            getDoc(doc(db, 'organizations', orgId)).then(snap => 
              snap.exists() ? { id: snap.id, ...snap.data(), _memberData: mData } as Organization : null
            )
          );
        }
      }

      const invitesWithNames = await Promise.all(invites.map(async (inv) => {
        const orgSnap = await getDoc(doc(db, 'organizations', inv.id));
        return { ...inv, orgName: orgSnap.exists() ? orgSnap.data().name : "Organização Desconhecida" };
      }));

      setPendingInvitations(invitesWithNames);

      const memberOrgs = (await Promise.all(acceptedPromises)).filter((o): o is Organization => o !== null);
      
      setOrganizations(prev => {
        const ownedOnes = prev.filter(o => o.ownerId === user.uid);
        const combined = [...ownedOnes];
        memberOrgs.forEach(m => {
          if (!combined.some(o => o.id === m.id)) combined.push(m);
        });
        return combined;
      });
    });

    // 3. Parcerias de Eventos
    let unsubPartners: (() => void) | undefined;
    if (currentOrg?.id) {
      const partnersCG = query(collectionGroup(db, 'partners'), where('orgId', '==', currentOrg.id), where('status', '==', 'pending'));
      unsubPartners = onSnapshot(partnersCG, async (partnerSnap) => {
        const pInvites = await Promise.all(partnerSnap.docs.map(async (pDoc) => {
          const pData = pDoc.data();
          const eventId = pDoc.ref.parent.parent?.id;
          if (!eventId) return null;

          const eventSnap = await getDoc(doc(db, 'events', eventId));
          return { 
            id: pDoc.id, 
            ...pData, 
            eventId, 
            eventTitle: eventSnap.exists() ? eventSnap.data().title : "Evento Desconhecido",
            type: 'partnership'
          };
        }));
        setPendingPartnerships(pInvites.filter(p => p !== null));
      });
    } else {
      setPendingPartnerships([]);
    }

    const unsubSupport = onSnapshot(query(collection(db, "support_tickets"), where("userId", "==", user.uid), where("status", "==", "Respondida")), (snap) => setUnreadSupportCount(snap.size));
    const unsubNotifications = onSnapshot(query(collection(db, "notifications"), where("targetUid", "==", user.uid), where("read", "==", false)), (snap) => setUnreadNotificationsCount(snap.size));

    return () => {
      unsubOwner();
      unsubMembers();
      if (unsubPartners) unsubPartners();
      unsubSupport();
      unsubNotifications();
    };
  }, [db, user, isInitialized, currentOrg?.id]);

  // Efeito para sincronizar context com a URL [username]
  // AGORA: Só sincroniza se for realmente diferente, para evitar loops
  useEffect(() => {
    if (orgUsernameInUrl && organizations.length > 0) {
      const matched = organizations.find(o => o.username === orgUsernameInUrl);
      if (matched && matched.id !== currentOrg?.id) {
        setCurrentOrgState(matched);
      }
    }
  }, [orgUsernameInUrl, organizations, currentOrg?.id]);

  // Efeito para auto-seleção inicial baseada em localStorage
  useEffect(() => {
    if (organizations.length > 0 && !currentOrg && !loading && !orgUsernameInUrl) {
      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('viby_current_org') : null;
      const toSelect = organizations.find(o => o.id === savedOrgId) || organizations[0];
      
      if (toSelect) {
        setCurrentOrgState(toSelect);
      }
    }
  }, [organizations, currentOrg, loading, orgUsernameInUrl]);

  // Efeito para atualizar o Cargo (Role) sempre que a organização mudar
  useEffect(() => {
    if (currentOrg) {
      const role = currentOrg._memberData?.role || (currentOrg.ownerId === user?.uid ? 'owner' : null);
      setUserRole(role);
    } else {
      setUserRole(null);
    }
  }, [currentOrg, user?.uid]);

  const refreshOrg = async () => {
    if (!db || !currentOrg) return;
    const orgSnap = await getDoc(doc(db, 'organizations', currentOrg.id));
    if (orgSnap.exists()) {
      const data = orgSnap.data();
      const updated = { id: orgSnap.id, ...data } as Organization;
      const existing = organizations.find(o => o.id === orgSnap.id);
      if (existing?._memberData) {
        updated._memberData = existing._memberData;
      }
      setCurrentOrgState(updated);
    }
  };

  return (
    <OrganizationContext.Provider value={{ 
      currentOrg, 
      setCurrentOrg, 
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
