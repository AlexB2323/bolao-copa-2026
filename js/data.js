// ============================================================
//  data.js — Seleções, grupos, bandeiras e estrutura de jogos
// ============================================================

const GROUPS = {
  A: ["México",        "África do Sul",     "Coreia do Sul",       "Tchéquia"],
  B: ["Canadá",       "Bósnia e Herzegovina",      "Catar",      "Suíça"],
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
  "México":"🇲🇽",
  "África do Sul":"🇿🇦",
  "Coreia do Sul":"🇰🇷",
  "Tchéquia":"🇨🇿",
  "Canadá":"🇨🇦",
  "Bósnia e Herzegovina":"🇧🇦",
  "Catar":"🇶🇦",
  "Suíça":"🇨🇭",
  "Brasil":"🇧🇷",
  "Marrocos":"🇲🇦",
  "Haiti":"🇭🇹",
  "Escócia":"\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "Estados Unidos":"🇺🇸",
  "Paraguai":"🇵🇾",
  "Austrália":"🇦🇺",
  "Turquia":"🇹🇷",
  "Alemanha":"🇩🇪",
  "Curaçao":"🇨🇼",
  "Costa do Marfim":"🇨🇮",
  "Equador":"🇪🇨",
  "Holanda":"🇳🇱",
  "Japão":"🇯🇵",
  "Suécia":"🇸🇪",
  "Tunísia":"🇹🇳",
  "Bélgica":"🇧🇪",
  "Egito":"🇪🇬",
  "Irã":"🇮🇷",
  "Nova Zelândia":"🇳🇿",
  "Espanha":"🇪🇸",
  "Cabo Verde":"🇨🇻",
  "Arábia Saudita":"🇸🇦",
  "Uruguai":"🇺🇾",
  "França":"🇫🇷",
  "Senegal":"🇸🇳",
  "Iraque":"🇮🇶",
  "Noruega":"🇳🇴",
  "Argentina":"🇦🇷",
  "Argélia":"🇩🇿",
  "Áustria":"🇦🇹",
  "Jordânia":"🇯🇴",
  "Portugal":"🇵🇹",
  "RD Congo":"🇨🇩",
  "Uzbequistão":"🇺🇿",
  "Colômbia":"🇨🇴",
  "Inglaterra":"\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "Croácia":"🇭🇷",
  "Gana":"🇬🇭",
  "Panamá":"🇵🇦",
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
