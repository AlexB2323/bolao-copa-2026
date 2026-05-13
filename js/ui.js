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

  let saveTimer = null;
  fresh.addEventListener("input", async e => {
    const el = e.target;
    if (!el.classList.contains("score-input")) return;
    const { group, idx, side } = el.dataset;
    const key = `${group}_${idx}`;
    el.classList.toggle("filled", el.value !== "");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const cur = await DB.getUserScores(userId);
      if (!cur[key]) cur[key] = { h:"", a:"" };
      cur[key][side] = el.value;
      await DB.saveUserScores(userId, cur);
      if (onChangeCallback) await onChangeCallback(userId);
    }, 600);
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
async function renderBracket(userId, containerId, onPickCallback) {
  const cid = containerId || "bracket-container";
  const old = document.getElementById(cid);
  if (!old) return;

  // Cria novo container e substitui o antigo — descarta TODOS os listeners acumulados
  const container = document.createElement("div");
  container.id        = old.id;
  container.className = old.className;
  old.replaceWith(container);

  const picks    = await DB.getUserPicks(userId);
  const allTeams = getAllTeams();
  const prefix   = cid; // prefixo para IDs únicos por container

  /* ---- 16avos: dois selects + radio vencedor ---- */
  const r32Stage = document.createElement("div");
  r32Stage.className = "bracket-stage";

  const r32Header = document.createElement("div");
  r32Header.className = "stage-header";
  r32Header.innerHTML = `<span class="stage-name">16avos de Final</span><span class="stage-pts">6 pts/acerto</span>`;
  r32Stage.appendChild(r32Header);

  const r32Grid = document.createElement("div");
  r32Grid.className = "bracket-matches";
  r32Stage.appendChild(r32Grid);
  container.appendChild(r32Stage);

  for (let i = 0; i < 16; i++) {
    const t1Val  = picks[`r32_${i}_t1`]     || "";
    const t2Val  = picks[`r32_${i}_t2`]     || "";
    const winner = picks[`r32_${i}_winner`] || "";

    const md = document.createElement("div");
    md.className = "bracket-match";
    md.innerHTML = `<div class="bracket-match-label">Jogo ${i+1}</div>`;

    [
      { side:"t1", val: t1Val },
      { side:"t2", val: t2Val },
    ].forEach(({ side, val }, num) => {
      const isWin = val !== "" && winner === val;

      const row = document.createElement("div");
      row.style.cssText = `display:flex;align-items:center;gap:6px;padding:7px 10px;${num===0?"border-bottom:1px solid var(--gray-100)":""}`;
      if (isWin) row.style.background = "#f0fdf4";

      const radio = document.createElement("input");
      radio.type    = "radio";
      radio.name    = `${prefix}-winner-${i}`;
      radio.checked = isWin;
      radio.title   = "Meu palpite de vencedor";
      radio.style.cssText = "accent-color:var(--green-mid);cursor:pointer;width:15px;height:15px;flex-shrink:0";

      const sel = makeUserTeamSelect(allTeams, val, `${prefix}-r32-${side}-${i}`);

      row.appendChild(radio);
      row.appendChild(sel);
      md.appendChild(row);

      sel.addEventListener("change", async () => {
        const cur = await DB.getUserPicks(userId);
        cur[`r32_${i}_${side}`] = sel.value;
        const curWinner = cur[`r32_${i}_winner`] || "";
        const otherKey  = `r32_${i}_${side === "t1" ? "t2" : "t1"}`;
        const otherVal  = cur[otherKey] || "";
        if (curWinner && curWinner !== sel.value && curWinner !== otherVal) {
          delete cur[`r32_${i}_winner`];
          propagateClearUser(`r32_${i}`, cur);
        }
        await DB.saveUserPicks(userId, cur);
        if (onPickCallback) await onPickCallback(userId);
        await renderBracket(userId, containerId, onPickCallback);
      });

      radio.addEventListener("change", async () => {
        if (!sel.value) { radio.checked = false; return; }
        const cur = await DB.getUserPicks(userId);
        cur[`r32_${i}_${side}`] = sel.value;
        cur[`r32_${i}_winner`]  = sel.value;
        propagateClearUser(`r32_${i}`, cur);
        await DB.saveUserPicks(userId, cur);
        if (onPickCallback) await onPickCallback(userId);
        await renderBracket(userId, containerId, onPickCallback);
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

    const stageHeader = document.createElement("div");
    stageHeader.className = "stage-header";
    stageHeader.innerHTML = `<span class="stage-name">${stage.name}</span><span class="stage-pts">${stage.ptsLabel}</span>`;
    stageDiv.appendChild(stageHeader);

    const grid = document.createElement("div");
    grid.className = "bracket-matches";
    stageDiv.appendChild(grid);
    container.appendChild(stageDiv);

    for (let i = 0; i < count; i++) {
      const t1     = picks[`${prev}_${i*2}_winner`]   || "?";
      const t2     = picks[`${prev}_${i*2+1}_winner`] || "?";
      const winner = picks[`${stage.id}_${i}_winner`] || "";

      const md = document.createElement("div"); md.className = "bracket-match";
      md.innerHTML = `<div class="bracket-match-label">Jogo ${i+1}</div>`;

      [t1, t2].forEach((team, ti) => {
        if (ti === 1) { const s=document.createElement("div"); s.className="bracket-sep"; md.appendChild(s); }
        const unk      = !team || team === "?";
        const selected = !unk && winner === team;
        const tDiv     = document.createElement("div");
        tDiv.className = `bracket-team${selected?" selected":""}${unk?" unknown":""}`;
        tDiv.dataset.matchId = `${stage.id}_${i}`;
        tDiv.dataset.team    = team;
        tDiv.innerHTML = `
          <span class="bracket-flag">${unk?"❓":getFlag(team)}</span>
          <span>${unk?"A definir":team}</span>
          ${selected?'<span style="margin-left:auto;color:var(--green-light);font-weight:700">✓</span>':""}`;
        md.appendChild(tDiv);
      });
      grid.appendChild(md);
    }
  });

  // Campeão escolhido
  const champion = picks["f_0_winner"];
  if (champion && champion !== "?") {
    const box = document.createElement("div");
    box.className = "champion-box";
    box.innerHTML = `<div class="champion-label">⭐ Meu Campeão — 40 pts ⭐</div><div class="champion-name">${getFlag(champion)} ${champion}</div>`;
    container.appendChild(box);
  }

  if (!onPickCallback) return;

  container.addEventListener("click", async e => {
    const el = e.target.closest(".bracket-team");
    if (!el || el.classList.contains("unknown")) return;
    const matchId = el.dataset.matchId;
    const team    = el.dataset.team;
    if (!matchId || !team || team === "?") return;

    const cur = await DB.getUserPicks(userId);
    cur[`${matchId}_winner`] = team;
    propagateClearUser(matchId, cur);
    await DB.saveUserPicks(userId, cur);
    if (onPickCallback) await onPickCallback(userId);
    await renderBracket(userId, containerId, onPickCallback);
  });
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
