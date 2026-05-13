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
    r32: new Set(), // times que ENTRARAM nos 16avos (os 32 classificados da fase de grupos)
    r16: new Set(), // vencedores dos 16avos (classificados para as oitavas)
    qf:  new Set(), // vencedores das oitavas
    sf:  new Set(), // vencedores das quartas
    f:   new Set(), // vencedores das semis (finalistas)
  };

  // r32: times que participam dos 16avos
  for (let i = 0; i < 16; i++) {
    const t1 = bracketData[`r32_${i}_t1`] || "";
    const t2 = bracketData[`r32_${i}_t2`] || "";
    if (isKnownTeam(t1)) classified.r32.add(t1);
    if (isKnownTeam(t2)) classified.r32.add(t2);
  }

  // r16: vencedores dos 16avos
  for (let i = 0; i < 16; i++) {
    const w = bracketData[`r32_${i}_winner`];
    if (isKnownTeam(w)) classified.r16.add(w);
  }

  // qf: vencedores das oitavas
  for (let i = 0; i < 8; i++) {
    const w = bracketData[`r16_${i}_winner`];
    if (isKnownTeam(w)) classified.qf.add(w);
  }

  // sf: vencedores das quartas
  for (let i = 0; i < 4; i++) {
    const w = bracketData[`qf_${i}_winner`];
    if (isKnownTeam(w)) classified.sf.add(w);
  }

  // f: vencedores das semis (finalistas)
  for (let i = 0; i < 2; i++) {
    const w = bracketData[`sf_${i}_winner`];
    if (isKnownTeam(w)) classified.f.add(w);
  }

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
  // Para cada pick do usuário, verifica se o time escolhido
  // está no conjunto de times classificados naquela fase.
  const classified  = getClassifiedTeams(bracketData);
  const stagePoints = { r32:6, r16:8, qf:12, sf:17, f:25 };
  const koDetail    = [];

  // Mapeamento: fase do pick → conjunto de classificados a verificar
  // Ex: usuário escolheu vencedor de r32_0 → verifica se o time está em classified.r16
  // (porque acertar o vencedor dos 16avos = acertar quem foi para as oitavas)
  const stageToClassified = {
    r32: classified.r16, // acertar vencedor dos 16avos = time foi para oitavas
    r16: classified.qf,  // acertar vencedor das oitavas = time foi para quartas
    qf:  classified.sf,  // etc.
    sf:  classified.f,
    f:   null,           // final tratada separado (campeão)
  };

  // 16avos: também pontua se o time ENTROU nos 16avos
  // O usuário escolhe os times dos confrontos (r32_i_t1 e r32_i_t2)
  // Se esses times realmente estão nos 16avos (classified.r32), ganha 6 pts cada
  for (let i = 0; i < 16; i++) {
    const userT1 = picks[`r32_${i}_t1`] || "";
    const userT2 = picks[`r32_${i}_t2`] || "";

    if (isKnownTeam(userT1) && classified.r32.has(userT1)) {
      koPts += stagePoints.r32;
      koDetail.push({ stage:"r32", matchIdx:i, side:"t1", pick:userT1, pts:stagePoints.r32 });
    }
    if (isKnownTeam(userT2) && classified.r32.has(userT2)) {
      koPts += stagePoints.r32;
      koDetail.push({ stage:"r32", matchIdx:i, side:"t2", pick:userT2, pts:stagePoints.r32 });
    }
  }

  // Oitavas em diante: pontua pelo vencedor escolhido
  const laterStages = ["r16", "qf", "sf"];
  // Para r16: vencedor do r32 escolhido pelo user
  // Para qf: vencedor do r16 escolhido pelo user
  // Para sf: vencedor do qf escolhido pelo user

  // r16 (oitavas): acertar quem saiu dos 16avos
  const stageCountMap = { r32:16, r16:8, qf:4, sf:2, f:1 };

  ["r32","r16","qf","sf"].forEach(stage => {
    const count     = stageCountMap[stage];
    const classSet  = stageToClassified[stage];
    if (!classSet) return;

    for (let i = 0; i < count; i++) {
      const pick = picks[`${stage}_${i}_winner`];
      if (!isKnownTeam(pick)) continue;
      if (classSet.has(pick)) {
        const pts = stagePoints[{ r32:"r16", r16:"qf", qf:"sf", sf:"f" }[stage]];
        koPts += pts;
        koDetail.push({ stage, matchIdx:i, pick, pts });
      } else {
        koDetail.push({ stage, matchIdx:i, pick, pts:0 });
      }
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

  // 16avos: conta t1 e t2 de cada jogo
  let r32Filled=0, r32Correct=0;
  for (let i=0; i<16; i++) {
    ["t1","t2"].forEach(side => {
      const pick = picks[`r32_${i}_${side}`] || "";
      if (isKnownTeam(pick)) {
        r32Filled++;
        if (classified.r32.has(pick)) r32Correct++;
      }
    });
  }

  const stageToClassified = {
    r32: classified.r16,
    r16: classified.qf,
    qf:  classified.sf,
    sf:  classified.f,
  };
  const stageCountMap = { r32:16, r16:8, qf:4, sf:2 };
  const stageNextPts  = { r32: stagePoints.r16, r16: stagePoints.qf, qf: stagePoints.sf, sf: stagePoints.f };

  const rows = [
    {
      stage:"r32", name:"16avos de Final",
      ptsEach: stagePoints.r32, total: 32,
      filled: r32Filled, correct: r32Correct,
      scoredPts: r32Correct * stagePoints.r32,
    }
  ];

  ["r32","r16","qf","sf"].forEach(stage => {
    const count    = stageCountMap[stage];
    const classSet = stageToClassified[stage];
    const ptsEach  = stageNextPts[stage];
    const nameMap  = { r32:"Oitavas de Final", r16:"Quartas de Final", qf:"Semifinal", sf:"Final" };
    let filled=0, correct=0;
    for (let i=0; i<count; i++) {
      const pick = picks[`${stage}_${i}_winner`];
      if (isKnownTeam(pick)) { filled++; if(classSet && classSet.has(pick)) correct++; }
    }
    rows.push({ stage, name: nameMap[stage], ptsEach, total: count, filled, correct, scoredPts: correct * ptsEach });
  });

  // Final (campeão)
  const pickFinal = picks["f_0_winner"];
  const champCorrect = isKnownTeam(pickFinal) && classified.f.has(pickFinal) ? 1 : 0;
  rows.push({ stage:"f", name:"Final (Campeão)", ptsEach: stagePoints.f, total:1, filled: isKnownTeam(pickFinal)?1:0, correct: champCorrect, scoredPts: champCorrect * stagePoints.f });

  return rows;
}

// ---- Potencial máximo (síncrono) ---------------------------
function calcMaxPotentialPts_sync(scores, picks) {
  let pts = 0;

  // Grupos
  Object.keys(GROUPS).forEach(g => {
    getGroupMatches(g).forEach((_, idx) => {
      if (isFilledMatchScore(scores[`${g}_${idx}`])) pts += 6;
    });
  });

  // Mata-mata: cada pick preenchido conta como potencial máximo
  // 16avos: t1 e t2 de cada jogo
  for (let i=0; i<16; i++) {
    if (isKnownTeam(picks[`r32_${i}_t1`])) pts += 6;
    if (isKnownTeam(picks[`r32_${i}_t2`])) pts += 6;
  }
  // Demais fases: vencedor escolhido
  const stagePoints = { r32:8, r16:12, qf:17, sf:25 }; // pts da PRÓXIMA fase
  ["r32","r16","qf","sf"].forEach(stage => {
    const count = { r32:16, r16:8, qf:4, sf:2 }[stage];
    for (let i=0; i<count; i++) {
      if (isKnownTeam(picks[`${stage}_${i}_winner`])) pts += stagePoints[stage];
    }
  });
  if (isKnownTeam(picks["f_0_winner"])) pts += 25 + KNOCKOUT_PTS.champion; // final + campeão

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
  // 16avos: 32 slots (t1+t2 de cada jogo)
  total += 32;
  for (let i=0; i<16; i++) {
    if (isKnownTeam(picks[`r32_${i}_t1`])) filled++;
    if (isKnownTeam(picks[`r32_${i}_t2`])) filled++;
  }
  // Vencedores: r32(16) + r16(8) + qf(4) + sf(2) + f(1) = 31
  const stageCountMap = { r32:16, r16:8, qf:4, sf:2, f:1 };
  Object.entries(stageCountMap).forEach(([stage, count]) => {
    total += count;
    for (let i=0; i<count; i++) {
      if (isKnownTeam(picks[`${stage}_${i}_winner`])) filled++;
    }
  });
  return { filled, total };
}
