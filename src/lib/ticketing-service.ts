
import { 
  Firestore, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp, 
  collection, 
  writeBatch 
} from "firebase/firestore";

export async function reserveSeat(
  db: Firestore, 
  eventoId: string, 
  setorId: string, 
  assentoId: string, 
  userId: string
) {
  const assentoRef = doc(db, "events", eventoId, "setores", setorId, "assentos", assentoId);

  return runTransaction(db, async (transaction) => {
    const assentoSnap = await transaction.get(assentoRef);
    if (!assentoSnap.exists()) throw new Error("Assento não encontrado.");

    const data = assentoSnap.data();
    const now = new Date();

    if (data.status === 'vendido') throw new Error("Assento já vendido.");
    if (data.status === 'bloqueado') throw new Error("Assento bloqueado.");
    
    if (data.status === 'reservado') {
      const expiration = data.reservadoAte?.toDate ? data.reservadoAte.toDate() : new Date(data.reservadoAte);
      if (now < expiration && data.reservadoPor !== userId) {
        throw new Error("Assento reservado por outro usuário.");
      }
    }

    const reservadoAte = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutos

    transaction.update(assentoRef, {
      status: 'reservado',
      reservadoPor: userId,
      reservadoAte: Timestamp.fromDate(reservadoAte),
      updatedAt: serverTimestamp()
    });
  });
}

export async function releaseSeat(
  db: Firestore, 
  eventoId: string, 
  setorId: string, 
  assentoId: string, 
  userId: string
) {
  const assentoRef = doc(db, "events", eventoId, "setores", setorId, "assentos", assentoId);

  return runTransaction(db, async (transaction) => {
    const assentoSnap = await transaction.get(assentoRef);
    if (!assentoSnap.exists()) return;

    const data = assentoSnap.data();
    if (data.status === 'reservado' && data.reservadoPor === userId) {
      transaction.update(assentoRef, {
        status: 'disponivel',
        reservadoPor: null,
        reservadoAte: null,
        updatedAt: serverTimestamp()
      });
    }
  });
}

export async function generateMapData(
  db: Firestore, 
  eventoId: string, 
  setorId: string, 
  sectorData: any
) {
  const batch = writeBatch(db);
  const assentosRef = collection(db, "events", eventoId, "setores", setorId, "assentos");

  if (sectorData.tipo === 'assentos') {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let f = 0; f < (sectorData.fileiras || 0); f++) {
      const fileiraChar = alphabet[f] || `F${f + 1}`;
      for (let n = 1; n <= (sectorData.assentosPorFileira || 0); n++) {
        const codigo = `${fileiraChar}${n.toString().padStart(2, '0')}`;
        const newRef = doc(assentosRef);
        batch.set(newRef, {
          codigo,
          fileira: fileiraChar,
          numero: n,
          status: 'disponivel',
          setorId,
          eventoId,
          createdAt: serverTimestamp()
        });
      }
    }
  } else if (sectorData.tipo === 'mesas') {
    for (let m = 1; m <= (sectorData.quantidadeMesas || 0); m++) {
      const codigo = `M${m}`;
      const newRef = doc(assentosRef);
      batch.set(newRef, {
        codigo,
        numero: m,
        lugares: sectorData.lugaresPorMesa,
        status: 'disponivel',
        setorId,
        eventoId,
        createdAt: serverTimestamp()
      });
    }
  }

  await batch.commit();
}
