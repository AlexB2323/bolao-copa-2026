// ============================================================
//  admin.js — Painel Admin — Firebase (mata-mata manual)
// ============================================================
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "../js/firebase.js";
import { DB } from "../js/storage.js";

window.DB = DB;

const ADMIN_EMAILS = ["alexandref.braga@hotmail.com"];

function showScreen(id) {
  ["admin-login","loading-screen","admin-panel"].forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    el.style.display = s === id ? (s === "admin-panel" ? "block" : "flex") : "none";
  });
}
showScreen("admin-login");

/* ---- Login ----------------------------------------------- */
document.getElementById("admin-login-btn").addEventListener("click", tryLogin);
document.getElementById("admin-pass-input").addEventListener("keydown",  e => { if(e.key==="Enter") tryLogin(); });
document.getElementById("admin-email-input").addEventListener("keydown", e => { if(e.key==="Enter") document.getElementById("admin-pass-input").focus(); });

async function tryLogin() {
  const email = document.getElementById("admin-email-input").value.trim();
  const pass  = document.getElementById("admin-pass-input").value;
  const err   = document.getElementById("admin-login-err");
  err.textContent = "";
  if (!ADMIN_EMAILS.includes(email)) { err.textContent = "E-mail sem acesso ao admin."; return; }
  try {
    showScreen("loading-screen");
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    showScreen("admin-login");
    err.textContent = "E-mail ou senha incorretos.";
  }
}

document.getElementById("admin-logout-btn").addEventListener("click", async () => {
  await signOut(auth); showScreen("admin-login");
});

onAuthStateChanged(auth, async user => {
  if (!user) { showScreen("admin-login"); return; }
  if (!ADMIN_EMAILS.includes(user.email)) {
    await signOut(auth); showScreen("admin-login");
    document.getElementById("admin-login-err").textContent = "Acesso não autorizado."; return;
  }
  showScreen("loading-screen");
  document.querySelector("#loading-screen p").textContent = "Carregando painel...";
  try {
    initAdminNav();
    await renderUsersPage();
    showScreen("admin-panel");
  } catch(e) {
    console.error(e);
    showScreen("admin-login");
    document.getElementById("admin-login-err").textContent = "Erro ao carregar painel.";
  }
});

/* ---- Navegação ------------------------------------------- */
function initAdminNav() {
  // Clona botões para remover listeners antigos (evita acumulação)
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
      switch(btn.dataset.page) {
        case "usuarios":          await renderUsersPage(); break;
        case "resultados-grupos": await renderAdminGroups(); break;
        case "mata-mata":         await renderAdminBracket(); break;
        case "palpites":          await renderPalpitesPage(); break;
        case "ranking-admin":     await renderAdminRanking(); break;
      }
    });
  });
}

/* ---- Usuários -------------------------------------------- */
async function renderUsersPage() {
  const users = await DB.getUsers();
  document.getElementById("user-count").textContent = users.length;
  const list = document.getElementById("users-list");
  if (!users.length) {
    list.innerHTML = `<p style="color:#94a3b8;font-style:italic;font-size:13px">Nenhum participante ainda.</p>`;
    return;
  }
  const rows = await Promise.all(users.map(async (u, i) => {
    const scores = await DB.getUserScores(u.id);
    const picks  = await DB.getUserPicks(u.id);
    const {filled:gF} = countGroupFilled(scores);
    const {filled:kF} = countKnockoutFilled(picks);
    const date = new Date(u.createdAt).toLocaleDateString("pt-BR");
    return `<tr>
      <td>${i+1}</td><td><strong>${u.name}</strong></td>
      <td style="font-size:12px;color:#64748b">${u.email||"—"}</td>
      <td>${date}</td><td>${gF} jogos · ${kF} picks</td>
      <td><button class="btn-sm btn-danger" onclick="deleteUser('${u.id}','${u.name}')">Excluir</button></td>
    </tr>`;
  }));
  list.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Nome</th><th>E-mail</th><th>Cadastrado</th><th>Palpites</th><th>Ações</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
}

