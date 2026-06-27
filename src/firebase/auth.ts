'use client';

import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { app } from "./app";

/**
 * @fileOverview Auditoria de Inicialização do Auth.
 */

const now = () => new Date().getTime();
console.log(`[${now()}] [TRACE-AUTH] 1. Initializing Auth Instance...`);

const auth: Auth = getAuth(app);

console.log(`[${now()}] [TRACE-AUTH] 2. Setting Persistence to LOCAL`);
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log(`[${now()}] [TRACE-AUTH] 3. Persistence set successfully. CurrentUser:`, auth.currentUser?.email || 'null');
  })
  .catch((err) => {
    console.error(`[${now()}] [TRACE-AUTH] ERR: Persistence failed:`, err.code, err.message);
  });

export { auth };
