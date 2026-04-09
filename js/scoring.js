// ============================================================
//  scoring.js — Cálculo de pontuação (versão async/Firebase)
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

const KO_TEAM_RULES = [
  { stage:"r32", name:"16avos de Final",  ptsEach:6,  total:32 },
  { stage:"r16", name:"Oitavas de Final", ptsEach:8,  total:16 },
  { stage:"qf",  name:"Quartas de Final", ptsEach:12, total:8  },
  { stage:"sf",  name:"Semifinal",        ptsEach:17, total:4  },
  { stage:"f",   name:"Final",            ptsEach:25, total:2  },
];

function isKnownTeam(t)        { return typeof t === "string" && t.trim() !== "" && t !== "?"; }
function isFilledMatchScore(s) { if (!s) return false; const h=parseInt(s.h,10),a=parseInt(s.a,10); return s.h!==""&&s.a!==""&&!isNaN(h)&&!isNaN(a); }
function uniqTeams(arr)        { return [...new Set((arr||[]).filter(isKnownTeam))]; }

function getQualifiedForKnockout(scores) {
  const q = {}; const allThirds = [];
  Object.keys(GROUPS).forEach(g => {
    const complete = getGroupMatches(g).every((_,idx) => isFilledMatchScore(scores[`${g}_${idx}`]));
    if (!complete) { q[`1_${g}`]="?"; q[`2_${g}`]="?"; return; }
    const st = calcStandings(g, scores);
    q[`1_${g}`] = st[0]?st[0].name:"?";
    q[`2_${g}`] = st[1]?st[1].name:"?";
    if (st[2]) allThirds.push({...st[2],group:g});
  });
  allThirds.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
  q.thirds = allThirds;
  return q;
}

function getR32TeamsFromGroupScores(scores) {
  const qualified = getQualifiedForKnockout(scores);
  return uniqTeams(ROUND_OF_32_SLOTS.flatMap(slot=>[resolveSlot(slot.g1,qualified),resolveSlot(slot.g2,qualified)]));
}

function getWinnerTeamsFromStore(store, stageId) {
  const info = KNOCKOUT_STAGES.find(s=>s.id===stageId);
  const count = info?info.count:0;
  return uniqTeams(Array.from({length:count},(_,i)=>store[`${stageId}_${i}`]));
}

function getKnockoutTeamsByStage(groupScores, knockoutStore) {
  return {
    r32: getR32TeamsFromGroupScores(groupScores),
    r16: getWinnerTeamsFromStore(knockoutStore,"r32"),
    qf:  getWinnerTeamsFromStore(knockoutStore,"r16"),
    sf:  getWinnerTeamsFromStore(knockoutStore,"qf"),
    f:   getWinnerTeamsFromStore(knockoutStore,"sf"),
  };
}

function buildKnockoutSummary(userGroupScores, userPicks, realGroupScores, realKO) {
  const userStages = getKnockoutTeamsByStage(userGroupScores, userPicks);
  const realStages = getKnockoutTeamsByStage(realGroupScores, realKO);

  return KO_TEAM_RULES.map(rule => {
    const predicted   = userStages[rule.stage]||[];
    const official    = realStages[rule.stage]||[];
    const officialSet = new Set(official);
    const correct     = predicted.filter(t=>officialSet.has(t));
    return {
      stage:rule.stage, name:rule.name, ptsEach:rule.ptsEach, total:rule.total,
      filled:predicted.length, correct:correct.length,
      scoredPts:correct.length*rule.ptsEach, potPts:predicted.length*rule.ptsEach,
    };
  });
}

// Versão async — lê do Firebase
async function calcUserScore(userId) {
  const scores = await DB.getUserScores(userId);
  const picks  = await DB.getUserPicks(userId);
  const realG  = await DB.getResultsGroups();
  const realKO = await DB.getResultsKO();

  let groupPts=0, koPts=0;
  const groupDetail=[];

  Object.keys(GROUPS).forEach(g => {
    getGroupMatches(g).forEach((match,idx) => {
      const p=scores[`${g}_${idx}`], r=realG[`${g}_${idx}`];
      if (!isFilledMatchScore(p)||!isFilledMatchScore(r)) return;
      const ph=parseInt(p.h,10),pa=parseInt(p.a,10),rh=parseInt(r.h,10),ra=parseInt(r.a,10);
      const pts=calcGroupMatchPts(ph,pa,rh,ra);
      groupPts+=pts;
      groupDetail.push({key:`${g}_${idx}`,match,palpite:`${ph}×${pa}`,real:`${rh}×${ra}`,pts});
    });
  });

  const koSummary = buildKnockoutSummary(scores,picks,realG,realKO);
  koPts += koSummary.reduce((s,r)=>s+r.scoredPts,0);

  const pickChamp=picks["f_0"], realChamp=realKO["f_0"];
  let champPts=0;
  if (isKnownTeam(pickChamp)&&isKnownTeam(realChamp)&&pickChamp===realChamp) { champPts=KNOCKOUT_PTS.champion; koPts+=champPts; }

  return { total:groupPts+koPts, groupPts, koPts, groupDetail, koSummary, champPick:pickChamp, champReal:realChamp, champPts };
}

// Versão síncrona para cálculo de potencial (já tem os dados em memória)
function calcMaxPotentialPts_sync(scores, picks) {
  let pts=0;
  Object.keys(GROUPS).forEach(g=>{
    getGroupMatches(g).forEach((_,idx)=>{ if(isFilledMatchScore(scores[`${g}_${idx}`])) pts+=6; });
  });
  const st=getKnockoutTeamsByStage(scores,picks);
  KO_TEAM_RULES.forEach(r=>{ pts+=(st[r.stage]||[]).length*r.ptsEach; });
  if(isKnownTeam(picks["f_0"])) pts+=KNOCKOUT_PTS.champion;
  return pts;
}

function countGroupFilled(scores) {
  let filled=0,total=0;
  Object.keys(GROUPS).forEach(g=>{
    const m=getGroupMatches(g); total+=m.length;
    m.forEach((_,idx)=>{ if(isFilledMatchScore(scores[`${g}_${idx}`])) filled++; });
  });
  return {filled,total};
}

function countKnockoutFilled(scores,picks) {
  const st=getKnockoutTeamsByStage(scores,picks);
  let filled=0,total=0;
  KO_TEAM_RULES.forEach(r=>{ filled+=(st[r.stage]||[]).length; total+=r.total; });
  total+=1; if(isKnownTeam(picks["f_0"])) filled++;
  return {filled,total};
}
