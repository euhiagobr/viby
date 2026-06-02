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
  const { user, isInitialized } = useUser(auth);
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

    if (!isInitialized) return;

    if (!db || !user) {
      if (isMounted) {
        setOrganizations([]);
        setPendingInvitations([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    // Consulta Collection Group para encontrar todos os documentos "members" que possuam o UID do usuário
    // IMPORTANTE: Requer regra match /{path=**}/members/{memberId} no Firestore
    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(membersQuery, 
      async (snapshot) => {
        try {
          const orgsPromises = snapshot.docs.map(async (memberDoc) => {
            const mData = memberDoc.data();
            const orgId = memberDoc.ref.parent.parent?.id;
            if (!orgId) return null;

            // Filtra membros ativos
            if (mData.status === 'accepted' || !mData.status) {
              try {
                const orgSnap = await getDoc(doc(db, 'organizations', orgId));
                if (orgSnap.exists()) {
                  return { id: orgSnap.id, ...orgSnap.data(), _memberData: mData } as Organization;
                }
              } catch (e) {
                return null;
              }
            }
            return null;
          });

          const pendingPromises = snapshot.docs.map(async (memberDoc) => {
            const mData = memberDoc.data();
            if (mData.status === 'pending') {
              const orgId = memberDoc.ref.parent.parent?.id;
              if (!orgId) return null;
              try {
                const orgSnap = await getDoc(doc(db, 'organizations', orgId));
                return orgSnap.exists() ? { id: orgSnap.id, orgName: orgSnap.data().name, ...mData } : null;
              } catch (e) {
                return null;
              }
            }
            return null;
          });

          const orgsData = (await Promise.all(orgsPromises)).filter((o): o is Organization => o !== null);
          const pingsData = (await Promise.all(pendingPromises)).filter(p => p !== null);

          if (isMounted) {
            setOrganizations(orgsData);
            setPendingInvitations(pingsData);
            
            // Lógica de Seleção Inteligente: Se houver marcas e nenhuma estiver selecionada, pega a primeira (ou a última criada)
            const savedOrgId = typeof window !== 'undefined' ? localStorage.getItem('viby_current_org') : null;
            const currentActiveId = currentOrg?.id;

            if (orgsData.length > 0) {
              const toSelect = orgsData.find(o => o.id === savedOrgId) || 
                               orgsData.find(o => o.id === currentActiveId) || 
                               orgsData[0];
              
              if (toSelect && (!currentOrg || currentOrg.id !== toSelect.id)) {
                handleSetCurrentOrg(toSelect);
              } else if (currentOrg) {
                // Atualiza dados da org atual se ela ainda estiver na lista
                const updated = orgsData.find(o => o.id === currentOrg.id);
                if (updated) {
                  setUserRole(updated._memberData?.role || null);
                }
              }
            } else {
              setCurrentOrg(null);
              setUserRole(null);
            }
          }
        } catch (e) {
          console.error("Erro ao sincronizar marcas:", e);
        } finally {
          if (isMounted) setLoading(false);
        }
      },
      (error) => {
        console.error("Falha no listener de organizações:", error);
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [db, user, isInitialized]);

  // Sincroniza org atual baseada na URL para navegação direta
  useEffect(() => {
    if (!isInitialized || !db || !user || loading) return;

    const usernameFromUrl = params?.username as string;
    
    if (usernameFromUrl && usernameFromUrl !== 'new' && !pathname?.includes('/dashboard/organizacoes/new')) {
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
    setCurrentOrg(org);
    const role = org?._memberData?.role || null;
    setUserRole(role);
    
    if (org) {
      localStorage.setItem('viby_current_org', org.id);
      localStorage.setItem('viby_user_role', role || 'member');
    } else {
      localStorage.removeItem('viby_current_org');
      localStorage.removeItem('viby_user_role');
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