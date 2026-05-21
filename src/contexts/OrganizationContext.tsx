
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
  onSnapshot,
  limit,
  getDocs
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
  _memberData?: any;
  [key: string]: any;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  organizations: Organization[];
  pendingInvitations: any[];
  pendingPartnerships: any[];
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
  loading: true,
  userRole: null,
  refreshOrg: async () => {},
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user } = useUser(auth);
  const db = useFirestore();
  const params = useParams();
  const pathname = usePathname();
  
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [pendingPartnerships, setPendingPartnerships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Carrega todas as organizações onde o usuário é membro
  useEffect(() => {
    let isMounted = true;

    if (!db || !user) {
      if (isMounted) {
        setOrganizations([]);
        setPendingInvitations([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(membersQuery, 
      async (snapshot) => {
        try {
          const orgsPromises = snapshot.docs.map(async (memberDoc) => {
            const mData = memberDoc.data();
            const orgId = memberDoc.ref.parent.parent?.id;
            if (!orgId) return null;

            if (mData.status === 'accepted' || !mData.status) {
              const orgSnap = await getDoc(doc(db, 'organizations', orgId));
              if (orgSnap.exists()) {
                return { id: orgSnap.id, ...orgSnap.data(), _memberData: mData } as Organization;
              }
            }
            return null;
          });

          const pendingPromises = snapshot.docs.map(async (memberDoc) => {
            const mData = memberDoc.data();
            if (mData.status === 'pending') {
              const orgId = memberDoc.ref.parent.parent?.id;
              if (!orgId) return null;
              const orgSnap = await getDoc(doc(db, 'organizations', orgId));
              return orgSnap.exists() ? { id: orgSnap.id, orgName: orgSnap.data().name, ...mData } : null;
            }
            return null;
          });

          const orgsData = (await Promise.all(orgsPromises)).filter((o): o is Organization => o !== null);
          const pingsData = (await Promise.all(pendingPromises)).filter(p => p !== null);

          if (isMounted) {
            setOrganizations(orgsData);
            setPendingInvitations(pingsData);
            
            if (currentOrg) {
              const updatedActive = orgsData.find(o => o.id === currentOrg.id);
              if (updatedActive) {
                setUserRole(updatedActive._memberData?.role || null);
              }
            }
          }
        } catch (e) {
          console.error("Erro ao processar dados de membros:", e);
        } finally {
          if (isMounted) setLoading(false);
        }
      },
      (error) => {
        console.error("Erro no listener de organizações:", error);
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [db, user]);

  // Sincroniza convites de PARCERIA (Co-organização)
  useEffect(() => {
    if (!db || organizations.length === 0) {
      setPendingPartnerships([]);
      return;
    }

    const orgIds = organizations.map(o => o.id);
    // Para protótipo, removemos filtros que exigem índices compostos em collectionGroups para evitar crashes
    // Filtramos o status pendente em memória
    try {
      const partnersQuery = query(collectionGroup(db, 'partners'));

      const unsubscribe = onSnapshot(partnersQuery, (snapshot) => {
        const pData = snapshot.docs
          .map(d => ({
            id: d.id,
            eventId: d.ref.parent.parent?.id,
            ...d.data()
          }))
          .filter((p: any) => p.status === 'pending' && orgIds.includes(p.orgId));
        
        setPendingPartnerships(pData);
      }, (error) => {
        console.warn("Aguardando criação de índice de collectionGroup para 'partners'...", error.message);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Erro ao iniciar listener de parcerias:", e);
    }
  }, [db, organizations]);

  // Sincroniza org atual baseada na URL ou memória
  useEffect(() => {
    if (!db || !user || loading) return;

    const usernameFromUrl = params?.username as string;
    
    if (usernameFromUrl && usernameFromUrl !== 'new' && !pathname?.includes('/dashboard/organizacoes/new')) {
      const found = organizations.find(o => o.username === usernameFromUrl);
      if (found) {
        if (currentOrg?.id !== found.id) {
          setCurrentOrg(found);
          setUserRole(found._memberData?.role || null);
        }
      } else {
        const q = query(collection(db, 'organizations'), where('username', '==', usernameFromUrl), limit(1));
        getDocs(q).then(async (snap) => {
          if (!snap.empty) {
            const orgDoc = snap.docs[0];
            const memberRef = doc(db, 'organizations', orgDoc.id, 'members', user.uid);
            const memberSnap = await getDoc(memberRef);
            const mData = memberSnap.data();
            
            if (memberSnap.exists() && (mData?.status === 'accepted' || !mData?.status)) {
              const orgData = { id: orgDoc.id, ...orgDoc.data(), _memberData: mData } as Organization;
              setCurrentOrg(orgData);
              setUserRole(mData?.role || null);
            }
          }
        });
      }
    } else {
      const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('viby_current_org') : null;
      const found = organizations.find(o => o.id === savedOrgId) || organizations[0];
      if (found && currentOrg?.id !== found.id) {
        setCurrentOrg(found);
        setUserRole(found._memberData?.role || null);
      }
    }
  }, [params?.username, organizations, db, user, loading, pathname]);

  const refreshOrg = async () => {
    if (!db || !currentOrg) return;
    const orgSnap = await getDoc(doc(db, 'organizations', currentOrg.id));
    if (orgSnap.exists()) {
      setCurrentOrg(prev => prev ? { ...prev, ...orgSnap.data() } : null);
    }
  };

  const handleSetCurrentOrg = (org: Organization | null) => {
    setCurrentOrg(org);
    setUserRole(org?._memberData?.role || null);
    if (org) {
      localStorage.setItem('viby_current_org', org.id);
    } else {
      localStorage.removeItem('viby_current_org');
    }
  };

  return (
    <OrganizationContext.Provider value={{ 
      currentOrg, 
      setCurrentOrg: handleSetCurrentOrg, 
      organizations, 
      pendingInvitations,
      pendingPartnerships,
      loading,
      userRole,
      refreshOrg
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useCurrentOrganization = () => useContext(OrganizationContext);
