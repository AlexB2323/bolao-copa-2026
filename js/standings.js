// ============================================================
//  standings.js — Classificação com critérios FIFA oficiais
//
//  Critérios de desempate (dentro do grupo):
//  1. Pontos  2. Saldo de gols  3. Gols marcados
//  4. Confronto direto (só entre 2 times empatados)
//  5. Fair Play (cartões)
//
//  Para os melhores 3ºs colocados entre grupos diferentes,
//  os mesmos critérios 1-3 e 5 se aplicam (sem confronto
//  direto, pois jogaram em grupos distintos).
// ============================================================

/**
 * Calcula a classificação de um grupo.
 * @param {string} groupKey  - ex: "A"
 * @param {object} scores    - placares { "A_0":{h,a}, ... }
 * @param {object} [cards]   - cartões { "NomeTime":{y,yr,r,yr2}, ... } (opcional)
 */
function calcStandings(groupKey, scores, cards) {
  const teams = GROUPS[groupKey].map(name => ({
    name, pts:0, pld:0, w:0, d:0, l:0, gf:0, ga:0, gd:0,
    h2h: {}, // confronto direto contra cada adversário
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
    else            { home.pts++;    away.pts++; home.d++; away.d++; }

    // Registra confronto direto entre o par
    if (!home.h2h[away.name]) home.h2h[away.name] = { pts:0, gd:0, gf:0 };
    if (!away.h2h[home.name]) away.h2h[home.name] = { pts:0, gd:0, gf:0 };

    if (h > a)      { home.h2h[away.name].pts += 3; }
    else if (h < a) { away.h2h[home.name].pts += 3; }
    else            { home.h2h[away.name].pts++; away.h2h[home.name].pts++; }

    home.h2h[away.name].gd += h - a; home.h2h[away.name].gf += h;
    away.h2h[home.name].gd += a - h; away.h2h[home.name].gf += a;
  });

  // Fair Play: menor = melhor
  // amarelo=1, vermelho indireto (2 amarelos)=3, vermelho direto=4, amarelo+vermelho=5
  function fairPlay(name) {
    if (!cards || !cards[name]) return 0;
    const c = cards[name];
    return (c.y||0)*1 + (c.yr||0)*3 + (c.r||0)*4 + (c.yr2||0)*5;
  }

  // Comparador geral (critérios 1, 2, 3, 5)
  function compare(a, b) {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd  !== a.gd)  return b.gd  - a.gd;
    if (b.gf  !== a.gf)  return b.gf  - a.gf;
    return fairPlay(a.name) - fairPlay(b.name);
  }

  teams.sort(compare);

  // Aplica confronto direto (critério 4) em blocos de exatamente 2 times empatados
  const sorted = [];
  let i = 0;
  while (i < teams.length) {
    let j = i + 1;
    while (
      j < teams.length &&
      teams[j].pts === teams[i].pts &&
      teams[j].gd  === teams[i].gd  &&
      teams[j].gf  === teams[i].gf
    ) j++;

    const block = teams.slice(i, j);

    if (block.length === 2) {
      const [ta, tb] = block;
      const A = ta.h2h[tb.name] || { pts:0, gd:0, gf:0 };
      const B = tb.h2h[ta.name] || { pts:0, gd:0, gf:0 };
      if      (A.pts !== B.pts) block.sort((x,y) => (y.h2h[x.name]?.pts||0) - (x.h2h[y.name]?.pts||0));
      else if (A.gd  !== B.gd)  block.sort((x,y) => (y.h2h[x.name]?.gd ||0) - (x.h2h[y.name]?.gd ||0));
      else if (A.gf  !== B.gf)  block.sort((x,y) => (y.h2h[x.name]?.gf ||0) - (x.h2h[y.name]?.gf ||0));
      else block.sort((x,y) => fairPlay(x.name) - fairPlay(y.name));
    }
    // 3+ empatados: mantém critérios 1-3-5 (confronto direto entre 3+ requer mini-tabela)

    sorted.push(...block);
    i = j;
  }

  return sorted;
}

// ============================================================
//  getQualified
// ============================================================
function getQualified(scores, cards) {
  const q = {};
  const allThirds = [];

  Object.keys(GROUPS).forEach(g => {
    const st = calcStandings(g, scores, cards);
    q[`1_${g}`] = st[0] ? st[0].name : "?";
    q[`2_${g}`] = st[1] ? st[1].name : "?";
    if (st[2] && st[2].pld > 0) allThirds.push({ ...st[2], group: g });
  });

  // Melhores 3ºs: critérios 1→2→3→5 (sem confronto direto entre grupos distintos)
  function fairPlayThird(t) {
    if (!cards || !cards[t.name]) return 0;
    const c = cards[t.name];
    return (c.y||0)*1 + (c.yr||0)*3 + (c.r||0)*4 + (c.yr2||0)*5;
  }

  allThirds.sort((a, b) =>
    b.pts - a.pts ||
    b.gd  - a.gd  ||
    b.gf  - a.gf  ||
    fairPlayThird(a) - fairPlayThird(b)
  );

  q.thirds = allThirds;
  return q;
}

// ============================================================
//  getThirdsRanking — retorna todos os 3ºs com critério que
//  os separou, para exibição na tabela do admin
// ============================================================
function getThirdsRanking(scores, cards) {
  const allThirds = [];

  Object.keys(GROUPS).forEach(g => {
    const st = calcStandings(g, scores, cards);
    if (st[2] && st[2].pld > 0) {
      allThirds.push({ ...st[2], group: g });
    }
  });

  function fairPlayThird(t) {
    if (!cards || !cards[t.name]) return 0;
    const c = cards[t.name];
    return (c.y||0)*1 + (c.yr||0)*3 + (c.r||0)*4 + (c.yr2||0)*5;
  }

  // Ordena e marca critério decisivo
  allThirds.sort((a, b) =>
    b.pts - a.pts ||
    b.gd  - a.gd  ||
    b.gf  - a.gf  ||
    fairPlayThird(a) - fairPlayThird(b)
  );

  // Marca qual critério separou cada time do próximo
  return allThirds.map((t, i) => {
    if (i === allThirds.length - 1) return { ...t, criterion: "" };
    const next = allThirds[i + 1];
    let criterion = "";
    if (t.pts !== next.pts) criterion = "PTS";
    else if (t.gd !== next.gd) criterion = "SG";
    else if (t.gf !== next.gf) criterion = "GP";
    else criterion = "FP";
    return { ...t, criterion };
  });
}

function resolveSlot(slot, qualified) {
  if (slot.startsWith("1_") || slot.startsWith("2_")) return qualified[slot] || "?";
  if (slot.startsWith("t_")) {
    const t = qualified.thirds[parseInt(slot.split("_")[1], 10)];
    return t ? t.name : "?";
  }
  return "?";
}
