'use client';

import { getFirestore } from "firebase/firestore";
import { app } from "./apps";

export const db = getFirestore(app, "eventosviby");
