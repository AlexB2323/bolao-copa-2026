// ============================================================
//  ui.js — Renderização (versão async/Firebase)
// ============================================================

/* ---- Fase de Grupos --------------------------------------- */

async function renderGroups(userId, containerId, onChangeCallback) {
  const oldContainer = document.getElementById(containerId || "groups-container");
  if (!oldContainer) return;

  const container = oldContainer.cloneNode(false);
  oldContainer.parentNode.replaceChild(container, oldContainer);

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
      <div class="group-card-body"></div>
    `;
    container.appendChild(card);

    const body = card.querySelector(".group-card-body");
    matches.forEach((match, idx) => {
      const key = `${g}_${idx}`;
      const s   = scores[key] || { h:"", a:"" };
      const row = document.createElement("div");
      row.className = "match-row";
      row.innerHTML = `
        <div class="team-left">
          <span class="team-flag">${getFlag(match[0])}</span>
          <span>${match[0]}</span>
        </div>
        <input class="score-input ${s.h !== "" ? "filled" : ""}" type="number"
          min="0" max="20" placeholder="–" value="${s.h}"
          data-group="${g}" data-idx="${idx}" data-side="h" inputmode="numeric" />
        <span class="vs-sep">×</span>
        <input class="score-input ${s.a !== "" ? "filled" : ""}" type="number"
          min="0" max="20" placeholder="–" value="${s.a}"
          data-group="${g}" data-idx="${idx}" data-side="a" inputmode="numeric" />
        <div class="team-right">
          <span class="team-flag">${getFlag(match[1])}</span>
          <span>${match[1]}</span>
        </div>
      `;
      body.appendChild(row);
    });
  });

  // Debounce para não salvar a cada tecla
  let saveTimer = null;

  container.addEventListener("input", async e => {
    const el = e.target;
    if (!el.classList.contains("score-input")) return;

    const { group, idx, side } = el.dataset;
    const key = `${group}_${idx}`;

    el.classList.toggle("filled", el.value !== "");

    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const current = await DB.getUserScores(userId);
      if (!current[key]) current[key] = { h:"", a:"" };
      current[key][side] = el.value;
      await DB.saveUserScores(userId, current);
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
      <div class="group-card-header">
        <span class="group-card-title">GRUPO ${g}</span>
      </div>
      <div class="group-card-body">
        <table class="standing-table">
          <thead><tr><th>Seleção</th><th>J</th><th>P</th><th>SG</th><th>GP</th></tr></thead>
          <tbody>
            ${st.map((t, i) => `
              <tr class="${i<2?"row-q":i===2?"row-t":"row-e"}">
                <td title="${t.name}">${getFlag(t.name)} ${t.name}</td>
                <td>${t.pld}</td><td>${t.pts}</td>
                <td>${t.gd > 0 ? "+"+t.gd : t.gd}</td><td>${t.gf}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
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
        ? thirds.map((t, i) => `
          <span class="third-chip">
            ${i+1}. ${getFlag(t.name)} ${t.name}
            <span style="opacity:.6;font-size:11px">(${t.pts}pts · Gr.${t.group})</span>
          </span>`).join("")
        : "<span style='font-size:13px;color:#94a3b8'>Preencha os jogos para ver</span>"}
    </div>
  `;
}

/* ---- Mata-Mata -------------------------------------------- */

async function renderBracket(userId, containerId, onPickCallback, scoresOverride) {
  const oldContainer = document.getElementById(containerId || "bracket-container");
  if (!oldContainer) return;

  const container = oldContainer.cloneNode(false);
  oldContainer.parentNode.replaceChild(container, oldContainer);

  const scores    = scoresOverride || await DB.getUserScores(userId);
  const picks     = await DB.getUserPicks(userId);
  const qualified = getQualified(scores);

  KNOCKOUT_STAGES.forEach(stage => {
    const matches  = buildStageMatches(stage.id, qualified, picks);
    const stageDiv = document.createElement("div");
    stageDiv.className = "bracket-stage";
    stageDiv.innerHTML = `
      <div class="stage-header">
        <span class="stage-name">${stage.name}</span>
        <span class="stage-pts">${stage.ptsLabel}</span>
      </div>
      <div class="bracket-matches"></div>
    `;
    container.appendChild(stageDiv);

    const grid = stageDiv.querySelector(".bracket-matches");
    matches.forEach(match => {
      const pickedTeam = picks[match.id];
      const matchDiv   = document.createElement("div");
      matchDiv.className = "bracket-match";
      matchDiv.innerHTML = `<div class="bracket-match-label">${match.label}</div>`;

      [match.t1, match.t2].forEach((team, ti) => {
        if (ti === 1) { const sep = document.createElement("div"); sep.className = "bracket-sep"; matchDiv.appendChild(sep); }
        const unknown  = !team || team === "?";
        const selected = pickedTeam === team && !unknown;
        const tDiv     = document.createElement("div");
        tDiv.className = `bracket-team${selected?" selected":""}${unknown?" unknown":""}`;
        tDiv.dataset.match = match.id;
        tDiv.dataset.team  = team;
        tDiv.innerHTML = `
          <span class="bracket-flag">${unknown ? "❓" : getFlag(team)}</span>
          <span>${unknown ? "A definir" : team}</span>
        `;
        matchDiv.appendChild(tDiv);
      });
      grid.appendChild(matchDiv);
    });
  });

  const champion = picks["f_0"];
  if (champion && champion !== "?") {
    const box = document.createElement("div");
    box.className = "champion-box";
    box.innerHTML = `
      <div class="champion-label">⭐ Campeão — 40 pts ⭐</div>
      <div class="champion-name">${getFlag(champion)} ${champion}</div>
    `;
    container.appendChild(box);
  }

  if (!onPickCallback) return;

  container.addEventListener("click", async e => {
    const el = e.target.closest(".bracket-team");
    if (!el || el.classList.contains("unknown")) return;

    const matchId = el.dataset.match;
    const team    = el.dataset.team;

    const currentPicks = await DB.getUserPicks(userId);
    propagatePick(matchId, team, currentPicks);
    await DB.saveUserPicks(userId, currentPicks);

    if (onPickCallback) await onPickCallback(userId);
    await renderBracket(userId, containerId, onPickCallback, scoresOverride);
  });
}

/* ---- Pontuação -------------------------------------------- */

async function updateScoreCards(userId) {
  const sc = document.getElementById("score-cards");
  const sd = document.getElementById("score-detail");
  if (!sc) return;

  const scores = await DB.getUserScores(userId);
  const picks  = await DB.getUserPicks(userId);

  const { filled: gFilled, total: gTotal } = countGroupFilled(scores);
  const { filled: kFilled, total: kTotal } = countKnockoutFilled(scores, picks);
  const maxPts = calcMaxPotentialPts_sync(scores, picks);
  const scored = await calcUserScore(userId);
  const pct    = Math.round(((gFilled + kFilled) / (gTotal + kTotal)) * 100) || 0;

  const hPts = document.getElementById("header-pts");
  if (hPts) hPts.textContent = scored.total;

  sc.innerHTML = `
    <div class="score-card">
      <div class="s-label">Pontuação real</div>
      <div class="s-value" style="color:var(--green-mid)">${scored.total}</div>
    </div>
    <div class="score-card">
      <div class="s-label">Jogos preenchidos</div>
      <div class="s-value">${gFilled}/${gTotal}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(gFilled/gTotal*100)||0}%"></div></div>
    </div>
    <div class="score-card">
      <div class="s-label">Mata-mata preenchido</div>
      <div class="s-value">${kFilled}/${kTotal}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(kFilled/kTotal*100)||0}%"></div></div>
    </div>
    <div class="score-card">
      <div class="s-label">Pontos potenciais</div>
      <div class="s-value">${maxPts}</div>
    </div>
    <div class="score-card">
      <div class="s-label">Conclusão geral</div>
      <div class="s-value">${pct}%</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
  `;

  if (!sd) return;
  const summary = scored.koSummary || [];

  sd.innerHTML = `
    <h3 style="margin:1.5rem 0 .5rem;font-size:15px;color:var(--green-dark)">Pontuação — Fase de Grupos</h3>
    <p style="font-size:13px;color:#64748b;margin-bottom:.5rem">${scored.groupDetail.length} jogos com resultado disponível</p>
    <table class="detail-table">
      <thead><tr><th>Jogo</th><th>Seu palpite</th><th>Resultado real</th><th>Pts</th></tr></thead>
      <tbody>
        ${scored.groupDetail.length
          ? scored.groupDetail.map(d => `
            <tr>
              <td>${d.match[0]} × ${d.match[1]}</td>
              <td>${d.palpite}</td><td>${d.real}</td>
              <td class="${d.pts > 0 ? "pts-positive" : "pts-zero"}">${d.pts}</td>
            </tr>`).join("")
          : `<tr><td colspan="4" style="color:#94a3b8;font-style:italic">Nenhum resultado disponível ainda</td></tr>`}
      </tbody>
    </table>
    <h3 style="margin:1.5rem 0 .5rem;font-size:15px;color:var(--green-dark)">Pontuação — Mata-Mata</h3>
    <table class="detail-table">
      <thead><tr><th>Fase</th><th>Preenchido</th><th>Acertos</th><th>Pts</th></tr></thead>
      <tbody>
        ${summary.map(row => `
          <tr>
            <td>${row.name}</td>
            <td>${row.filled}/${row.total}</td>
            <td>${row.correct !== undefined ? row.correct+"/"+row.total : "—"}</td>
            <td class="${row.scoredPts > 0 ? "pts-positive" : "pts-zero"}">${row.scoredPts || 0}</td>
          </tr>`).join("")}
        <tr>
          <td>Campeão</td>
          <td>${scored.champPick && scored.champPick !== "?" ? "1/1" : "0/1"}</td>
          <td>${scored.champPts > 0 ? "1/1" : "0/1"}</td>
          <td class="${scored.champPts > 0 ? "pts-positive" : "pts-zero"}">${scored.champPts}</td>
        </tr>
      </tbody>
    </table>
  `;
}
