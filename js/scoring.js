// ============================================================
//  scoring.js — Cálculo de pontuação
//
//  LÓGICA DO MATA-MATA:
//  O usuário ganha pontos por cada time que ele colocou como
//  vencedor de um jogo e que REALMENTE se classificou naquela
//  fase — independente de qual jogo específico.
//
//  Exemplo: usuário colocou Brasil para vencer o Jogo 3 dos 16avos.
//  Se Brasil passou dos 16avos (mesmo que tenha sido em outro jogo),
//  o usuário ganha 6 pts.
//
//  Pontuação máxima possível:
//  Grupos:  72 jogos × 6 pts = 432 pts
//  16avos:  32 times × 6 pts =  96 pts  (user faz 16 picks, max 16 acertos × 6)
//  Oitavas: 16 times × 8 pts = 128 pts  ... não, 8 picks × 8 = 64
//
//  WAIT — relendo a regra:
//  32 classificados nos 16avos = 32×6 = 192? Não faz sentido pois user só faz 16 picks.
//
//  O modelo que dá 574:
//  32×6 + 16×8 + 8×12 + 4×17 + 2×25 + 40 = 574
//  Isso significa: o usuário escolhe times para CADA FASE e pontua
//  por cada time que realmente passou para aquela fase.
//  - 16avos: usuário palpita os 32 times que passam → max 32×6=192? 
//    Mas o usuário só faz 16 picks (1 vencedor por jogo).
//    Se cada pick vale 6 pts quando acerta: 16×6 = 96.
//
//  Recalculando 574: grupos(432) + mata(142)
//  142 = 16×6 + 8×? → não fecha.
//
//  A única combinação que dá 574 é 32×6+16×8+8×12+4×17+2×25+40
//  = times classificados em cada fase, não jogos.
//  Isso significa: o usuário escolhe 1 vencedor por jogo,
//  mas o sistema verifica se aquele time ESTÁ entre os classificados
//  da fase, não se ganhou aquele jogo específico.
//
//  Gabarito completo = acertar todos os 32 que passam dos 16avos (cada jogo 1 time = 16 acertos)
//  + 16 que passam das oitavas (8 acertos) + ... + campeão.
//  16×6 + 8×8 + 4×12 + 2×17 + 1×25 + 40 = 96+64+48+34+25+40 = 307. Não é 574.
//
//  Portanto 574 = 432(grupos) + 96+64+48+34+25+40... = 432+307 = 739. Não.
//
//  Única forma de 574: sem grupos, mata-mata = 574
//  16×6=96, 16×8=128... não.
//  OU: 32×6+16×8+8×12+4×17+2×25+40 = 192+128+96+68+50+40 = 574 ✓
//  Ou seja: o usuário pontua por CADA TIME que acerta em CADA FASE
//  (não apenas pelo vencedor do jogo, mas se o time passou para aquela fase)
//  e em cada fase há 32,16,8,4,2,1 times respectivamente.
//  Mas o usuário faz apenas 16+8+4+2+1=31 picks de vencedor...
//
//  INTERPRETAÇÃO FINAL (a única que faz sentido com 574):
//  A pontuação acumula: se você acertou um time nos 16avos,
//  você TAMBÉM ganha pontos nas fases seguintes se ele continuar avançando.
//  Ex: usuário colocou Brasil para vencer nos 16avos.
//  Brasil vence os 16avos → 6 pts
//  Brasil vence as oitavas → 8 pts (mesmo sem ter palpitado oitavas ainda)
//  etc.
//  Isso é o modelo "acumulativo" que dá o total correto.
//
//  Ou mais simples: o usuario escolhe 1 time por jogo em cada fase,
//  e pontua se o time escolhido PASSOU para a próxima fase,
//  mas as fases se acumulam (32+16+8+4+2+1 = 63 times no total seria muito).
//
//  DECISÃO: implementar exatamente o que o usuário descreveu:
//  acertar o time CLASSIFICADO na fase = pontos daquela fase.
//  O sistema compara cada pick do usuário com o conjunto de times
//  que REALMENTE se classificaram naquela fase.
// ============================================================

function calcGroupMatchPts(ph, pa, rh, ra) {
  const exact    = ph === rh && pa === ra;
  const colOk    = Math.sign(ph - pa) === Math.sign(rh - ra);
  const oneScore = ph === rh || pa === ra;
  if (exact)             return 6;
  if (colOk && oneScore) return 4;
  if (colOk)             return 3;
  if (oneScore)          return 1;
  return 0;
}

function isFilledMatchScore(s) {
  if (!s) return false;
  const h = parseInt(s.h, 10), a = parseInt(s.a, 10);
  return s.h !== "" && s.a !== "" && !isNaN(h) && !isNaN(a);
}

function isKnownTeam(t) {
  return typeof t === "string" && t.trim() !== "" && t !== "?";
}

