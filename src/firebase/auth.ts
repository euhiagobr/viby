'use client';

import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { app } from "./app";

const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

export { auth };
