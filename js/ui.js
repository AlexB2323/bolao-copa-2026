// ============================================================
//  ui.js — Renderização
// ============================================================

/* ---- Fase de Grupos --------------------------------------- */
async function renderGroups(userId, containerId, onChangeCallback) {
  const old = document.getElementById(containerId || "groups-container");
  if (!old) return;

  // Cria novo container — descarta todos os listeners de input acumulados
  const fresh = document.createElement("div");
  fresh.id        = old.id;
  fresh.className = old.className;
  old.replaceWith(fresh);

  const scores = await DB.getUserScores(userId);

  Object.keys(GROUPS).forEach(g => {
    const matches = getGroupMatches(g);
    const card = document.createElement("div");
    card.className = "group-card";
    card.innerHTML = `
      <div class="group-card-header">
        <span class="group-card-title">GRUPO ${g}</span>
        <span class="group-card-subtitle">${matches.length} jogos</span>
      </div>
      <div class="group-card-body"></div>`;
    fresh.appendChild(card);

    const body = card.querySelector(".group-card-body");
    matches.forEach((match, idx) => {
      const s = scores[`${g}_${idx}`] || { h:"", a:"" };
      const row = document.createElement("div");
      row.className = "match-row";
      row.innerHTML = `
        <div class="team-left"><span class="team-flag">${getFlag(match[0])}</span><span>${match[0]}</span></div>
        <input class="score-input ${s.h!==""?"filled":""}" type="number" min="0" max="20" placeholder="–" value="${s.h}" data-group="${g}" data-idx="${idx}" data-side="h" inputmode="numeric"/>
        <span class="vs-sep">×</span>
        <input class="score-input ${s.a!==""?"filled":""}" type="number" min="0" max="20" placeholder="–" value="${s.a}" data-group="${g}" data-idx="${idx}" data-side="a" inputmode="numeric"/>
        <div class="team-right"><span class="team-flag">${getFlag(match[1])}</span><span>${match[1]}</span></div>`;
      body.appendChild(row);
    });
  });

  // Cache local: acumula TODAS as mudanças e salva em batch
  // Isso evita race conditions quando o usuário digita rápido
  // (um único timer global por container, mas o estado é mantido localmente)
  const pendingChanges = {};   // { "A_0": { h:"2", a:"1" }, ... }
  const timers = {};           // um timer por jogo (key = "A_0")
  let   isSaving = false;      // lock para evitar saves simultâneos
  let   localScores = null;    // cache local dos scores já carregados

  // Carrega os scores uma vez e mantém em cache local
  async function getLocalScores() {
    if (!localScores) localScores = await DB.getUserScores(userId);
    return localScores;
  }

  async function flushSave() {
    if (isSaving || Object.keys(pendingChanges).length === 0) return;
    isSaving = true;
    // Captura e limpa o pending atual
    const batch = { ...pendingChanges };
    Object.keys(batch).forEach(k => delete pendingChanges[k]);
    try {
      // Aplica o batch no cache local e salva
      Object.assign(localScores, batch);
      await DB.saveUserScores(userId, localScores);
      if (onChangeCallback) await onChangeCallback(userId);
    } catch(e) {
      // Em caso de erro, devolve as mudanças para retry
      Object.assign(pendingChanges, batch);
      console.error("Erro ao salvar placar:", e);
    } finally {
      isSaving = false;
      // Se novas mudanças chegaram durante o save, salva de novo
      if (Object.keys(pendingChanges).length > 0) {
        setTimeout(flushSave, 100);
      }
    }
  }

  fresh.addEventListener("input", async e => {
    const el = e.target;
    if (!el.classList.contains("score-input")) return;
    const { group, idx, side } = el.dataset;
    const key = `${group}_${idx}`;
    el.classList.toggle("filled", el.value !== "");

    // Garante que o cache local está carregado
    const scores = await getLocalScores();

    // Atualiza o cache local imediatamente (sem esperar o save)
    if (!scores[key]) scores[key] = { h:"", a:"" };
    scores[key][side] = el.value;

    // Marca como pendente
    if (!pendingChanges[key]) pendingChanges[key] = { ...(scores[key]) };
    pendingChanges[key][side] = el.value;

    // Timer por jogo: se o mesmo jogo for editado de novo, reinicia só o timer dele
    clearTimeout(timers[key]);
    timers[key] = setTimeout(flushSave, 700);
  });
}

