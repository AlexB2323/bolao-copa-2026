// ============================================================
//  ranking.js — Ranking (versão async/Firebase)
// ============================================================

async function buildRanking() {
  const users = await DB.getUsers();
  const rows  = await Promise.all(users.map(async user => {
    const scored = await calcUserScore(user.id);
    const scores = await DB.getUserScores(user.id);
    const picks  = await DB.getUserPicks(user.id);
    const maxPts = calcMaxPotentialPts_sync(scores, picks);
    const {filled:gF, total:gT} = countGroupFilled(scores);
    const {filled:kF, total:kT} = countKnockoutFilled(picks);
    return {
      id:user.id, name:user.name,
      total:scored.total, groupPts:scored.groupPts, koPts:scored.koPts,
      maxPts, filled:gF+kF, totalSlots:gT+kT, champion:scored.champPick,
    };
  }));
  return rows.sort((a,b) => b.total - a.total || b.maxPts - a.maxPts);
}

async function renderRanking(currentUserId) {
  const container = document.getElementById("ranking-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#94a3b8">Carregando ranking...</p>`;
  const ranking = await buildRanking();
  if (!ranking.length) { container.innerHTML=`<p style="color:#94a3b8;font-style:italic">Nenhum participante cadastrado ainda.</p>`; return; }
  const medals = ["🥇","🥈","🥉"];
  container.innerHTML = `
    <div class="ranking-table-wrap">
      <table class="ranking-table">
        <thead><tr><th>#</th><th>Participante</th><th>Grupos</th><th>Mata-Mata</th><th>Total</th><th>Potencial</th><th>Campeão</th></tr></thead>
        <tbody>
          ${ranking.map((u,i)=>`
            <tr class="${u.id===currentUserId?"ranking-me":""}">
              <td class="rank-pos">${medals[i]||(i+1)}</td>
              <td class="rank-name">${u.name}${u.id===currentUserId?' <span class="you-tag">Você</span>':""}</td>
              <td>${u.groupPts}</td><td>${u.koPts}</td>
              <td class="rank-total">${u.total}</td>
              <td class="rank-max">${u.maxPts}</td>
              <td>${u.champion&&u.champion!=="?"?getFlag(u.champion)+" "+u.champion:"—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function renderAdminRanking() {
  const container = document.getElementById("admin-ranking-container");
  if (!container) return;
  container.innerHTML = `<p style="color:#94a3b8">Carregando ranking...</p>`;
  const ranking = await buildRanking();
  if (!ranking.length) { container.innerHTML=`<p style="color:#94a3b8;font-style:italic">Nenhum participante cadastrado.</p>`; return; }
  const medals = ["🥇","🥈","🥉"];
  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button id="btn-copy-ranking" class="btn-primary" style="font-size:13px;padding:8px 16px">📋 Copiar Ranking</button>
    </div>
    <div id="copy-feedback" style="display:none;background:#dcfce7;color:#15803d;border:1px solid #86efac;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;margin-bottom:12px;text-align:center">✅ Ranking copiado!</div>
    <div class="ranking-table-wrap">
      <table class="ranking-table">
        <thead><tr><th>#</th><th>Participante</th><th>Grupos</th><th>Mata-Mata</th><th>Total</th><th>Potencial</th><th>Preenchimento</th><th>Campeão</th></tr></thead>
        <tbody>
          ${ranking.map((u,i)=>{
            const pct=Math.round((u.filled/u.totalSlots)*100)||0;
            return `<tr>
              <td class="rank-pos">${medals[i]||(i+1)}</td>
              <td class="rank-name">${u.name}</td>
              <td>${u.groupPts}</td><td>${u.koPts}</td>
              <td class="rank-total">${u.total}</td>
              <td class="rank-max">${u.maxPts}</td>
              <td><div style="display:flex;align-items:center;gap:6px">
                <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${pct}%"></div></div>
                <span style="font-size:12px;color:#64748b">${pct}%</span>
              </div></td>
              <td>${u.champion&&u.champion!=="?"?getFlag(u.champion)+" "+u.champion:"—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  document.getElementById("btn-copy-ranking").addEventListener("click", () => {
  let lastScore = null;
  let currentRank = 0;

  const MAX_LINE_CHARS = 28;
  const POINTS_WIDTH = 6;
  const LEFT_COL_WIDTH = MAX_LINE_CHARS - POINTS_WIDTH;

  const lastScoreValue = ranking[ranking.length - 1]?.total;

  function getScoreCount(score) {
    return ranking.filter(u => u.total === score).length;
  }

  function visualLength(text) {
    return Array.from(text).reduce((sum, char) => {
      return sum + (/[\u{1F300}-\u{1FAFF}]/u.test(char) ? 2 : 1);
    }, 0);
  }

  function fitLeft(text) {
    while (visualLength(text) > LEFT_COL_WIDTH) {
      text = Array.from(text).slice(0, -1).join("");
    }

    if (!text.endsWith(" ")) {
      text = text.slice(0, -1) + "…";
    }

    while (visualLength(text) < LEFT_COL_WIDTH) {
      text += " ";
    }

    return text;
  }

  const lines = ranking.map((u, i) => {
    let rankText = "";
    let emojiText = "";

    if (u.total !== lastScore) {
      currentRank = i + 1;
      rankText = `${currentRank}° `;
      lastScore = u.total;
    }

    const scoreCount = getScoreCount(u.total);

    if (currentRank === 1 && rankText) {
      emojiText = "🥇 ";
    } else if (currentRank === 2 && rankText) {
  emojiText = "🥈 ";
} else if (currentRank === 3 && rankText) {
  emojiText = "🥉 ";
}

    if (u.total === lastScoreValue) {
  rankText = "";
  emojiText = "🔦 ";
}

    const left = `${rankText}${emojiText}${u.name} - `;
    const points = `${u.total} pts`.padStart(POINTS_WIDTH, " ");

    return `${fitLeft(left)}${points}`;
  });

  const text = "```\n🏆 Ranking Bolão Copa 2026\n\n" + lines.join("\n") + "\n```";

  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });

  const fb = document.getElementById("copy-feedback");
  fb.style.display = "block";
  setTimeout(() => fb.style.display = "none", 3000);
});
}
