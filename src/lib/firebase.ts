import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  addDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDAbQ8XzFF8_Yedd2WPGh5b0VZskzhScAM",
  authDomain: "boletos-remaf.firebaseapp.com",
  projectId: "boletos-remaf",
  storageBucket: "boletos-remaf.firebasestorage.app",
  messagingSenderId: "982122465509",
  appId: "1:982122465509:web:538b37761f3320fbe02c0c",
  measurementId: "G-M1JVZQ1KLD"
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  addDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  orderBy,
  limit,
  Timestamp,
};

export type { User };
