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
  [key: string]: any;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  organizations: Organization[];
  pendingInvitations: any[];
  loading: boolean;
  userRole: string | null;
  refreshOrg: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  currentOrg: null,
  setCurrentOrg: () => {},
  organizations: [],
  pendingInvitations: [],
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
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Carrega todas as organizações onde o usuário é membro ACEITO
  useEffect(() => {
    if (!db || !user) {
      setOrganizations([]);
      setPendingInvitations([]);
      setLoading(false);
      return;
    }

    // Busca todos os membros com o UID do usuário em qualquer organização
    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(membersQuery, async (snapshot) => {
      try {
        const now = new Date();
        
        // Filtra organizações onde o acesso foi aceito
        const orgsPromises = snapshot.docs.map(async (memberDoc) => {
          const mData = memberDoc.data();
          const orgId = memberDoc.ref.parent.parent?.id;
          if (!orgId) return null;

          // Só entra na lista de gestão se o status for explicitamente 'accepted'
          // Notas: Antigamente aceitava status ausente, agora é obrigatório
          if (mData.status === 'accepted') {
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            return orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data(), _memberData: mData } as Organization : null;
          }
          return null;
        });

        // Filtra convites pendentes
        const pendingPromises = snapshot.docs.map(async (memberDoc) => {
          const mData = memberDoc.data();
          if (mData.status === 'pending') {
            // Ignorar se já expirou (24h)
            if (inviteIsExpired(mData.expiresAt)) return null;

            const orgId = memberDoc.ref.parent.parent?.id;
            if (!orgId) return null;
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            return orgSnap.exists() ? { id: orgSnap.id, orgName: orgSnap.data().name, ...mData } : null;
          }
          return null;
        });

        const orgsData = (await Promise.all(orgsPromises)).filter((o): o is Organization => o !== null);
        const pingsData = (await Promise.all(pendingPromises)).filter(p => p !== null);

        setOrganizations(orgsData);
        setPendingInvitations(pingsData);
      } catch (e) {
        console.error("Erro ao carregar organizações no provider:", e);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [db, user]);

  const inviteIsExpired = (expiresAt: any) => {
    if (!expiresAt) return false;
    const expiryDate = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
    return new Date() > expiryDate;
  };

  // Sincroniza org atual com o username na URL
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
        // Se não achou na lista pré-carregada (pode ser o owner recém criado ou cache), busca no banco
        const q = query(collection(db, 'organizations'), where('username', '==', usernameFromUrl), limit(1));
        getDocs(q).then(async (snap) => {
          if (!snap.empty) {
            const orgDoc = snap.docs[0];
            const memberRef = doc(db, 'organizations', orgDoc.id, 'members', user.uid);
            const memberSnap = await getDoc(memberRef);
            const mData = memberSnap.data();
            
            if (memberSnap.exists() && mData?.status === 'accepted') {
              setCurrentOrg({ id: orgDoc.id, ...orgDoc.data() } as Organization);
              setUserRole(mData?.role || null);
            } else {
              // Se o usuário não tem acesso aceito, não define como org atual
              if (currentOrg) setCurrentOrg(null);
              if (userRole) setUserRole(null);
            }
          }
        });
      }
    } else if (!pathname?.includes('/dashboard/organizacoes/')) {
      // Se não está em rota de org específica, tenta recuperar última ativa do localStorage
      const savedOrgId = localStorage.getItem('viby_current_org');
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
      setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Organization);
    }
  };

  const handleSetCurrentOrg = (org: Organization | null) => {
    setCurrentOrg(org);
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
      loading,
      userRole,
      refreshOrg
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useCurrentOrganization = () => useContext(OrganizationContext);