// ============================================================
//  data.js — Seleções, grupos, bandeiras e estrutura de jogos
// ============================================================

const GROUPS = {
  A: ["México",        "África do Sul",     "Coreia do Sul",       "Tchéquia"],
  B: ["Canadá",       "Bósnia e Herzegovina",      "Catar",      "Suiça"],
  C: ["Brasil",    "Marrocos",        "Haiti",      "Escócia"],
  D: ["Estados Unidos",       "Paraguai",        "Austrália",          "Turquia"],
  E: ["Alemanha",       "Curaçao",      "Costa do Marfim",      "Equador"],
  F: ["Holanda",         "Japão", "Suécia",    "Tunísia"],
  G: ["Bélgica",       "Egito",          "Irã",        "Nova Zelândia"],
  H: ["Espanha",       "Cabo Verde",         "Arábia Saudita",       "Uruguai"],
  I: ["França",       "Senegal",        "Iraque",      "Noruega"],
  J: ["Argentina",      "Argélia",     "Áustria",     "Jordânia"],
  K: ["Portugal","RD Congo",         "Uzbequistão",        "Colômbia"],
  L: ["Inglaterra", "Croácia",       "Gana",  "Panamá"],
};

const FLAGS = {
  "México":"mx","África do Sul":"rsa","Coreia do Sul":"kor","Tchéquia":"cze",
  "Canadá":"can","Bósnia e Herzegovina":"bih","Catar":"qat","Suiça":"sui",
  "Brasil":"bra","Marrocos":"mar","Haiti":"hai","Escócia":"sco",
  "Estados Unidos":"usa","Paraguai":"par","Austrália":"aus","Turquia":"tur",
  "Alemanha":"ger","Curaçao":"cuw","Costa do Marfim":"civ","Equador":"ecu",
  "Holanda":"ned","Japão":"jpn","Suécia":"swe","Tunísia":"tun",
  "Bélgica":"bel","Egito":"egy","Irã":"irn","Nova Zelândia":"nzl",
  "Espanha":"esp","Cabo Verde":"cpv","Arábia Saudita":"ksa","Uruguai":"uru",
  "França":"fra","Senegal":"sen","Iraque":"irq","Noruega":"nor",
  "Argentina":"arg","Argélia":"alg","Áustria":"aut","Jordânia":"jor",
  "Portugal":"por","RD Congo":"cod","Uzbequistão":"uzb","Colômbia":"col",
  "Inglaterra":"eng","Croácia":"cro","Gana":"gha","Panamá":"pan",
};

function getGroupMatches(groupKey) {
  const teams = GROUPS[groupKey];
  const matches = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      matches.push([teams[i], teams[j]]);
  return matches;
}

function getFlag(team) {
  return FLAGS[team] || "🏳";
}

// Estrutura dos 16avos — g1/g2: "1_A", "2_B", "t_N" (N-ésimo melhor 3º)
const ROUND_OF_32_SLOTS = [
  { id:"r32_0",  label:"Jogo 1",  g1:"1_A", g2:"t_0" },
  { id:"r32_1",  label:"Jogo 2",  g1:"1_B", g2:"t_1" },
  { id:"r32_2",  label:"Jogo 3",  g1:"1_C", g2:"t_2" },
  { id:"r32_3",  label:"Jogo 4",  g1:"1_D", g2:"t_3" },
  { id:"r32_4",  label:"Jogo 5",  g1:"1_E", g2:"t_4" },
  { id:"r32_5",  label:"Jogo 6",  g1:"1_F", g2:"t_5" },
  { id:"r32_6",  label:"Jogo 7",  g1:"1_G", g2:"t_6" },
  { id:"r32_7",  label:"Jogo 8",  g1:"1_H", g2:"t_7" },
  { id:"r32_8",  label:"Jogo 9",  g1:"1_I", g2:"2_L" },
  { id:"r32_9",  label:"Jogo 10", g1:"1_J", g2:"2_K" },
  { id:"r32_10", label:"Jogo 11", g1:"1_K", g2:"2_J" },
  { id:"r32_11", label:"Jogo 12", g1:"1_L", g2:"2_I" },
  { id:"r32_12", label:"Jogo 13", g1:"2_A", g2:"2_B" },
  { id:"r32_13", label:"Jogo 14", g1:"2_C", g2:"2_D" },
  { id:"r32_14", label:"Jogo 15", g1:"2_E", g2:"2_F" },
  { id:"r32_15", label:"Jogo 16", g1:"2_G", g2:"2_H" },
];

const KNOCKOUT_STAGES = [
  { id:"r32", name:"16avos de Final",  ptsLabel:"6 pts/acerto",  count:16 },
  { id:"r16", name:"Oitavas de Final", ptsLabel:"8 pts/acerto",  count:8  },
  { id:"qf",  name:"Quartas de Final", ptsLabel:"12 pts/acerto", count:4  },
  { id:"sf",  name:"Semifinal",        ptsLabel:"17 pts/acerto", count:2  },
  { id:"f",   name:"Final",            ptsLabel:"25 pts/acerto", count:1  },
];

const KNOCKOUT_PTS = { r32:6, r16:8, qf:12, sf:17, f:25, champion:40 };

// Senha padrão do admin (altere aqui para personalizar)
const ADMIN_PASSWORD = "copa2026";
