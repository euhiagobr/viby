'use client';

import { getFirestore } from "firebase/firestore";
import { vibyApp } from "./apps";

export const db = getFirestore(vibyApp, "eventosviby");
