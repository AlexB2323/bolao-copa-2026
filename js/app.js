// ============================================================
//  app.js — Controlador principal (usuário) — Firebase
// ============================================================
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase.js";
import { DB, watchResults } from "./storage.js";

window.DB = DB;

let bolaoUserId    = null;
let unwatchResults = null;

/* ---- UI helpers ------------------------------------------ */
function showScreen(id) {
  ["login-screen", "loading-screen", "app"].forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    if (s === id) el.style.display = s === "app" ? "block" : "flex";
    else          el.style.display = "none";
  });
}

// Mostra login por padrão ao carregar — Firebase substituirá se tiver sessão ativa
showScreen("login-screen");

/* ---- Login ----------------------------------------------- */
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-pass").value;
  const err   = document.getElementById("login-error");
  err.textContent = "";
  if (!email || !pass) { err.textContent = "Preencha e-mail e senha."; return; }
  try {
    showScreen("loading-screen");
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    showScreen("login-screen");
    err.textContent = "E-mail ou senha incorretos.";
  }
});

// Enter nos campos de login
document.getElementById("login-email").addEventListener("keydown", e => { if(e.key==="Enter") document.getElementById("login-pass").focus(); });
document.getElementById("login-pass").addEventListener("keydown",  e => { if(e.key==="Enter") document.getElementById("login-btn").click(); });

document.getElementById("btn-logout").addEventListener("click", async () => {
  if (unwatchResults) { unwatchResults(); unwatchResults = null; }
  await signOut(auth);
  bolaoUserId = null;
  showScreen("login-screen");
});

/* ---- Auth state ------------------------------------------ */
onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    showScreen("login-screen");
    return;
  }

  showScreen("loading-screen");
  document.querySelector("#loading-screen p").textContent = "Carregando seus dados...";

  try {
    const users = await DB.getUsers();
    const match = users.find(u => u.email === firebaseUser.email);

    if (!match) {
      await signOut(auth);
      showScreen("login-screen");
      document.getElementById("login-error").textContent =
        "Usuário não encontrado. Peça ao admin para te cadastrar.";
      return;
    }

    bolaoUserId = match.id;
    document.getElementById("header-username").textContent = match.name;

    await initApp();
    showScreen("app");

    if (unwatchResults) unwatchResults();
    unwatchResults = watchResults(async () => {
      await updateScoreCards(bolaoUserId);
      if (isPageActive("ranking")) await renderRanking(bolaoUserId);
    });

  } catch(e) {
    console.error("Erro ao carregar dados:", e);
    showScreen("login-screen");
    document.getElementById("login-error").textContent =
      "Erro ao conectar. Verifique sua conexão e tente novamente.";
  }
});

/* ---- App ------------------------------------------------- */
async function initApp() {
  await renderGroups(bolaoUserId, "groups-container", onGroupsChange);
  await updateScoreCards(bolaoUserId);
  initNavigation();
}

async function onGroupsChange(userId) {
  await updateScoreCards(userId);
  if (isPageActive("classificacao")) {
    const s = await DB.getUserScores(userId);
    renderStandings(s);
  }
  if (isPageActive("matamata")) await renderBracket(userId, "bracket-container", onPickChange);
}

async function onPickChange(userId) {
  await updateScoreCards(userId);
}

function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    const nb = btn.cloneNode(true);
    btn.parentNode.replaceChild(nb, btn);
  });
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`page-${btn.dataset.page}`).classList.add("active");
      switch (btn.dataset.page) {
        case "grupos":        await renderGroups(bolaoUserId, "groups-container", onGroupsChange); break;
        case "classificacao": renderStandings(await DB.getUserScores(bolaoUserId)); break;
        case "matamata":      await renderBracket(bolaoUserId, "bracket-container", onPickChange); break;
        case "pontuacao":     await updateScoreCards(bolaoUserId); break;
        case "ranking":       await renderRanking(bolaoUserId); break;
      }
    });
  });
}

function isPageActive(id) {
  const p = document.getElementById(`page-${id}`);
  return p && p.classList.contains("active");
}
