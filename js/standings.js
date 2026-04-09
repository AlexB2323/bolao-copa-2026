// ============================================================
//  standings.js — Cálculo de classificação nos grupos
// ============================================================

function calcStandings(groupKey, scores) {
  const teams = GROUPS[groupKey].map(name => ({
    name, pts:0, pld:0, w:0, d:0, l:0, gf:0, ga:0, gd:0
  }));

  getGroupMatches(groupKey).forEach((match, idx) => {
    const s = scores[`${groupKey}_${idx}`];
    if (!s || s.h === "" || s.a === "") return;
    const h = parseInt(s.h, 10), a = parseInt(s.a, 10);
    if (isNaN(h) || isNaN(a)) return;

    const home = teams.find(t => t.name === match[0]);
    const away = teams.find(t => t.name === match[1]);
    home.pld++; away.pld++;
    home.gf += h; home.ga += a; home.gd += h - a;
    away.gf += a; away.ga += h; away.gd += a - h;

    if (h > a)      { home.pts += 3; home.w++; away.l++; }
    else if (h < a) { away.pts += 3; away.w++; home.l++; }
    else            { home.pts++; away.pts++; home.d++; away.d++; }
  });

  return teams.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

function getQualified(scores) {
  const q = {};
  const allThirds = [];

  Object.keys(GROUPS).forEach(g => {
    const st = calcStandings(g, scores);
    q[`1_${g}`] = st[0] ? st[0].name : "?";
    q[`2_${g}`] = st[1] ? st[1].name : "?";
    if (st[2] && st[2].pld > 0) allThirds.push({ ...st[2], group: g });
  });

  allThirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  q.thirds = allThirds;
  return q;
}

function resolveSlot(slot, qualified) {
  if (slot.startsWith("1_") || slot.startsWith("2_")) return qualified[slot] || "?";
  if (slot.startsWith("t_")) {
    const t = qualified.thirds[parseInt(slot.split("_")[1], 10)];
    return t ? t.name : "?";
  }
  return "?";
}
