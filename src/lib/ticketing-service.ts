
import { 
  Firestore, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  Timestamp, 
  collection, 
  writeBatch,
  query,
  where,
  getDocs
} from "firebase/firestore";

/**
 * Lógica de Reserva de Assento com timeout de 10 minutos.
 */
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
        throw new Error("Este lugar já está em reserva por outro usuário.");
      }
    }

    const reservadoAte = new Date(now.getTime() + 10 * 60 * 1000); 

    transaction.update(assentoRef, {
      status: 'reservado',
      reservadoPor: userId,
      reservadoAte: Timestamp.fromDate(reservadoAte),
      updatedAt: serverTimestamp()
    });
  });
}

/**
 * Libera assentos expirados em massa.
 */
export async function releaseExpiredSeats(db: Firestore, eventoId: string) {
  const now = new Date();
  const q = query(
    collection(db, "events", eventoId, "setores"),
  );
  
  const setoresSnap = await getDocs(q);
  const batch = writeBatch(db);
  
  for (const setorDoc of setoresSnap.docs) {
    const assentosQ = query(
      collection(db, "events", eventoId, "setores", setorDoc.id, "assentos"),
      where("status", "==", "reservado"),
      where("reservadoAte", "<=", Timestamp.fromDate(now))
    );
    const snap = await getDocs(assentosQ);
    snap.forEach(d => {
      batch.update(d.ref, {
        status: 'disponivel',
        reservadoPor: null,
        reservadoAte: null,
        updatedAt: serverTimestamp()
      });
    });
  }
  
  await batch.commit();
}

/**
 * Gera assentos físicos baseados na configuração do setor.
 * Define uma grade inicial de posições.
 */
export async function generateMapData(
  db: Firestore, 
  eventoId: string, 
  setorId: string, 
  sectorData: any
) {
  const batch = writeBatch(db);
  const assentosRef = collection(db, "events", eventoId, "setores", setorId, "assentos");

  const gap = 45; // Espaçamento inicial entre assentos

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
          categoria: 'comum',
          status: 'disponivel',
          setorId,
          eventoId,
          posX: n * gap,
          posY: (f + 1) * gap,
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
        categoria: 'comum',
        status: 'disponivel',
        setorId,
        eventoId,
        posX: ((m - 1) % 10 + 1) * gap * 2,
        posY: (Math.floor((m - 1) / 10) + 1) * gap * 2,
        createdAt: serverTimestamp()
      });
    }
  }

  await batch.commit();
}