document.getElementById("btn-create-user").addEventListener("click", async () => {
  const nameEl  = document.getElementById("new-user-name");
  const emailEl = document.getElementById("new-user-email");
  const msg     = document.getElementById("user-msg");
  const res     = await DB.createUser(nameEl.value, emailEl.value);
  if (res.ok) {
    msg.textContent = `✅ "${res.user.name}" criado!`; msg.style.color = "#16a34a";
    nameEl.value = ""; emailEl.value = "";
    await renderUsersPage(); await refreshPalpitesSelect();
  } else {
    msg.textContent = "❌ " + res.msg; msg.style.color = "#dc2626";
  }
  setTimeout(() => msg.textContent = "", 3000);
});

document.getElementById("new-user-name").addEventListener("keydown", e => {
  if(e.key === "Enter") document.getElementById("btn-create-user").click();
});

window.deleteUser = async (id, name) => {
  if(!confirm(`Excluir "${name}" e todos os seus palpites?`)) return;
  await DB.deleteUser(id);
  await renderUsersPage(); await refreshPalpitesSelect();
};

/* ---- Resultados Grupos ----------------------------------- */
async function renderAdminGroups() {
  const results = await DB.getResultsGroups();
  const oldC = document.getElementById("admin-groups-container");
  if(!oldC) return;
  const container = oldC.cloneNode(false);
  oldC.parentNode.replaceChild(container, oldC);

  Object.keys(GROUPS).forEach(g => {
    const matches = getGroupMatches(g);
    const card = document.createElement("div"); card.className = "group-card";
    card.innerHTML = `
      <div class="group-card-header">
        <span class="group-card-title">GRUPO ${g}</span>
        <span class="group-card-subtitle">${matches.length} jogos</span>
      </div><div class="group-card-body"></div>`;
    container.appendChild(card);
    const body = card.querySelector(".group-card-body");

    matches.forEach((match, idx) => {
      const key = `${g}_${idx}`; const s = results[key] || {h:"",a:""};
      const row = document.createElement("div"); row.className = "match-row";
      row.innerHTML = `
        <div class="team-left"><span class="team-flag">${getFlag(match[0])}</span><span>${match[0]}</span></div>
        <input class="score-input admin-score ${s.h!==""?"filled":""}" type="number" min="0" max="20" placeholder="–" value="${s.h}" data-group="${g}" data-idx="${idx}" data-side="h" inputmode="numeric"/>
        <span class="vs-sep">×</span>
        <input class="score-input admin-score ${s.a!==""?"filled":""}" type="number" min="0" max="20" placeholder="–" value="${s.a}" data-group="${g}" data-idx="${idx}" data-side="a" inputmode="numeric"/>
        <div class="team-right"><span class="team-flag">${getFlag(match[1])}</span><span>${match[1]}</span></div>`;
      body.appendChild(row);
    });
  });

  let t = null;
  container.addEventListener("input", async e => {
    const el = e.target; if(!el.classList.contains("admin-score")) return;
    const {group, idx, side} = el.dataset; const key = `${group}_${idx}`;
    el.classList.toggle("filled", el.value !== "");
    clearTimeout(t); t = setTimeout(async () => {
      const cur = await DB.getResultsGroups();
      if(!cur[key]) cur[key] = {h:"",a:""};
      cur[key][side] = el.value;
      await DB.saveResultsGroups(cur);
    }, 600);
  });
}