/**
 * Extrai o conjunto de times classificados para cada fase
 * a partir do bracketData do admin.
 *
 * - r32: os 32 times que entram nos 16avos (t1 e t2 de cada jogo)
 * - r16: os 16 vencedores dos 16avos
 * - qf:  os 8 vencedores das oitavas
 * - sf:  os 4 vencedores das quartas
 * - f:   os 2 vencedores das semis (finalistas)
 * - champion: o campeão (vencedor da final)
 */
function getClassifiedTeams(bracketData) {
  const classified = {
    r32: new Set(), // 32 times que entram nos 16avos (t1+t2 de cada jogo)
    r16: new Set(), // 16 times que entram nas oitavas (t1+t2 de cada jogo)
    qf:  new Set(), // 8 times que entram nas quartas
    sf:  new Set(), // 4 times que entram nas semis
    f:   new Set(), // 2 finalistas
  };

  // r32: times definidos pelo admin nos 16avos (t1 e t2 de cada confronto)
  for (let i = 0; i < 16; i++) {
    const t1 = bracketData[`r32_${i}_t1`] || "";
    const t2 = bracketData[`r32_${i}_t2`] || "";
    if (isKnownTeam(t1)) classified.r32.add(t1);
    if (isKnownTeam(t2)) classified.r32.add(t2);
  }

  // r16: times definidos pelo admin nas oitavas (t1 e t2 de cada confronto)
  for (let i = 0; i < 8; i++) {
    const t1 = bracketData[`r16_${i}_t1`] || "";
    const t2 = bracketData[`r16_${i}_t2`] || "";
    if (isKnownTeam(t1)) classified.r16.add(t1);
    if (isKnownTeam(t2)) classified.r16.add(t2);
  }

  // qf: times definidos pelo admin nas quartas
  for (let i = 0; i < 4; i++) {
    const t1 = bracketData[`qf_${i}_t1`] || "";
    const t2 = bracketData[`qf_${i}_t2`] || "";
    if (isKnownTeam(t1)) classified.qf.add(t1);
    if (isKnownTeam(t2)) classified.qf.add(t2);
  }

  // sf: times definidos pelo admin nas semis
  for (let i = 0; i < 2; i++) {
    const t1 = bracketData[`sf_${i}_t1`] || "";
    const t2 = bracketData[`sf_${i}_t2`] || "";
    if (isKnownTeam(t1)) classified.sf.add(t1);
    if (isKnownTeam(t2)) classified.sf.add(t2);
  }

  // f: finalistas definidos pelo admin
  const ft1 = bracketData[`f_0_t1`] || "";
  const ft2 = bracketData[`f_0_t2`] || "";
  if (isKnownTeam(ft1)) classified.f.add(ft1);
  if (isKnownTeam(ft2)) classified.f.add(ft2);

  return classified;
}

// ---- Cálculo principal -------------------------------------
async function calcUserScore(userId) {
  const scores      = await DB.getUserScores(userId);
  const picks       = await DB.getUserPicks(userId);
  const realG       = await DB.getResultsGroups();
  const bracketData = await DB.getBracketData();

  let groupPts = 0, koPts = 0;
  const groupDetail = [];

  // ---- Grupos ----
  Object.keys(GROUPS).forEach(g => {
    getGroupMatches(g).forEach((match, idx) => {
      const p = scores[`${g}_${idx}`];
      const r = realG[`${g}_${idx}`];
      if (!isFilledMatchScore(p) || !isFilledMatchScore(r)) return;
      const ph = parseInt(p.h,10), pa = parseInt(p.a,10);
      const rh = parseInt(r.h,10), ra = parseInt(r.a,10);
      const pts = calcGroupMatchPts(ph, pa, rh, ra);
      groupPts += pts;
      groupDetail.push({ key:`${g}_${idx}`, match, palpite:`${ph}×${pa}`, real:`${rh}×${ra}`, pts });
    });
  });

  // ---- Mata-mata ----
  // Pontuação por fase: o usuário ganha pontos se o time que escolhou
  // para um confronto REALMENTE entrou naquela fase (t1 ou t2 definidos pelo admin).
  //
  // Máximo: 32×6 + 16×8 + 8×12 + 4×17 + 2×25 + 40 = 574 pts
  const classified  = getClassifiedTeams(bracketData);
  const stagePoints = { r32:6, r16:8, qf:12, sf:17, f:25 };
  const koDetail    = [];

  // Configuração: para cada fase, quantos jogos e quantos picks (t1+t2)
  const stageConfig = [
    { stage:"r32", count:16, classSet: classified.r32, pts: stagePoints.r32 },
    { stage:"r16", count:8,  classSet: classified.r16, pts: stagePoints.r16 },
    { stage:"qf",  count:4,  classSet: classified.qf,  pts: stagePoints.qf  },
    { stage:"sf",  count:2,  classSet: classified.sf,  pts: stagePoints.sf  },
    { stage:"f",   count:1,  classSet: classified.f,   pts: stagePoints.f   },
  ];

  stageConfig.forEach(({ stage, count, classSet, pts }) => {
    for (let i = 0; i < count; i++) {
      ["t1","t2"].forEach(side => {
        const pick = picks[`${stage}_${i}_${side}`] || "";
        if (!isKnownTeam(pick)) return;
        if (classSet.has(pick)) {
          koPts += pts;
          koDetail.push({ stage, matchIdx:i, side, pick, pts });
        }
      });
    }
  });

  // Campeão (bônus)
  const pickChamp = picks["f_0_winner"];
  const realChamp = bracketData["f_0_winner"];
  let champPts = 0;
  if (isKnownTeam(pickChamp) && isKnownTeam(realChamp) && pickChamp === realChamp) {
    champPts = KNOCKOUT_PTS.champion;
    koPts   += champPts;
  }

  // Sumário por fase
  const koSummary = buildKoSummary(picks, classified, bracketData);

  return {
    total: groupPts + koPts,
    groupPts, koPts,
    groupDetail, koDetail, koSummary,
    champPick: pickChamp, champReal: realChamp, champPts,
  };
}

