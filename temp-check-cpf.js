const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length === 0) {
  console.error('Erro: FIREBASE_SERVICE_ACCOUNT não encontrada');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  try {
    const snap = await db.collection('users').limit(10).get();
    console.log(`Total de usuários em /users: ${snap.size}`);
    
    snap.docs.forEach((doc, i) => {
      const data = doc.data();
      const cpf = data.cpf || 'N/A';
      const hash = data.cpfHash ? data.cpfHash.substring(0, 20) : 'N/A';
      console.log(`${i+1}. CPF: ${cpf}, hash prefix: ${hash}...`);
    });
    
    process.exit(0);
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
