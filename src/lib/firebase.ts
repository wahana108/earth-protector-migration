import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage"; // Keep this if you plan to use Storage later, otherwise remove
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

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
const functions = getFunctions(app);

// Hubungkan ke emulator jika sedang berjalan di localhost
if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  // connectStorageEmulator(storage, "127.0.0.1", 9199); // Dihapus/dikomentari karena tidak ada konfigurasi Storage Emulator di firebase.json
}

export { app, db, auth, storage, functions };
