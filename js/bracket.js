// ============================================================
//  bracket.js — Chaveamento mata-mata MANUAL
//
//  Os times dos 16avos são definidos pelo admin via dropdowns.
//  As fases seguintes são preenchidas clicando no vencedor.
//
//  Storage /results/bracket:
//    r32_0: { t1:"Brasil", t2:"México" }  ← admin define
//    r32_0_winner: "Brasil"               ← vencedor registrado
//    r16_0_winner: "..."
//    ...
//
//  NOTA: KNOCKOUT_STAGES e KNOCKOUT_PTS vivem em data.js
// ============================================================

/**
 * Retorna todos os times (todos os grupos) ordenados alfabeticamente.
 */
function getAllTeams() {
  return Object.values(GROUPS).flat().sort((a, b) => a.localeCompare(b, "pt"));
}

/**
 * Registra um vencedor e limpa em cascata se necessário.
 */
function setWinner(matchId, winner, bracketData) {
  if (winner === undefined) {
    delete bracketData[`${matchId}_winner`];
  } else {
    bracketData[`${matchId}_winner`] = winner;
  }

  const nextStage = { r32:"r16", r16:"qf", qf:"sf", sf:"f" };
  const parts = matchId.split("_");
  const stage = parts[0];
  const idx   = parseInt(parts[1], 10);
  const next  = nextStage[stage];
  if (!next) return;

  const nextMatchIdx  = Math.floor(idx / 2);
  const nextMatchId   = `${next}_${nextMatchIdx}`;
  const nextWinnerKey = `${nextMatchId}_winner`;
  const siblingIdx    = idx % 2 === 0 ? idx + 1 : idx - 1;
  const sibling       = bracketData[`${stage}_${siblingIdx}_winner`];
  const nextPick      = bracketData[nextWinnerKey];

  if (nextPick && nextPick !== winner && nextPick !== sibling) {
    delete bracketData[nextWinnerKey];
    setWinner(nextMatchId, undefined, bracketData);
  }
}

/**
 * Remove um vencedor em cascata (limpeza).
 */
function clearWinner(matchId, bracketData) {
  const key = `${matchId}_winner`;
  if (!bracketData[key]) return;
  delete bracketData[key];

  const nextStage = { r32:"r16", r16:"qf", qf:"sf", sf:"f" };
  const parts = matchId.split("_");
  const stage = parts[0];
  const next  = nextStage[stage];
  if (!next) return;

  const nextMatchId = `${next}_${Math.floor(parseInt(parts[1], 10) / 2)}`;
  clearWinner(nextMatchId, bracketData);
}

function getChampion(bracketData) {
  return bracketData["f_0_winner"];
}
