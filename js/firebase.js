// ============================================================
//  firebase.js — Configuração e inicialização do Firebase
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB1DSlqSRJ_0gJVb638jsRTUUQNzyf3K2k",
  authDomain:        "bolao-copa-2026-b4398.firebaseapp.com",
  projectId:         "bolao-copa-2026-b4398",
  storageBucket:     "bolao-copa-2026-b4398.firebasestorage.app",
  messagingSenderId: "91181853097",
  appId:             "1:91181853097:web:c0479c4b1ab6e098d27cb8",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export {
  auth, db,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, getDoc, setDoc, getDocs, collection, deleteDoc, onSnapshot,
};
