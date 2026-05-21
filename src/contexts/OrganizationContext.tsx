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

interface Organization {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  plan?: string;
  verified?: boolean;
}

interface OrganizationContextType {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  organizations: Organization[];
  loading: boolean;
  userRole: string | null;
}

const OrganizationContext = createContext<OrganizationContextType>({
  currentOrg: null,
  setCurrentOrg: () => {},
  organizations: [],
  loading: true,
  userRole: null,
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { user } = useUser(auth);
  const db = useFirestore();
  
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setLoading(false);
      return;
    }

    // Listener para as organizações das quais o usuário é membro
    const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(membersQuery, async (snapshot) => {
      setLoading(true);
      try {
        const orgsPromises = snapshot.docs.map(async (memberDoc) => {
          const orgId = memberDoc.ref.parent.parent?.id;
          if (!orgId) return null;
          const orgSnap = await getDoc(doc(db, 'organizations', orgId));
          return orgSnap.exists() ? { id: orgSnap.id, ...orgSnap.data() } as Organization : null;
        });

        const orgsData = (await Promise.all(orgsPromises)).filter((o): o is Organization => o !== null);
        setOrganizations(orgsData);

        // Recuperar org ativa do localStorage ou selecionar a primeira
        const savedOrgId = localStorage.getItem('viby_current_org');
        const found = orgsData.find(o => o.id === savedOrgId) || orgsData[0];
        
        if (found) {
          setCurrentOrg(found);
          // Buscar a role do usuário nesta org ativa
          const memberRef = doc(db, 'organizations', found.id, 'members', user.uid);
          const memberSnap = await getDoc(memberRef);
          setUserRole(memberSnap.exists() ? memberSnap.data().role : null);
        } else {
          setCurrentOrg(null);
          setUserRole(null);
        }
      } catch (e) {
        console.error("Erro ao carregar organizações:", e);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [db, user]);

  const handleSetCurrentOrg = async (org: Organization | null) => {
    setCurrentOrg(org);
    if (org && db && user) {
      localStorage.setItem('viby_current_org', org.id);
      const memberRef = doc(db, 'organizations', org.id, 'members', user.uid);
      const memberSnap = await getDoc(memberRef);
      setUserRole(memberSnap.exists() ? memberSnap.data().role : null);
    } else {
      localStorage.removeItem('viby_current_org');
      setUserRole(null);
    }
  };

  return (
    <OrganizationContext.Provider value={{ 
      currentOrg, 
      setCurrentOrg: handleSetCurrentOrg, 
      organizations, 
      loading,
      userRole 
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useCurrentOrganization = () => useContext(OrganizationContext);
