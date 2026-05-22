'use client';

import { getAuth } from "firebase/auth";
import { authApp } from "./apps";

export const auth = getAuth(authApp);
