// ============================================================
//  storage.js — Persistência via Firestore
// ============================================================

import {
  db,
  doc, getDoc, setDoc, getDocs, collection, deleteDoc, onSnapshot,
} from "./firebase.js";

const DB = {

  async getUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async createUser(name, email) {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, msg: "Nome não pode ser vazio." };
    const users = await this.getUsers();
    if (users.find(u => u.name.toLowerCase() === trimmed.toLowerCase()))
      return { ok: false, msg: "Já existe um participante com esse nome." };
    const id   = "u_" + Date.now();
    const user = { name: trimmed, email: (email||"").trim().toLowerCase(), createdAt: new Date().toISOString() };
    await setDoc(doc(db, "users", id), user);
    return { ok: true, user: { id, ...user } };
  },

  async deleteUser(id) {
    await Promise.all([
      deleteDoc(doc(db, "users",  id)),
      deleteDoc(doc(db, "scores", id)),
      deleteDoc(doc(db, "picks",  id)),
    ]);
  },

  async getUserById(id) {
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async getUserScores(userId) {
    const snap = await getDoc(doc(db, "scores", userId));
    return snap.exists() ? snap.data() : {};
  },

  async saveUserScores(userId, scores) {
    await setDoc(doc(db, "scores", userId), scores);
  },

  async getUserPicks(userId) {
    const snap = await getDoc(doc(db, "picks", userId));
    return snap.exists() ? snap.data() : {};
  },

  async saveUserPicks(userId, picks) {
    await setDoc(doc(db, "picks", userId), picks);
  },

  async getResultsGroups() {
    const snap = await getDoc(doc(db, "results", "groups"));
    return snap.exists() ? snap.data() : {};
  },

  async saveResultsGroups(results) {
    await setDoc(doc(db, "results", "groups"), results);
  },

  async getResultsKO() {
    const snap = await getDoc(doc(db, "results", "knockout"));
    return snap.exists() ? snap.data() : {};
  },

  async saveResultsKO(results) {
    await setDoc(doc(db, "results", "knockout"), results);
  },
};

// Listener em tempo real para resultados
function watchResults(callback) {
  const u1 = onSnapshot(doc(db, "results", "groups"),   () => callback());
  const u2 = onSnapshot(doc(db, "results", "knockout"), () => callback());
  return () => { u1(); u2(); };
}

export { DB, watchResults };
