// Mapping .fin (Finale FX) → cues PrevoFX, en heuristique.
//
// Sans le `.proto` officiel, on ne peut pas mapper exactement chaque
// champ. Les noms de messages identifiés dans le WASM
// (`Finale3dEffect.Effect`, `Finale3dEffect.Shot`, etc.) nous donnent
// une direction.
//
// Stratégie :
//   - On cherche dans l'arbre des "candidats Shot" : sous-messages qui
//     contiennent à la fois un float plausible (= temps en secondes) et
//     une chaîne (= nom d'effet ou ID).
//   - Pour chaque candidat, on génère un cue avec :
//        * time : le float plausible
//        * label : la chaîne trouvée
//        * effectId : essai de mapping vers notre catalogue par fuzzy
//          match du nom (peony / willow / etc.) ; sinon "other".
//
// Très approximatif, mais permet une **inspection visuelle** d'un .fin
// dans notre éditeur, sans avoir à reproduire intégralement la glue
// embind.

import { findEffect, getAllEffects } from "./state.js";
import { EFFECTS } from "../data/effects.js";

const CATALOG_KEYWORDS = [
  // Match texte minuscule → effectId du catalogue
  ["pivoine bleue", "shell_75_peony_blue"],
  ["pivoine rouge", "shell_75_peony_red"],
  ["pivoine verte", "shell_75_peony_green"],
  ["peony blue",  "shell_75_peony_blue"],
  ["peony red",   "shell_75_peony_red"],
  ["peony green", "shell_75_peony_green"],
  ["willow",      "shell_75_willow_gold"],
  ["saule",       "shell_75_willow_gold"],
  ["chrysanth",   "shell_100_chrys_silver"],
  ["palm",        "shell_100_palm_gold"],
  ["palmier",     "shell_100_palm_gold"],
  ["brocade",     "shell_100_brocade"],
  ["brocart",     "shell_100_brocade"],
  ["kamuro",      "shell_125_kamuro"],
  ["crossette",   "shell_125_crossette"],
  ["dahlia",      "shell_150_dahlia"],
  ["diadem",      "shell_125_diadem"],
  ["falling",     "shell_150_falling_leaves"],
  ["leaves",      "shell_150_falling_leaves"],
  ["ring",        "shell_150_ring"],
  ["candle",      "candle_30_multi_x20"],
  ["chandelle",   "candle_30_multi_x20"],
  ["mine",        "mine_75_multi"],
  ["fountain",    "fountain_45s_multi"],
  ["fontaine",    "fountain_45s_multi"],
  ["gerb",        "gerb_5m_gold_30s"],
  ["comet",       "comet_30_silver"],
  ["comète",      "comet_30_silver"],
  ["whistle",     "sfx_whistle_long"],
  ["sifflet",     "sfx_whistle_long"],
  ["crackle",     "sfx_crackle_burst"],
  ["cake",        "cake_50_finale_25s"],
  ["batterie",    "cake_50_finale_25s"],
];

function guessEffectFromText(text) {
  const lc = (text || "").toLowerCase();
  for (const [kw, id] of CATALOG_KEYWORDS) {
    if (lc.includes(kw)) return id;
  }
  return null;
}

// Parcourt l'arbre protobuf et collecte tous les sous-messages
// qui ressemblent à un Shot/Cue (a un temps + un nom).
function collectShotCandidates(tree, candidates = [], path = []) {
  for (const f of tree) {
    if (f.asMessage) {
      const sub = f.asMessage;
      const numbers = [];
      const strings = [];
      const ints = [];
      for (const sf of sub) {
        if (sf.asString != null && sf.asString.length >= 2 && sf.asString.length < 80) {
          strings.push(sf.asString);
        } else if (typeof sf.value === "number") {
          if (sf.wire === 5 || sf.wire === 1) numbers.push(sf.value);
          else ints.push(sf.value);
        }
      }
      // Heuristique : un Shot a généralement
      //   - au moins 1 float dans [0, 7200] (temps ou hauteur en s/m)
      //   - au moins 1 chaîne courte
      const timeCand = numbers.find((n) => n >= 0 && n <= 7200);
      if (timeCand != null && strings.length >= 1) {
        candidates.push({
          time: Math.round(timeCand * 100) / 100,
          label: strings[0],
          extra: { strings, ints, numbers, path: path.concat(f.tag) },
        });
      }
      collectShotCandidates(sub, candidates, path.concat(f.tag));
    }
  }
  return candidates;
}

// Public : convertit un arbre protobuf en liste de cues.
// Renvoie { duration, cues, warnings, candidatesCount }.
export function mapFinTreeToCues(tree, opts = {}) {
  const candidates = collectShotCandidates(tree);
  const warnings = [];
  const cues = [];
  let maxTime = 0;
  for (const cand of candidates) {
    const eid = guessEffectFromText(cand.label) || "shell_75_peony_blue";
    const eff = findEffect(eid);
    if (!eff) continue;
    cues.push({
      id: "cue_fin_" + cues.length.toString(36) + Date.now().toString(36),
      effectId: eid,
      time: cand.time,
      quantity: 1,
      notes: `[Importé .fin] ${cand.label}`,
      tags: ["import-fin"],
    });
    if (cand.time > maxTime) maxTime = cand.time;
  }

  // Dédupliquer les cues à temps identique sur le même effet (les nœuds
  // protobuf répétés peuvent en générer plusieurs).
  const seen = new Set();
  const dedup = [];
  for (const c of cues) {
    const k = `${c.time}_${c.effectId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(c);
  }
  dedup.sort((a, b) => a.time - b.time);

  if (!dedup.length) {
    warnings.push("Aucun cue n'a pu être déduit. Le format est trop opaque sans descripteur .proto.");
  }

  return {
    duration: Math.max(60, Math.ceil(maxTime + 5)),
    cues: dedup,
    warnings,
    candidatesCount: candidates.length,
  };
}