/** Cria um <select> com todos os times (para o admin) */
function makeAdminSelect(teams, selected, id) {
  const sel = document.createElement("select");
  sel.id = id;
  sel.style.cssText = "flex:1;padding:5px 8px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;background:var(--off-white);color:var(--gray-800);min-width:0";
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "— Selecionar time —";
  sel.appendChild(blank);
  teams.forEach(t => {
    const o = document.createElement("option");
    o.value = t; o.textContent = `${getFlag(t)} ${t}`;
    if (t === selected) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

/* ---- Mata-Mata Manual ------------------------------------ */
async function renderAdminBracket() {
  const container = document.getElementById("admin-bracket-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#94a3b8;padding:20px">Carregando mata-mata...</p>`;

  let bracketData;
  try {
    bracketData = await DB.getBracketData();
  } catch(e) {
    container.innerHTML = `<p style="color:#dc2626;padding:20px">Erro ao carregar dados. Verifique a conexão.</p>`;
    console.error("Erro getBracketData:", e);
    return;
  }

  const allTeams = getAllTeams();
  container.innerHTML = "";

  // Card de instrução
  const info = document.createElement("div");
  info.className = "admin-card";
  info.style.marginBottom = "20px";
  info.innerHTML = `
    <h3 style="margin-bottom:6px">Como funciona</h3>
    <p style="font-size:13px;color:#64748b;font-weight:400;line-height:1.6">
      <strong>16avos:</strong> Selecione os dois times de cada confronto nos dropdowns.<br>
      Marque o <strong>rádio (●)</strong> ao lado do time vencedor para registrar o resultado.<br>
      <strong>Fases seguintes:</strong> Os times aparecem automaticamente — clique no vencedor para avançá-lo.
    </p>`;
  container.appendChild(info);

  /* ---- 16avos: dois dropdowns + radio vencedor ---- */
  const r32Stage = document.createElement("div");
  r32Stage.className = "bracket-stage";
  r32Stage.innerHTML = `
    <div class="stage-header">
      <span class="stage-name">16avos de Final</span>
      <span class="stage-pts admin-tag">DEFINIR CONFRONTOS</span>
    </div>
    <div class="bracket-matches" id="admin-r32-grid"></div>`;
  container.appendChild(r32Stage);

  const r32Grid = r32Stage.querySelector("#admin-r32-grid");

  for (let i = 0; i < 16; i++) {
    const t1Val  = bracketData[`r32_${i}_t1`]     || "";
    const t2Val  = bracketData[`r32_${i}_t2`]     || "";
    const winner = bracketData[`r32_${i}_winner`] || "";

    const md = document.createElement("div");
    md.className = "bracket-match";
    md.innerHTML = `<div class="bracket-match-label admin-match-label">Jogo ${i+1}</div>`;

    // IDs únicos baseados no índice — usados para buscar os selects no evento do radio
    const idT1  = `adm-r32-t1-${i}`;
    const idT2  = `adm-r32-t2-${i}`;
    const idW   = `adm-r32-w-${i}`;

    // Cria as duas linhas (time 1 e time 2) com radio + select
    [
      { side:"t1", val: t1Val, selId: idT1 },
      { side:"t2", val: t2Val, selId: idT2 },
    ].forEach(({ side, val, selId }, num) => {
      const isWin = val !== "" && winner === val;

      const row = document.createElement("div");
      row.style.cssText = `display:flex;align-items:center;gap:6px;padding:7px 10px;${num===0?"border-bottom:1px solid var(--gray-100)":""}`;
      if (isWin) row.style.background = "#f0fdf4";

      // Radio: id único para poder ser encontrado pelo select correspondente
      const radio = document.createElement("input");
      radio.type    = "radio";
      radio.name    = idW;           // agrupados pelo ID do jogo
      radio.id      = `${idW}-${side}`;
      radio.checked = isWin;
      radio.title   = "Marcar como vencedor";
      radio.style.cssText = "accent-color:var(--green-mid);cursor:pointer;width:15px;height:15px;flex-shrink:0";

      // Select com id único
      const sel = makeAdminSelect(allTeams, val, selId);

      row.appendChild(radio);
      row.appendChild(sel);
      md.appendChild(row);

      // Salva time ao mudar o select
      sel.addEventListener("change", async () => {
        const cur = await DB.getBracketData();
        cur[`r32_${i}_${side}`] = sel.value;
        // Se o vencedor era esse time e foi trocado, limpa
        const curWinner = cur[`r32_${i}_winner`] || "";
        const otherSide = side === "t1" ? "t2" : "t1";
        const otherVal  = cur[`r32_${i}_${otherSide}`] || "";
        if (curWinner && curWinner !== sel.value && curWinner !== otherVal) {
          delete cur[`r32_${i}_winner`];
          clearWinner(`r32_${i}`, cur);
        }
        await DB.saveBracketData(cur);
        await renderAdminBracket();
      });

      // Salva vencedor ao clicar no radio
      // Busca o select pelo ID (não por closure) — evita referência perdida
      radio.addEventListener("change", async () => {
        if (!radio.checked) return;
        const selEl = document.getElementById(selId);
        const teamVal = selEl ? selEl.value : "";
        if (!teamVal) { radio.checked = false; return; }
        const cur = await DB.getBracketData();
        cur[`r32_${i}_${side}`] = teamVal;
        cur[`r32_${i}_winner`]  = teamVal;
        // Limpa apenas as fases SEGUINTES (não o próprio winner do r32)
        const nextStage = { r32:"r16", r16:"qf", qf:"sf", sf:"f" };
        const nextId = `${nextStage["r32"]}_${Math.floor(i / 2)}_winner`;
        const sibId  = `r32_${i % 2 === 0 ? i+1 : i-1}_winner`;
        const sibWin = cur[sibId] || "";
        const nextPick = cur[nextId] || "";
        if (nextPick && nextPick !== teamVal && nextPick !== sibWin) {
          delete cur[nextId];
          clearWinner(`${nextStage["r32"]}_${Math.floor(i/2)}`, cur);
        }
        await DB.saveBracketData(cur);
        await renderAdminBracket();
      });
    });

    r32Grid.appendChild(md);
  }

  /* ---- Oitavas em diante: clique no vencedor ---- */
  const laterStages = KNOCKOUT_STAGES.filter(s => s.id !== "r32");

  laterStages.forEach(stage => {
    const prevMap = { r16:"r32", qf:"r16", sf:"qf", f:"sf" };
    const prev    = prevMap[stage.id];
    const count   = stage.count;

    const stageDiv = document.createElement("div");
    stageDiv.className = "bracket-stage";
    stageDiv.innerHTML = `
      <div class="stage-header">
        <span class="stage-name">${stage.name}</span>
        <span class="stage-pts admin-tag">RESULTADO REAL</span>
      </div>
      <div class="bracket-matches" id="admin-${stage.id}-grid"></div>`;
    container.appendChild(stageDiv);

    const grid = stageDiv.querySelector(`#admin-${stage.id}-grid`);

    for (let i = 0; i < count; i++) {
      const t1     = bracketData[`${prev}_${i*2}_winner`]   || "?";
      const t2     = bracketData[`${prev}_${i*2+1}_winner`] || "?";
      const winner = bracketData[`${stage.id}_${i}_winner`] || "";

      const md = document.createElement("div"); md.className = "bracket-match";
      md.innerHTML = `<div class="bracket-match-label admin-match-label">Jogo ${i+1}</div>`;

      [t1, t2].forEach((team, ti) => {
        if (ti === 1) { const s=document.createElement("div"); s.className="bracket-sep"; md.appendChild(s); }
        const unk  = !team || team === "?";
        const isW  = winner === team && !unk;
        const tDiv = document.createElement("div");
        tDiv.className = `bracket-team${isW?" winner":""}${unk?" unknown":""}`;
        tDiv.innerHTML = `
          <span class="bracket-flag">${unk?"❓":getFlag(team)}</span>
          <span>${unk?"A definir":team}</span>
          ${isW?'<span class="winner-check">✓</span>':""}`;
        if (!unk) {
          tDiv.addEventListener("click", async () => {
            const cur = await DB.getBracketData();
            setWinner(`${stage.id}_${i}`, team, cur);
            await DB.saveBracketData(cur);
            await renderAdminBracket();
          });
        }
        md.appendChild(tDiv);
      });
      grid.appendChild(md);
    }
  });

  // Campeão
  const champ = bracketData["f_0_winner"];
  if (champ && champ !== "?") {
    const b = document.createElement("div"); b.className = "champion-box";
    b.innerHTML = `<div class="champion-label">🏆 Campeão Real</div><div class="champion-name">${getFlag(champ)} ${champ}</div>`;
    container.appendChild(b);
  }
}

/* ---- Palpites por Participante --------------------------- */
async function refreshPalpitesSelect() {
  const sel   = document.getElementById("palpites-user-select");
  const users = await DB.getUsers();
  sel.innerHTML = `<option value="">— Selecione um participante —</option>`;
  users.forEach(u => {
    const o = document.createElement("option");
    o.value = u.id; o.textContent = u.name;
    sel.appendChild(o);
  });
}

async function renderPalpitesPage() { await refreshPalpitesSelect(); }

document.getElementById("palpites-user-select").addEventListener("change", async function() {
  const uid = this.value;
  const sec = document.getElementById("palpites-grupos-section");
  if (!uid) { sec.style.display = "none"; return; }
  sec.style.display = "block";
  await renderGroups(uid, "palpites-groups-container", async () => {});
  await renderBracket(uid, "palpites-bracket-container", async () => {});
});
