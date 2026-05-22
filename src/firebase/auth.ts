'use client';

import { getAuth } from "firebase/auth";
import { app } from "./apps";

export const auth = getAuth(app);
