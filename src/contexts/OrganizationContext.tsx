'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  collectionGroup, 
  getDocs, 
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
  [key: string]: any;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  organizations: Organization[];
  loading: boolean;
  userRole: string | null;
  refreshOrg: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  currentOrg: null,
  setCurrentOrg: () => {},
  organizations: [],
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
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Efeito para carregar todas as orgs do usuário
  useEffect(() => {
    if (!db || !user) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(membersQuery, async (snapshot) => {
      try {
        const orgsPromises = snapshot.docs.map(async (memberDoc) => {
          const orgId = memberDoc.ref.parent.parent?.id;
          if (!orgId) return null;
          const orgSnap = await getDoc(doc(db, 'organizations', orgId));
          return orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data() } as Organization : null;
        });

        const orgsData = (await Promise.all(orgsPromises)).filter((o): o is Organization => o !== null);
        setOrganizations(orgsData);
      } catch (e) {
        console.error("Erro ao carregar organizações:", e);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [db, user]);

  // Efeito para sincronizar org atual com a URL [id]
  useEffect(() => {
    if (!db || !user || loading) return;

    const orgIdFromUrl = params?.id as string;
    
    if (orgIdFromUrl && orgIdFromUrl !== 'new') {
      const found = organizations.find(o => o.id === orgIdFromUrl);
      if (found) {
        if (currentOrg?.id !== found.id) {
          setCurrentOrg(found);
          const memberRef = doc(db, 'organizations', found.id, 'members', user.uid);
          getDoc(memberRef).then(snap => {
            setUserRole(snap.exists() ? snap.data().role : null);
          });
        }
      } else {
        // Se não achou na lista (ex: acesso direto via URL), tenta carregar
        getDoc(doc(db, 'organizations', orgIdFromUrl)).then(async (orgSnap) => {
          if (orgSnap.exists()) {
            const orgData = { id: orgSnap.id, ...orgSnap.data() } as Organization;
            const memberRef = doc(db, 'organizations', orgIdFromUrl, 'members', user.uid);
            const memberSnap = await getDoc(memberRef);
            
            if (memberSnap.exists()) {
              setCurrentOrg(orgData);
              setUserRole(memberSnap.data().role);
            } else {
              setCurrentOrg(null);
              setUserRole(null);
            }
          }
        });
      }
    } else if (!pathname?.includes('/dashboard/organizations/')) {
      // Se saiu da área de gestão, mantém a org salva no localstorage ou a primeira
      const savedOrgId = localStorage.getItem('viby_current_org');
      const found = organizations.find(o => o.id === savedOrgId) || organizations[0];
      if (found && currentOrg?.id !== found.id) {
        setCurrentOrg(found);
        const memberRef = doc(db, 'organizations', found.id, 'members', user.uid);
        getDoc(memberRef).then(snap => {
          setUserRole(snap.exists() ? snap.data().role : null);
        });
      }
    }
  }, [params?.id, organizations, db, user, loading, pathname]);

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
      loading,
      userRole,
      refreshOrg
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useCurrentOrganization = () => useContext(OrganizationContext);