function buildKoSummary(picks, classified, bracketData) {
  const stagePoints = { r32:6, r16:8, qf:12, sf:17, f:25 };

  const stageConfig = [
    { stage:"r32", name:"16avos de Final",  count:16, classSet: classified.r32, pts: stagePoints.r32, total:32 },
    { stage:"r16", name:"Oitavas de Final", count:8,  classSet: classified.r16, pts: stagePoints.r16, total:16 },
    { stage:"qf",  name:"Quartas de Final", count:4,  classSet: classified.qf,  pts: stagePoints.qf,  total:8  },
    { stage:"sf",  name:"Semifinal",        count:2,  classSet: classified.sf,  pts: stagePoints.sf,  total:4  },
    { stage:"f",   name:"Final",            count:1,  classSet: classified.f,   pts: stagePoints.f,   total:2  },
  ];

  return stageConfig.map(({ stage, name, count, classSet, pts, total }) => {
    let filled=0, correct=0;
    for (let i=0; i<count; i++) {
      ["t1","t2"].forEach(side => {
        const pick = picks[`${stage}_${i}_${side}`] || "";
        if (isKnownTeam(pick)) {
          filled++;
          if (classSet.has(pick)) correct++;
        }
      });
    }
    return { stage, name, ptsEach: pts, total, filled, correct, scoredPts: correct * pts };
  });
}

// ---- Potencial máximo (síncrono) ---------------------------
function calcMaxPotentialPts_sync(scores, picks) {
  let pts = 0;

  // Grupos: cada jogo preenchido = max 6pts
  Object.keys(GROUPS).forEach(g => {
    getGroupMatches(g).forEach((_, idx) => {
      if (isFilledMatchScore(scores[`${g}_${idx}`])) pts += 6;
    });
  });

  // Mata-mata: t1+t2 de cada fase
  const stageConfig = [
    { stage:"r32", count:16, pts:6  },
    { stage:"r16", count:8,  pts:8  },
    { stage:"qf",  count:4,  pts:12 },
    { stage:"sf",  count:2,  pts:17 },
    { stage:"f",   count:1,  pts:25 },
  ];
  stageConfig.forEach(({ stage, count, pts: p }) => {
    for (let i=0; i<count; i++) {
      if (isKnownTeam(picks[`${stage}_${i}_t1`])) pts += p;
      if (isKnownTeam(picks[`${stage}_${i}_t2`])) pts += p;
    }
  });

  // Campeão bônus
  if (isKnownTeam(picks["f_0_winner"])) pts += KNOCKOUT_PTS.champion;

  return pts;
}

function countGroupFilled(scores) {
  let filled=0, total=0;
  Object.keys(GROUPS).forEach(g => {
    const m = getGroupMatches(g); total += m.length;
    m.forEach((_, idx) => { if (isFilledMatchScore(scores[`${g}_${idx}`])) filled++; });
  });
  return { filled, total };
}

function countKnockoutFilled(picks) {
  let filled=0, total=0;
  const stageConfig = [
    { stage:"r32", count:16 },
    { stage:"r16", count:8  },
    { stage:"qf",  count:4  },
    { stage:"sf",  count:2  },
    { stage:"f",   count:1  },
  ];
  stageConfig.forEach(({ stage, count }) => {
    total += count * 2; // t1 + t2
    for (let i=0; i<count; i++) {
      if (isKnownTeam(picks[`${stage}_${i}_t1`])) filled++;
      if (isKnownTeam(picks[`${stage}_${i}_t2`])) filled++;
    }
  });
  // Campeão pick
  total += 1;
  if (isKnownTeam(picks["f_0_winner"])) filled++;
  return { filled, total };
}
