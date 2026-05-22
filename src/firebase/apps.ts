'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { authConfig, vibyConfig } from "./config";

function getNamedApp(config: any, name: string): FirebaseApp {
  return getApps().find(a => a.name === name) || initializeApp(config, name);
}

export const authApp = getNamedApp(authConfig, "authApp");
export const vibyApp = getNamedApp(vibyConfig, "vibyApp");
