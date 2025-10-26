import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBz85qJO_bOY00zjYr6BfNNzLz3aMnTcFo",
  authDomain: "migration-earth-project.firebaseapp.com",
  projectId: "migration-earth-project",
  storageBucket: "migration-earth-project.firebasestorage.app",
  messagingSenderId: "1000322641359",
  appId: "1:1000322641359:web:e89d009b81e187270e36ba"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