/* ---- Classificação ---------------------------------------- */
function renderStandings(scores) {
  const container = document.getElementById("standings-container");
  if (!container) return;
  container.innerHTML = "";

  Object.keys(GROUPS).forEach(g => {
    const st = calcStandings(g, scores);
    const card = document.createElement("div");
    card.className = "group-card";
    card.innerHTML = `
      <div class="group-card-header"><span class="group-card-title">GRUPO ${g}</span></div>
      <div class="group-card-body">
        <table class="standing-table">
          <thead><tr><th>Seleção</th><th>J</th><th>P</th><th>SG</th><th>GP</th></tr></thead>
          <tbody>
            ${st.map((t,i) => `
              <tr class="${i<2?"row-q":i===2?"row-t":"row-e"}">
                <td title="${t.name}">${getFlag(t.name)} ${t.name}</td>
                <td>${t.pld}</td><td>${t.pts}</td>
                <td>${t.gd>0?"+"+t.gd:t.gd}</td><td>${t.gf}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    container.appendChild(card);
  });

  renderThirds(scores);
}

function renderThirds(scores) {
  const box = document.getElementById("thirds-summary");
  if (!box) return;
  const q      = getQualified(scores);
  const thirds = q.thirds.slice(0, 8);
  box.innerHTML = `
    <h3>Melhores 3ºs classificados (${thirds.length}/8)</h3>
    <div class="thirds-list">
      ${thirds.length
        ? thirds.map((t,i) => `<span class="third-chip">${i+1}. ${getFlag(t.name)} ${t.name} <span style="opacity:.6;font-size:11px">(${t.pts}pts · Gr.${t.group})</span></span>`).join("")
        : "<span style='font-size:13px;color:#94a3b8'>Preencha os jogos para ver</span>"}
    </div>`;
}

/* ---- Mata-Mata (USUÁRIO — monta o próprio chaveamento) --- */

