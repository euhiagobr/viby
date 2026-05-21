'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, collectionGroup, getDocs, doc, getDoc } from 'firebase/firestore';

interface Organization {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  plan?: string;
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

    const fetchUserOrgs = async () => {
      setLoading(true);
      try {
        // Busca onde o usuário é membro em qualquer organização
        // Usando collectionGroup para encontrar todas as associações de membros
        const membersQuery = query(collectionGroup(db, 'members'), where('userId', '==', user.uid));
        const membersSnap = await getDocs(membersQuery);
        
        const orgsData: Organization[] = [];
        
        for (const memberDoc of membersSnap.docs) {
          const orgId = memberDoc.ref.parent.parent?.id;
          if (orgId) {
            const orgSnap = await getDoc(doc(db, 'organizations', orgId));
            if (orgSnap.exists()) {
              orgsData.push({ id: orgSnap.id, ...orgSnap.data() } as Organization);
            }
          }
        }

        setOrganizations(orgsData);
        
        // Mantém a última selecionada ou a primeira da lista
        const savedOrgId = localStorage.getItem('viby_current_org');
        const found = orgsData.find(o => o.id === savedOrgId) || orgsData[0];
        
        if (found) {
          setCurrentOrg(found);
          // Busca o cargo do usuário nesta org
          const memberRef = doc(db, 'organizations', found.id, 'members', user.uid);
          const memberSnap = await getDoc(memberRef);
          setUserRole(memberSnap.exists() ? memberSnap.data().role : null);
        }
      } catch (e) {
        console.error("Erro ao carregar organizações:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUserOrgs();
  }, [db, user]);

  const handleSetCurrentOrg = (org: Organization | null) => {
    setCurrentOrg(org);
    if (org) {
      localStorage.setItem('viby_current_org', org.id);
      // Atualiza role
      if (db && user) {
        getDoc(doc(db, 'organizations', org.id, 'members', user.uid)).then(snap => {
          setUserRole(snap.exists() ? snap.data().role : null);
        });
      }
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