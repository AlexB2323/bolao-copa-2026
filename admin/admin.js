// ============================================================
//  admin.js — Painel Admin — Firebase
// ============================================================
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "../js/firebase.js";
import { DB } from "../js/storage.js";

window.DB = DB;

// ⚠️ COLOQUE SEU E-MAIL AQUI (mesmo cadastrado no Firebase Auth)
const ADMIN_EMAILS = ["alexandref.braga@hotmail.com"];

/* ---- UI helpers ------------------------------------------ */
function showScreen(id) {
  ["admin-login", "loading-screen", "admin-panel"].forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    if (s === id) el.style.display = s === "admin-panel" ? "block" : "flex";
    else          el.style.display = "none";
  });
}

showScreen("admin-login");

/* ---- Login ----------------------------------------------- */
document.getElementById("admin-login-btn").addEventListener("click", tryLogin);
document.getElementById("admin-pass-input").addEventListener("keydown", e => { if(e.key==="Enter") tryLogin(); });
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
    document.getElementById("admin-login-err").textContent = "Acesso não autorizado.";
    return;
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
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`page-${btn.dataset.page}`).classList.add("active");
      switch(btn.dataset.page) {
        case "usuarios":          await renderUsersPage(); break;
        case "resultados-grupos": await renderAdminGroups(); break;
        case "resultados-mata":   await renderAdminBracket(); break;
        case "terceiros":         await renderThirdsPage(); break;
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
    const {filled:kF} = countKnockoutFilled(scores, picks);
    const date = new Date(u.createdAt).toLocaleDateString("pt-BR");
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${u.name}</strong></td>
      <td style="font-size:12px;color:#64748b">${u.email||"—"}</td>
      <td>${date}</td>
      <td>${gF} jogos · ${kF} picks</td>
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

/* ---- Resultados Mata-Mata -------------------------------- */
async function renderAdminBracket() {
  const rG = await DB.getResultsGroups(), rKO = await DB.getResultsKO();
  const container = document.getElementById("admin-bracket-container");
  if(!container) return;
  container.innerHTML = "";

  const qualified = getQualified(rG);
  const note = document.createElement("p");
  note.style.cssText = "font-size:13px;color:#64748b;margin-bottom:16px";
  note.textContent = "Clique no time que realmente se classificou. Pontuará todos automaticamente.";
  container.appendChild(note);

  KNOCKOUT_STAGES.forEach(stage => {
    const matches = buildStageMatches(stage.id, qualified, rKO);
    const sd = document.createElement("div"); sd.className = "bracket-stage";
    sd.innerHTML = `<div class="stage-header"><span class="stage-name">${stage.name}</span><span class="stage-pts admin-tag">RESULTADO REAL</span></div><div class="bracket-matches" id="abm-${stage.id}"></div>`;
    container.appendChild(sd);
    const grid = sd.querySelector(`#abm-${stage.id}`);

    matches.forEach(match => {
      const winner = rKO[match.id];
      const md = document.createElement("div"); md.className = "bracket-match";
      md.innerHTML = `<div class="bracket-match-label admin-match-label">${match.label}</div>`;
      [match.t1, match.t2].forEach((team, ti) => {
        if(ti===1){const s=document.createElement("div");s.className="bracket-sep";md.appendChild(s);}
        const unk = !team||team==="?", isW = winner===team&&!unk;
        const td = document.createElement("div");
        td.className = `bracket-team${isW?" winner":""}${unk?" unknown":""}`;
        td.innerHTML = `<span class="bracket-flag">${unk?"❓":getFlag(team)}</span><span>${unk?"A definir":team}</span>${isW?'<span class="winner-check">✓</span>':""}`;
        if(!unk) td.addEventListener("click", async () => {
          propagatePick(match.id, team, rKO);
          await DB.saveResultsKO(rKO);
          await renderAdminBracket();
        });
        md.appendChild(td);
      });
      grid.appendChild(md);
    });
  });

  const champ = rKO["f_0"];
  if(champ && champ !== "?") {
    const b = document.createElement("div"); b.className = "champion-box";
    b.innerHTML = `<div class="champion-label">🏆 Campeão Real</div><div class="champion-name">${getFlag(champ)} ${champ}</div>`;
    container.appendChild(b);
  }
}

/* ---- 3ºs Colocados --------------------------------------- */
async function renderThirdsPage() {
  const container = document.getElementById("thirds-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#94a3b8">Carregando...</p>`;

  const scores = await DB.getResultsGroups();
  const cards  = await DB.getResultsCards();  // pode retornar {} se não tiver
  const thirds = getThirdsRanking(scores, cards);

  if (!thirds.length) {
    container.innerHTML = `
      <div class="admin-card">
        <p style="color:#94a3b8;font-style:italic;font-size:13px">
          Nenhum grupo com placar completo ainda. Preencha os resultados da fase de grupos primeiro.
        </p>
      </div>`;
    return;
  }

  const criterionLabel = { PTS:"Pontos", SG:"Saldo de Gols", GP:"Gols Marcados", FP:"Fair Play", "":"—" };
  const criterionColor = { PTS:"#3b82f6", SG:"#f59e0b", GP:"#10b981", FP:"#ef4444", "":"#94a3b8" };

  const top8    = thirds.slice(0, 8);
  const rest    = thirds.slice(8);
  const cutLine = thirds.length >= 8 ? thirds[7] : null;

  container.innerHTML = `
    <div class="admin-card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin-bottom:2px">Todos os 3ºs Colocados — ${thirds.length}/12 grupos definidos</h3>
          <p style="font-size:12px;color:#64748b;font-weight:400">
            Os 8 primeiros classificam para os 16avos de final.
            A coluna <strong>Critério</strong> indica o que separou cada time do seguinte.
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="display:flex;align-items:center;gap:4px;font-size:12px"><span style="width:10px;height:10px;border-radius:2px;background:#dcfce7;border:1px solid #86efac;display:inline-block"></span>Classificado</span>
          <span style="display:flex;align-items:center;gap:4px;font-size:12px"><span style="width:10px;height:10px;border-radius:2px;background:#fee2e2;border:1px solid #fca5a5;display:inline-block"></span>Eliminado</span>
        </div>
      </div>

      <div style="overflow-x:auto">
        <table class="admin-table thirds-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>Seleção</th>
              <th style="text-align:center">Gr</th>
              <th style="text-align:center">J</th>
              <th style="text-align:center">V</th>
              <th style="text-align:center">E</th>
              <th style="text-align:center">D</th>
              <th style="text-align:center">GP</th>
              <th style="text-align:center">GC</th>
              <th style="text-align:center">SG</th>
              <th style="text-align:center">PTS</th>
              <th style="text-align:center">Critério</th>
            </tr>
          </thead>
          <tbody>
            ${thirds.map((t, i) => {
              const isQ   = i < 8;
              const isCut = cutLine && i === 7;
              const rowClass = isQ ? "thirds-row-q" : "thirds-row-e";
              const criterionBadge = t.criterion
                ? `<span class="criterion-badge" style="background:${criterionColor[t.criterion]}20;color:${criterionColor[t.criterion]};border:1px solid ${criterionColor[t.criterion]}40">${criterionLabel[t.criterion]}</span>`
                : `<span style="color:#94a3b8">—</span>`;

              return `
                <tr class="${rowClass}${isCut ? " thirds-cutline" : ""}">
                  <td style="text-align:center;font-weight:700;font-size:14px">${i < 3 ? ["🥇","🥈","🥉"][i] : i+1+"º"}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:18px">${getFlag(t.name)}</span>
                      <span style="font-weight:600">${t.name}</span>
                      ${isQ ? '<span class="thirds-q-badge">CLASSIF.</span>' : '<span class="thirds-e-badge">ELIM.</span>'}
                    </div>
                  </td>
                  <td style="text-align:center;font-weight:700;color:#0e6b28">Gr.${t.group}</td>
                  <td style="text-align:center">${t.pld}</td>
                  <td style="text-align:center">${t.w}</td>
                  <td style="text-align:center">${t.d}</td>
                  <td style="text-align:center">${t.l}</td>
                  <td style="text-align:center">${t.gf}</td>
                  <td style="text-align:center">${t.ga}</td>
                  <td style="text-align:center;font-weight:600;color:${t.gd>=0?"#0e6b28":"#dc2626"}">${t.gd>0?"+"+t.gd:t.gd}</td>
                  <td style="text-align:center;font-weight:700;font-size:15px">${t.pts}</td>
                  <td style="text-align:center">${criterionBadge}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Seção de cartões (Fair Play) -->
    <div class="admin-card">
      <h3>Fair Play — Registro de Cartões dos 3ºs Colocados</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:14px;font-weight:400">
        Preencha apenas em caso de empate nos critérios anteriores.
        Amarelo=1pt · Vermelho indireto=3pts · Vermelho direto=4pts · Amarelo+Vermelho=5pts
      </p>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Seleção</th>
              <th style="text-align:center">Gr</th>
              <th style="text-align:center" title="Cartões amarelos">🟨 Amarelos</th>
              <th style="text-align:center" title="Vermelho por 2 amarelos">🟨🟥 V.Indireto</th>
              <th style="text-align:center" title="Vermelho direto">🟥 V.Direto</th>
              <th style="text-align:center" title="Amarelo + vermelho direto">🟨🟥 Am+V.Dir</th>
            </tr>
          </thead>
          <tbody>
            ${thirds.map(t => {
              const c = {};  // cards carregados virão do DB
              return `
                <tr>
                  <td><span style="font-size:16px">${getFlag(t.name)}</span> ${t.name}</td>
                  <td style="text-align:center;font-weight:700;color:#0e6b28">Gr.${t.group}</td>
                  <td style="text-align:center"><input class="card-input" type="number" min="0" max="20" value="${(cards[t.name]?.y)||0}" data-team="${t.name}" data-card="y" /></td>
                  <td style="text-align:center"><input class="card-input" type="number" min="0" max="5"  value="${(cards[t.name]?.yr)||0}" data-team="${t.name}" data-card="yr" /></td>
                  <td style="text-align:center"><input class="card-input" type="number" min="0" max="5"  value="${(cards[t.name]?.r)||0}"  data-team="${t.name}" data-card="r" /></td>
                  <td style="text-align:center"><input class="card-input" type="number" min="0" max="5"  value="${(cards[t.name]?.yr2)||0}" data-team="${t.name}" data-card="yr2" /></td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Salva cartões ao editar
  let cardTimer = null;
  container.addEventListener("input", async e => {
    const el = e.target;
    if (!el.classList.contains("card-input")) return;
    clearTimeout(cardTimer);
    cardTimer = setTimeout(async () => {
      const cur = await DB.getResultsCards();
      container.querySelectorAll(".card-input").forEach(inp => {
        const team = inp.dataset.team;
        const card = inp.dataset.card;
        if (!cur[team]) cur[team] = { y:0, yr:0, r:0, yr2:0 };
        cur[team][card] = parseInt(inp.value, 10) || 0;
      });
      await DB.saveResultsCards(cur);
      // Recarrega a tabela para refletir possíveis mudanças no ranking
      await renderThirdsPage();
    }, 800);
  });
}

/* ---- Palpites por Participante --------------------------- */
async function refreshPalpitesSelect() {
  const sel = document.getElementById("palpites-user-select");
  const users = await DB.getUsers();
  sel.innerHTML = `<option value="">— Selecione um participante —</option>`;
  users.forEach(u => { const o = document.createElement("option"); o.value=u.id; o.textContent=u.name; sel.appendChild(o); });
}

async function renderPalpitesPage() { await refreshPalpitesSelect(); }

document.getElementById("palpites-user-select").addEventListener("change", async function() {
  const uid = this.value;
  const sec = document.getElementById("palpites-grupos-section");
  if(!uid) { sec.style.display="none"; return; }
  sec.style.display = "block";
  await renderGroups(uid, "palpites-groups-container", async()=>{});
  await renderBracket(uid, "palpites-bracket-container", async()=>{});
});
