// ============================================================
//  data.js — Seleções, grupos, bandeiras e estrutura de jogos
// ============================================================

const GROUPS = {
  A: ["Brasil",        "Argentina",     "França",       "Alemanha"],
  B: ["Espanha",       "Portugal",      "Holanda",      "Bélgica"],
  C: ["Inglaterra",    "Itália",        "Croácia",      "Dinamarca"],
  D: ["Uruguai",       "México",        "EUA",          "Canadá"],
  E: ["Senegal",       "Marrocos",      "Nigéria",      "Gana"],
  F: ["Japão",         "Coreia do Sul", "Austrália",    "Irã"],
  G: ["Equador",       "Peru",          "Chile",        "Bolívia"],
  H: ["Polônia",       "Suíça",         "Sérvia",       "Eslováquia"],
  I: ["Turquia",       "Grécia",        "Romênia",      "Albânia"],
  J: ["Colômbia",      "Venezuela",     "Paraguai",     "Costa Rica"],
  K: ["Arábia Saudita","Qatar",         "Egito",        "Tunísia"],
  L: ["Nova Zelândia", "Jamaica",       "El Salvador",  "Guatemala"],
};

const FLAGS = {
  "Brasil":"🇧🇷","Argentina":"🇦🇷","França":"🇫🇷","Alemanha":"🇩🇪",
  "Espanha":"🇪🇸","Portugal":"🇵🇹","Holanda":"🇳🇱","Bélgica":"🇧🇪",
  "Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Itália":"🇮🇹","Croácia":"🇭🇷","Dinamarca":"🇩🇰",
  "Uruguai":"🇺🇾","México":"🇲🇽","EUA":"🇺🇸","Canadá":"🇨🇦",
  "Senegal":"🇸🇳","Marrocos":"🇲🇦","Nigéria":"🇳🇬","Gana":"🇬🇭",
  "Japão":"🇯🇵","Coreia do Sul":"🇰🇷","Austrália":"🇦🇺","Irã":"🇮🇷",
  "Equador":"🇪🇨","Peru":"🇵🇪","Chile":"🇨🇱","Bolívia":"🇧🇴",
  "Polônia":"🇵🇱","Suíça":"🇨🇭","Sérvia":"🇷🇸","Eslováquia":"🇸🇰",
  "Turquia":"🇹🇷","Grécia":"🇬🇷","Romênia":"🇷🇴","Albânia":"🇦🇱",
  "Colômbia":"🇨🇴","Venezuela":"🇻🇪","Paraguai":"🇵🇾","Costa Rica":"🇨🇷",
  "Arábia Saudita":"🇸🇦","Qatar":"🇶🇦","Egito":"🇪🇬","Tunísia":"🇹🇳",
  "Nova Zelândia":"🇳🇿","Jamaica":"🇯🇲","El Salvador":"🇸🇻","Guatemala":"🇬🇹",
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
