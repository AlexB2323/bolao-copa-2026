// ============================================================
//  bracket.js — Lógica do chaveamento mata-mata
// ============================================================

function buildStageMatches(stageId, qualified, picks) {
  if (stageId === "r32") {
    return ROUND_OF_32_SLOTS.map(slot => ({
      id: slot.id, label: slot.label,
      t1: resolveSlot(slot.g1, qualified),
      t2: resolveSlot(slot.g2, qualified),
    }));
  }

  const prevMap = { r16:"r32", qf:"r16", sf:"qf", f:"sf" };
  const prev  = prevMap[stageId];
  const count = KNOCKOUT_STAGES.find(s => s.id === stageId).count;

  return Array.from({ length: count }, (_, i) => ({
    id:    `${stageId}_${i}`,
    label: `Jogo ${i + 1}`,
    t1:    picks[`${prev}_${i * 2}`]     || "?",
    t2:    picks[`${prev}_${i * 2 + 1}`] || "?",
  }));
}

function propagatePick(matchId, winner, picks) {
  if (winner === undefined) { delete picks[matchId]; }
  else picks[matchId] = winner;

  const nextStage = { r32:"r16", r16:"qf", qf:"sf", sf:"f" };
  const [stage, idxStr] = matchId.split("_");
  const idx  = parseInt(idxStr, 10);
  const next = nextStage[stage];
  if (!next) return;

  const nextId  = `${next}_${Math.floor(idx / 2)}`;
  const loserSlot = idx % 2; // 0=t1, 1=t2

  // Se o pick da próxima rodada era o perdedor, apaga em cascata
  const sibling = picks[`${stage}_${loserSlot === 0 ? idx + 1 : idx - 1}`];
  if (picks[nextId] && picks[nextId] !== winner && picks[nextId] !== sibling) {
    propagatePick(nextId, undefined, picks);
  }
}

function getChampion(picks) { return picks["f_0"]; }
