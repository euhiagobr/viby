'use client';

import { getStorage } from "firebase/storage";
import { vibyApp } from "./apps";

export const storage = getStorage(vibyApp);
