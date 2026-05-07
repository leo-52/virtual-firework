// Templates de spectacles pré-fabriqués.
//
// Chaque template est une fonction qui retourne une définition complète
// (sans id ni timestamps) que `cloneTemplate(name)` instancie comme un
// nouveau show.
//
// L'idée : démarrer en 1 clic sur un format de référence (14-juillet,
// mariage, finale courte, ouverture).

const COLORS = {
  red: "#e5484d", blue: "#0091ff", white: "#e0e0e0",
  gold: "#ffd60a", silver: "#c8cdd6", green: "#46a758",
  orange: "#ff7a3d", purple: "#a374e6",
};

function c(time, effectId, qty = 1, extras = {}) {
  return { time, effectId, quantity: qty, ...extras };
}

// ---- Templates ----

export const TEMPLATES = [
  {
    id: "fete_nationale",
    name: "Fête nationale (3 min)",
    description: "Spectacle classique pour le 14-Juillet : ouverture spectaculaire, montée, finale tricolore.",
    duration: 180,
    icon: "🇫🇷",
    accent: "#0091ff",
    build: () => ({
      duration: 180,
      cues: [
        // Ouverture (0–25s) : montée d'attention
        c(2,  "mine_75_multi", 2),
        c(5,  "shell_75_peony_blue"),
        c(7,  "shell_75_peony_red"),
        c(9,  "shell_75_peony_green"),
        c(12, "comet_30_silver", 3),
        c(15, "candle_30_multi_x20"),
        c(20, "shell_100_palm_gold"),
        c(24, "shell_100_brocade"),

        // Phase 1 (25–80s) : architecture
        c(28, "fountain_45s_multi"),
        c(35, "shell_125_diadem"),
        c(40, "shell_125_kamuro"),
        c(48, "gerb_8m_silver_45s"),
        c(55, "shell_150_dahlia"),
        c(62, "candle_30_gold_x12"),
        c(70, "shell_125_crossette"),
        c(76, "shell_100_chrys_silver"),

        // Phase 2 (80–140s) : montée puissance
        c(85,  "shell_150_falling_leaves"),
        c(92,  "shell_150_ring"),
        c(100, "comet_30_red", 5),
        c(105, "shell_75_peony_blue", 3),
        c(110, "shell_75_peony_red", 3),
        c(115, "shell_75_peony_green", 3),
        c(125, "cake_50_finale_25s"),
        c(135, "shell_150_dahlia", 2),

        // Bouquet final tricolore (140–180s)
        c(142, "shell_75_peony_blue", 4),
        c(143, "shell_75_peony_red", 4),
        c(144, "shell_100_chrys_silver", 2),
        c(150, "cake_75_finale_50s"),
        c(165, "shell_150_dahlia", 3),
        c(168, "shell_125_diadem", 2),
        c(170, "shell_125_kamuro", 2),
        c(172, "shell_150_ring", 2),
        c(175, "shell_100_brocade", 3),
      ].map((cue) => ({ ...cue, id: cueId() })),
    }),
  },

  {
    id: "mariage",
    name: "Mariage (90 s)",
    description: "Spectacle court et élégant : palette douce, peu de bruit, focus sur les saules et brocarts.",
    duration: 90,
    icon: "💒",
    accent: "#a374e6",
    build: () => ({
      duration: 90,
      cues: [
        // Démarrage discret
        c(2,   "fountain_30s_silver"),
        c(5,   "fountain_30s_silver"),
        c(8,   "shell_75_willow_gold"),
        c(13,  "shell_75_willow_gold"),
        c(18,  "candle_30_gold_x12"),

        // Cœur du spectacle : élégance
        c(28,  "shell_100_palm_gold"),
        c(34,  "shell_100_brocade"),
        c(40,  "shell_125_kamuro"),
        c(46,  "shell_125_diadem"),
        c(52,  "shell_150_falling_leaves"),
        c(58,  "shell_100_chrys_silver"),

        // Final apaisé
        c(65,  "shell_75_willow_gold", 3),
        c(72,  "shell_125_kamuro", 2),
        c(78,  "shell_150_falling_leaves", 2),
        c(85,  "shell_100_brocade", 2),
      ].map((cue) => ({ ...cue, id: cueId() })),
    }),
  },

  {
    id: "ouverture_courte",
    name: "Ouverture (45 s)",
    description: "Format court et impactant pour ouvrir un événement : annonce + flash + bouquet.",
    duration: 45,
    icon: "✦",
    accent: "#ffd60a",
    build: () => ({
      duration: 45,
      cues: [
        c(1,   "mine_50_gold", 3),
        c(2,   "comet_30_silver", 4),
        c(5,   "shell_75_peony_red", 2),
        c(6,   "shell_75_peony_blue", 2),
        c(10,  "candle_30_multi_x20"),
        c(15,  "shell_100_brocade"),
        c(20,  "shell_125_diadem"),
        c(25,  "shell_125_kamuro"),
        c(28,  "cake_50_finale_25s"),
        c(38,  "shell_150_dahlia", 2),
        c(40,  "shell_125_crossette", 2),
        c(42,  "shell_100_palm_gold"),
        c(43,  "shell_75_peony_red", 3),
        c(44,  "shell_75_peony_green", 3),
      ].map((cue) => ({ ...cue, id: cueId() })),
    }),
  },

  {
    id: "demo_complete",
    name: "Démo catalogue (60 s)",
    description: "Tour d'horizon de tous les types d'effets pour découvrir le moteur 3D.",
    duration: 60,
    icon: "🎯",
    accent: "#46a758",
    build: () => ({
      duration: 60,
      cues: [
        // Sol
        c(0.5, "fountain_30s_silver"),
        c(2,   "gerb_5m_gold_30s"),
        c(4,   "mine_50_gold"),
        c(5,   "mine_75_multi"),
        // Aérien petit calibre
        c(8,   "candle_25_red_x10"),
        c(11,  "comet_20_gold", 2),
        c(13,  "shell_75_peony_red"),
        c(15,  "shell_75_peony_blue"),
        c(17,  "shell_75_peony_green"),
        c(19,  "shell_75_willow_gold"),
        // Moyen calibre
        c(22,  "shell_100_palm_gold"),
        c(25,  "shell_100_chrys_silver"),
        c(28,  "shell_100_brocade"),
        // Gros calibre
        c(32,  "shell_125_kamuro"),
        c(35,  "shell_125_crossette"),
        c(38,  "shell_125_diadem"),
        c(42,  "shell_150_dahlia"),
        c(45,  "shell_150_falling_leaves"),
        c(48,  "shell_150_ring"),
        // SFX
        c(52,  "sfx_whistle_long"),
        c(53,  "sfx_crackle_burst"),
        // Finale
        c(55,  "cake_50_finale_25s"),
      ].map((cue) => ({ ...cue, id: cueId() })),
    }),
  },
];

let _seq = 0;
function cueId() {
  _seq++;
  return "cue_t" + Date.now().toString(36) + _seq.toString(36);
}

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id);
}
