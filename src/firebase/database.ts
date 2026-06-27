'use client';

import { getFirestore, Firestore } from "firebase/firestore";
import { app } from "./app";

const db: Firestore = getFirestore(app);

export { db };
