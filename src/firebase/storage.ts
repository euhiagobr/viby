'use client';

import { getStorage } from "firebase/storage";
import { app } from "./apps";

export const storage = getStorage(app);