function makeUserTeamSelect(allTeams, selected, inputId) {
  const sel = document.createElement("select");
  sel.id = inputId;
  sel.style.cssText = "flex:1;padding:5px 8px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);font-size:13px;background:var(--off-white);color:var(--gray-800);min-width:0";
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "— Selecionar time —";
  sel.appendChild(blank);
  allTeams.forEach(t => {
    const o = document.createElement("option");
    o.value = t; o.textContent = `${getFlag(t)} ${t}`;
    if (t === selected) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

/**
 * Picks do usuário (estrutura achatada — sem objetos aninhados):
 *   r32_0_t1: "Brasil"      ← time 1 do jogo 0
 *   r32_0_t2: "México"      ← time 2 do jogo 0
 *   r32_0_winner: "Brasil"  ← vencedor escolhido
 *   r16_0_winner: "Brasil"  ← vencedor das oitavas
 */
/**
 * Atualiza o highlight visual de uma linha do bracket do usuário
 * sem recarregar nada.
 */
function updateUserRowHighlight(cid, stageId, idx, localPicks) {
  const winner = localPicks[`${stageId}_${idx}_winner`] || "";
  const t1Val  = localPicks[`${stageId}_${idx}_t1`]    || "";
  const t2Val  = localPicks[`${stageId}_${idx}_t2`]    || "";
  const idW    = stageId === "r32" ? `${cid}-winner-${idx}` : `${cid}-${stageId}-w-${idx}`;
  const rowId1 = stageId === "r32" ? `${cid}-r32-row-${idx}-t1` : `${cid}-${stageId}-row-${idx}-t1`;
  const rowId2 = stageId === "r32" ? `${cid}-r32-row-${idx}-t2` : `${cid}-${stageId}-row-${idx}-t2`;

  const row1 = document.getElementById(rowId1);
  const row2 = document.getElementById(rowId2);
  if (row1) row1.style.background = (winner && winner === t1Val) ? "#f0fdf4" : "";
  if (row2) row2.style.background = (winner && winner === t2Val) ? "#f0fdf4" : "";

  // Sincroniza os radios
  const radioT1 = document.getElementById(`${idW}-t1`);
  const radioT2 = document.getElementById(`${idW}-t2`);
  if (radioT1) radioT1.checked = (winner !== "" && winner === t1Val);
  if (radioT2) radioT2.checked = (winner !== "" && winner === t2Val);
}

async function renderBracket(userId, containerId, onPickCallback) {
  const cid = containerId || "bracket-container";
  const old = document.getElementById(cid);
  if (!old) return;

  // Substitui container para limpar listeners acumulados
  const container = document.createElement("div");
  container.id        = old.id;
  container.className = old.className;
  old.replaceWith(container);

  // Cache local de picks — evita getDoc a cada interação
  let localPicks = await DB.getUserPicks(userId);
  const allTeams = getAllTeams();

  // Salva picks localmente e no Firestore sem recriar a página
  async function savePicks() {
    await DB.saveUserPicks(userId, localPicks);
    if (onPickCallback) await onPickCallback(userId);
  }

  // Renderiza um jogo (stage + idx) com radio + select para t1 e t2
  function renderMatch(stageId, idx, ptsLabel) {
    const t1Val  = localPicks[`${stageId}_${idx}_t1`]     || "";
    const t2Val  = localPicks[`${stageId}_${idx}_t2`]     || "";
    const winner = localPicks[`${stageId}_${idx}_winner`] || "";
    const isR32  = stageId === "r32";
    const idW    = isR32 ? `${cid}-winner-${idx}` : `${cid}-${stageId}-w-${idx}`;

    const md = document.createElement("div");
    md.className = "bracket-match";
    md.innerHTML = `<div class="bracket-match-label">Jogo ${idx+1}</div>`;

    [
      { side:"t1", val: t1Val },
      { side:"t2", val: t2Val },
    ].forEach(({ side, val }, num) => {
      const isWin = val !== "" && winner === val;
      const selId = isR32
        ? `${cid}-r32-${side}-${idx}`
        : `${cid}-${stageId}-${side}-${idx}`;
      const rowId = isR32
        ? `${cid}-r32-row-${idx}-${side}`
        : `${cid}-${stageId}-row-${idx}-${side}`;

      const row = document.createElement("div");
      row.id = rowId;
      row.style.cssText = `display:flex;align-items:center;gap:6px;padding:7px 10px;${num===0?"border-bottom:1px solid var(--gray-100)":""}`;
      if (isWin) row.style.background = "#f0fdf4";

      const radio = document.createElement("input");
      radio.type    = "radio";
      radio.name    = idW;
      radio.id      = `${idW}-${side}`;
      radio.checked = isWin;
      radio.title   = "Meu palpite de vencedor";
      radio.style.cssText = "accent-color:var(--green-mid);cursor:pointer;width:15px;height:15px;flex-shrink:0";

      const sel = makeUserTeamSelect(allTeams, val, selId);
      row.appendChild(radio);
      row.appendChild(sel);
      md.appendChild(row);

      // Mudar o select: salva o time, sem recriar a página
      sel.addEventListener("change", async () => {
        localPicks[`${stageId}_${idx}_${side}`] = sel.value;
        const curWinner = localPicks[`${stageId}_${idx}_winner`] || "";
        const otherSide = side === "t1" ? "t2" : "t1";
        const otherVal  = localPicks[`${stageId}_${idx}_${otherSide}`] || "";
        if (curWinner && curWinner !== sel.value && curWinner !== otherVal) {
          delete localPicks[`${stageId}_${idx}_winner`];
          propagateClearUser(`${stageId}_${idx}`, localPicks);
        }
        updateUserRowHighlight(cid, stageId, idx, localPicks);
        await savePicks();
      });

      // Clicar no radio: salva o vencedor, sem recriar a página
      radio.addEventListener("change", async () => {
        if (!radio.checked) return;
        const selEl = document.getElementById(selId);
        const teamVal = selEl ? selEl.value : "";
        if (!teamVal) { radio.checked = false; return; }
        localPicks[`${stageId}_${idx}_${side}`] = teamVal;
        localPicks[`${stageId}_${idx}_winner`]  = teamVal;
        // Desmarca o outro radio
        const otherSide = side === "t1" ? "t2" : "t1";
        const otherRadio = document.getElementById(`${idW}-${otherSide}`);
        if (otherRadio) otherRadio.checked = false;
        propagateClearUser(`${stageId}_${idx}`, localPicks);
        updateUserRowHighlight(cid, stageId, idx, localPicks);
        await savePicks();
      });
    });

    return md;
  }

  /* ---- 16avos ---- */
  const r32Stage = document.createElement("div");
  r32Stage.className = "bracket-stage";
  r32Stage.innerHTML = `<div class="stage-header"><span class="stage-name">16avos de Final</span><span class="stage-pts">6 pts/acerto</span></div>`;
  const r32Grid = document.createElement("div");
  r32Grid.className = "bracket-matches";
  for (let i = 0; i < 16; i++) r32Grid.appendChild(renderMatch("r32", i));
  r32Stage.appendChild(r32Grid);
  container.appendChild(r32Stage);

  /* ---- Oitavas em diante ---- */
  KNOCKOUT_STAGES.filter(s => s.id !== "r32").forEach(stage => {
    const stageDiv = document.createElement("div");
    stageDiv.className = "bracket-stage";
    stageDiv.innerHTML = `<div class="stage-header"><span class="stage-name">${stage.name}</span><span class="stage-pts">${stage.ptsLabel}</span></div>`;
    const grid = document.createElement("div");
    grid.className = "bracket-matches";
    for (let i = 0; i < stage.count; i++) grid.appendChild(renderMatch(stage.id, i));
    stageDiv.appendChild(grid);
    container.appendChild(stageDiv);
  });

  // Campeão escolhido (vencedor da final)
  const champion = localPicks["f_0_winner"];
  if (champion && champion !== "?") {
    const box = document.createElement("div");
    box.className = "champion-box";
    box.innerHTML = `<div class="champion-label">⭐ Meu Campeão — +40 pts bônus ⭐</div><div class="champion-name">${getFlag(champion)} ${champion}</div>`;
    container.appendChild(box);
  }
}

function propagateClearUser(matchId, picks) {
  const nextStage = { r32:"r16", r16:"qf", qf:"sf", sf:"f" };
  const parts     = matchId.split("_");
  const stage     = parts[0];
  const idx       = parseInt(parts[1], 10);
  const next      = nextStage[stage];
  if (!next) return;

  const nextMatchId = `${next}_${Math.floor(idx / 2)}`;
  const nextWinKey  = `${nextMatchId}_winner`;
  const siblingIdx  = idx % 2 === 0 ? idx + 1 : idx - 1;
  const myWin       = picks[`${matchId}_winner`]              || "";
  const sibWin      = picks[`${stage}_${siblingIdx}_winner`]  || "";
  const nextPick    = picks[nextWinKey]                        || "";

  if (nextPick && nextPick !== myWin && nextPick !== sibWin) {
    delete picks[nextWinKey];
    propagateClearUser(nextMatchId, picks);
  }
}

/* ---- Pontuação do usuário --------------------------------- */
async function updateScoreCards(userId) {
  const sc = document.getElementById("score-cards");
  const sd = document.getElementById("score-detail");
  if (!sc) return;

  const scores = await DB.getUserScores(userId);
  const picks  = await DB.getUserPicks(userId);
  const { filled: gFilled, total: gTotal } = countGroupFilled(scores);
  const { filled: kFilled, total: kTotal } = countKnockoutFilled(picks);
  const maxPts  = calcMaxPotentialPts_sync(scores, picks);
  const scored  = await calcUserScore(userId);
  const pct     = Math.round(((gFilled + kFilled) / (gTotal + kTotal)) * 100) || 0;

  const hPts = document.getElementById("header-pts");
  if (hPts) hPts.textContent = scored.total;

  sc.innerHTML = `
    <div class="score-card"><div class="s-label">Pontuação real</div><div class="s-value" style="color:var(--green-mid)">${scored.total}</div></div>
    <div class="score-card"><div class="s-label">Jogos preenchidos</div><div class="s-value">${gFilled}/${gTotal}</div><div class="progress-bar"><div class="progress-fill" style="width:${Math.round(gFilled/gTotal*100)||0}%"></div></div></div>
    <div class="score-card"><div class="s-label">Mata-mata preenchido</div><div class="s-value">${kFilled}/${kTotal}</div><div class="progress-bar"><div class="progress-fill" style="width:${Math.round(kFilled/kTotal*100)||0}%"></div></div></div>
    <div class="score-card"><div class="s-label">Pontos potenciais</div><div class="s-value">${maxPts}</div></div>
    <div class="score-card"><div class="s-label">Conclusão geral</div><div class="s-value">${pct}%</div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>
  `;

  if (!sd) return;
  const summary = scored.koSummary || [];
  sd.innerHTML = `
    <h3 style="margin:1.5rem 0 .5rem;font-size:15px;color:var(--green-dark)">Pontuação — Fase de Grupos</h3>
    <table class="detail-table">
      <thead><tr><th>Jogo</th><th>Seu palpite</th><th>Resultado real</th><th>Pts</th></tr></thead>
      <tbody>
        ${scored.groupDetail.length
          ? scored.groupDetail.map(d=>`<tr><td>${d.match[0]} × ${d.match[1]}</td><td>${d.palpite}</td><td>${d.real}</td><td class="${d.pts>0?"pts-positive":"pts-zero"}">${d.pts}</td></tr>`).join("")
          : `<tr><td colspan="4" style="color:#94a3b8;font-style:italic">Nenhum resultado disponível ainda</td></tr>`}
      </tbody>
    </table>
    <h3 style="margin:1.5rem 0 .5rem;font-size:15px;color:var(--green-dark)">Pontuação — Mata-Mata</h3>
    <table class="detail-table">
      <thead><tr><th>Fase</th><th>Preenchido</th><th>Acertos</th><th>Pts</th></tr></thead>
      <tbody>
        ${summary.map(row=>`<tr><td>${row.name}</td><td>${row.filled}/${row.total}</td><td>${row.correct}/${row.total}</td><td class="${row.scoredPts>0?"pts-positive":"pts-zero"}">${row.scoredPts}</td></tr>`).join("")}
        <tr>
          <td>Campeão</td>
          <td>${scored.champPick&&scored.champPick!=="?"?"1/1":"0/1"}</td>
          <td>${scored.champPts>0?"1/1":"0/1"}</td>
          <td class="${scored.champPts>0?"pts-positive":"pts-zero"}">${scored.champPts}</td>
        </tr>
      </tbody>
    </table>`;
}
