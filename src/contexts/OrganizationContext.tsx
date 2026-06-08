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
      setPendingPartnerships([]);
      setUnreadSupportCount(0);
      setUnreadNotificationsCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Ouvinte para Organizações que o usuário É DONO (Consulta Direta)
    const ownerQuery = query(collection(db, 'organizations'), where('ownerId', '==', user.uid));
    const unsubOwner = onSnapshot(ownerQuery, (ownerSnap) => {
      const ownedOrgs = ownerSnap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        _memberData: { role: 'owner', status: 'accepted' } 
      } as Organization));

      setOrganizations(prev => {
        // Preserva organizações onde o usuário é membro, mas atualiza as que ele é dono
        const memberOnlyOrgs = prev.filter(p => !ownedOrgs.some(o => o.id === p.id));
        return [...ownedOrgs, ...memberOnlyOrgs];
      });
      setLoading(false);
    });

    // 2. Ouvinte para Convites e Membros via Collection Group (Indispensável para convites)
    const membersCG = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    const unsubMembers = onSnapshot(membersCG, async (memberSnap) => {
      const acceptedPromises: Promise<Organization | null>[] = [];
      const invitations: any[] = [];

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
          // Convite Pendente de Equipe
          invitations.push({ id: orgId, ...mData, type: 'team_invite' });
        }
      }

      const memberOrgs = (await Promise.all(acceptedPromises)).filter((o): o is Organization => o !== null);
      
      // Carrega nomes das organizações para os convites pendentes
      const invitesWithNames = await Promise.all(invitations.map(async (inv) => {
        const orgSnap = await getDoc(doc(db, 'organizations', inv.id));
        return { ...inv, orgName: orgSnap.exists() ? orgSnap.data().name : "Organização Desconhecida" };
      }));

      setPendingInvitations(invitesWithNames);
      setOrganizations(prev => {
        const ownedOnes = prev.filter(o => o.ownerId === user.uid);
        const combined = [...ownedOnes];
        memberOrgs.forEach(m => {
          if (!combined.some(o => o.id === m.id)) combined.push(m);
        });
        return combined;
      });
    });

    // 3. Ouvinte para Parcerias Pendentes (Collection Group em 'partners')
    const partnersCG = query(collectionGroup(db, 'partners'), where('orgId', '==', user.uid), where('status', '==', 'pending'));
    const unsubPartners = onSnapshot(partnersCG, async (partnerSnap) => {
      const pings = await Promise.all(partnerSnap.docs.map(async (pDoc) => {
        const pData = pDoc.data();
        const eventId = pDoc.ref.parent.parent?.id;
        if (!eventId) return null;

        const eventSnap = await getDoc(doc(db, 'events', eventId));
        if (!eventSnap.exists()) return null;
        
        return { 
          id: pDoc.id, 
          ...pData, 
          eventId, 
          eventTitle: eventSnap.data().title,
          type: 'partnership'
        };
      }));
      setPendingPartnerships(pings.filter(p => p !== null));
    });

    // 4. Ouvintes de Notificações e Suporte
    const supportQuery = query(collection(db, "support_tickets"), where("userId", "==", user.uid), where("status", "==", "Respondida"));
    const unsubSupport = onSnapshot(supportQuery, (snap) => setUnreadSupportCount(snap.size));

    const notificationsQuery = query(collection(db, "notifications"), where("targetUid", "==", user.uid), where("read", "==", false));
    const unsubNotifications = onSnapshot(notificationsQuery, (snap) => setUnreadNotificationsCount(snap.size));

    return () => {
      unsubOwner();
      unsubMembers();
      unsubPartners();
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
  }, [organizations, currentOrg?.id]);

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
