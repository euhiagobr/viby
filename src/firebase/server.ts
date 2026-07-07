import { getAdminDb } from '@/lib/firebase/admin';

/**
 * Busca os dados de uma organização pelo seu nome de usuário.
 * @param username O nome de usuário da organização.
 * @returns Os dados da organização ou null se não for encontrada.
 */
export const getOrganizationByUsername = async (username: string) => {
  const db = getAdminDb();

  const orgsCollection = db.collection('organizations');
  const snapshot = await orgsCollection
    .where('username', '==', username)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const orgDoc = snapshot.docs[0];
  const orgData = orgDoc.data();

  const organization = {
    id: orgDoc.id,
    nome: orgData.name || orgData.nome || null,
    username: orgData.username || null,
    category: orgData.category || null,
    cidade: orgData.city || orgData.cidade || null,
    estado: orgData.state || orgData.estado || null,
    slogan: orgData.slogan || null,
    bio: orgData.bio || null,
    logoUrl: orgData.avatar || orgData.logoUrl || null,
    coverUrl: orgData.banner || orgData.coverUrl || null,
    themeColor: orgData.themeColor || null,
    whatsapp: orgData.whatsapp || null,
    phone: orgData.phone || orgData.telefone || null,
    contactEmail: orgData.contactEmail || orgData.email || null,
    website: orgData.website || null,
    instagram: orgData.instagram || null,
    endereco: orgData.address || orgData.endereco || null,
    telefone: orgData.phone || orgData.telefone || null,
    socialLinks: orgData.socialLinks || {},
    preferredCurrency: orgData.preferredCurrency || 'BRL',
  };

  return JSON.parse(JSON.stringify(organization));
};

/**
 * Busca as seções e itens do cardápio de uma organização.
 * @param orgId O ID da organização.
 * @returns Um objeto com as seções e os itens do cardápio.
 */
export const getMenuByOrgId = async (orgId: string) => {
  const db = getAdminDb();

  const sectionsRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('menu_sections');

  const itemsRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('menu_items');

  const sectionsQuery = sectionsRef.orderBy('ordem', 'asc');
  const itemsQuery = itemsRef.orderBy('ordem', 'asc');

  const [sectionsSnapshot, itemsSnapshot] = await Promise.all([
    sectionsQuery.get(),
    itemsQuery.get(),
  ]);

  const sections = sectionsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  const items = itemsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return JSON.parse(JSON.stringify({ sections, items }));
};