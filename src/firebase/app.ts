'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { firebaseConfig } from "./config";

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
