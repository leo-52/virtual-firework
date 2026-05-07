// Catalogue d'effets pyrotechniques.
//
// Modèle aligné sur VDL (Visual Description Language) de Finale FX :
//   - `partType`  = packaging (cake, candle, shell, mortar, fountain, …)
//   - `subtype`   = style visuel (peony, willow, kamuro, …)
//   - `caliber`   = en mm
//   - `duration`  = visuel, en s
//   - `height`    = pic de hauteur, en m
//   - `colors`    = palette (premier = couleur dominante)
//   - `price`     = prix unitaire, € HT
//   - `vendor`    = fournisseur
//
// Les libellés FR proviennent de lib/i18n.js (clefs `partType.*`, `subtype.*`).

import { t } from "../lib/i18n.js";

// ---- Part types (packaging) ----
export const PART_TYPES = {
  shell:      { key: "shell",      icon: "✦", color: "#e5484d" },
  candle:     { key: "candle",     icon: "↑", color: "#ff7a3d" },
  cake:       { key: "cake",       icon: "▦", color: "#a374e6" },
  singleShot: { key: "singleShot", icon: "•", color: "#0091ff" },
  mortar:     { key: "mortar",     icon: "⊥", color: "#ec4899" },
  rocket:     { key: "rocket",     icon: "↗", color: "#46a758" },
  mine:       { key: "mine",       icon: "△", color: "#0091ff" },
  fountain:   { key: "fountain",   icon: "⌃", color: "#f5a524" },
  gerb:       { key: "gerb",       icon: "‖", color: "#ffd60a" },
  comet:      { key: "comet",      icon: "↗", color: "#46a758" },
  flame:      { key: "flame",      icon: "♨", color: "#ff7a3d" },
  rack:       { key: "rack",       icon: "⫴", color: "#9aa0ad" },
  sfx:        { key: "sfx",        icon: "♪", color: "#a374e6" },
  light:      { key: "light",      icon: "☀", color: "#ffd60a" },
  other:      { key: "other",      icon: "?", color: "#6b7280" },
};

// ---- Visual subtypes (VDL) ----
export const SUBTYPES = {
  peony:         { color: "#e5484d" },
  chrysanthemum: { color: "#ffd60a" },
  willow:        { color: "#ff7a3d" },
  palm:          { color: "#46a758" },
  brocade:       { color: "#ffd60a" },
  kamuro:        { color: "#f5a524" },
  crossette:     { color: "#0091ff" },
  dahlia:        { color: "#a374e6" },
  diadem:        { color: "#e0e0e0" },
  fallingLeaves: { color: "#46a758" },
  ring:          { color: "#0091ff" },
  wave:          { color: "#0091ff" },
  comet:         { color: "#ffd60a" },
  mine:          { color: "#0091ff" },
  cake:          { color: "#a374e6" },
  ground:        { color: "#9aa0ad" },
  sfx:           { color: "#a374e6" },
  light:         { color: "#ffd60a" },
  other:         { color: "#6b7280" },
};

export function partTypeLabel(key) { return t("partType." + key); }
export function subtypeLabel(key)  { return t("subtype." + key); }

// Compat avec l'ancien code : `category` = partType principal.
// On expose CATEGORIES pour éviter de tout réécrire dans les vues existantes.
export const CATEGORIES = Object.fromEntries(
  Object.entries(PART_TYPES).map(([k, v]) => [
    k,
    { label: partTypeLabel(k), icon: v.icon, color: v.color },
  ])
);

// ---- Effects ----
export const EFFECTS = [
  // Bombes (shell) — sphériques, palette riche
  { id: "shell_75_peony_red",      name: "Pivoine rouge 75mm",         partType: "shell",  subtype: "peony",         caliber: 75,  duration: 4.0, height: 70,  colors: ["#e5484d"],                                  price: 14.50, vendor: "Pyro France" },
  { id: "shell_75_peony_blue",     name: "Pivoine bleue 75mm",         partType: "shell",  subtype: "peony",         caliber: 75,  duration: 4.0, height: 70,  colors: ["#0091ff"],                                  price: 14.90, vendor: "Pyro France" },
  { id: "shell_75_peony_green",    name: "Pivoine verte 75mm",         partType: "shell",  subtype: "peony",         caliber: 75,  duration: 4.0, height: 70,  colors: ["#46a758"],                                  price: 14.50, vendor: "Pyro France" },
  { id: "shell_75_willow_gold",    name: "Saule doré 75mm",            partType: "shell",  subtype: "willow",        caliber: 75,  duration: 6.5, height: 80,  colors: ["#ffd60a", "#ff7a3d"],                       price: 16.20, vendor: "Pyro France" },
  { id: "shell_100_chrys_silver",  name: "Chrysanthème argent 100mm",  partType: "shell",  subtype: "chrysanthemum", caliber: 100, duration: 5.0, height: 110, colors: ["#e0e0e0"],                                  price: 32.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_100_palm_gold",     name: "Palmier doré 100mm",         partType: "shell",  subtype: "palm",          caliber: 100, duration: 6.0, height: 110, colors: ["#ffd60a"],                                  price: 34.50, vendor: "Lacroix Ruggieri" },
  { id: "shell_100_brocade",       name: "Brocart traçant 100mm",      partType: "shell",  subtype: "brocade",       caliber: 100, duration: 7.0, height: 110, colors: ["#ffd60a", "#e5484d"],                       price: 36.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_125_kamuro",        name: "Kamuro 125mm",               partType: "shell",  subtype: "kamuro",        caliber: 125, duration: 8.5, height: 140, colors: ["#f5a524"],                                  price: 64.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_125_crossette",     name: "Crossette bleue 125mm",      partType: "shell",  subtype: "crossette",     caliber: 125, duration: 5.5, height: 140, colors: ["#0091ff"],                                  price: 60.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_125_diadem",        name: "Diadème 125mm",              partType: "shell",  subtype: "diadem",        caliber: 125, duration: 6.0, height: 140, colors: ["#e0e0e0", "#ffd60a"],                       price: 58.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_150_dahlia",        name: "Dahlia multicolore 150mm",   partType: "shell",  subtype: "dahlia",        caliber: 150, duration: 6.0, height: 170, colors: ["#a374e6", "#e5484d", "#ffd60a"],            price: 88.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_150_falling_leaves",name: "Feuilles tombantes 150mm",   partType: "shell",  subtype: "fallingLeaves", caliber: 150, duration: 9.0, height: 170, colors: ["#46a758", "#ffd60a"],                       price: 95.00, vendor: "Lacroix Ruggieri" },
  { id: "shell_150_ring",          name: "Anneau de saturne 150mm",    partType: "shell",  subtype: "ring",          caliber: 150, duration: 5.0, height: 170, colors: ["#0091ff"],                                  price: 92.00, vendor: "Lacroix Ruggieri" },

  // Chandelles (candle)
  { id: "candle_25_red_x10",       name: "Chandelle rouge ×10 (25mm)",  partType: "candle", subtype: "peony",        caliber: 25,  duration: 12.0, height: 35, colors: ["#e5484d"],                                  price: 8.50,  vendor: "Pyro France" },
  { id: "candle_30_gold_x12",      name: "Chandelle or ×12 (30mm)",     partType: "candle", subtype: "willow",       caliber: 30,  duration: 14.0, height: 45, colors: ["#ffd60a"],                                  price: 12.00, vendor: "Pyro France" },
  { id: "candle_30_multi_x20",     name: "Chandelle multi ×20 (30mm)",  partType: "candle", subtype: "peony",        caliber: 30,  duration: 22.0, height: 50, colors: ["#e5484d", "#0091ff", "#46a758"],            price: 19.50, vendor: "Lacroix Ruggieri" },

  // Batteries / cakes
  { id: "cake_50_finale_25s",      name: "Batterie 25 coups 50mm",      partType: "cake",   subtype: "cake",         caliber: 50,  duration: 25.0, height: 65, colors: ["#ffd60a", "#e5484d", "#0091ff"],            price: 96.00, vendor: "Pyro France" },
  { id: "cake_75_finale_50s",      name: "Batterie 50 coups 75mm",      partType: "cake",   subtype: "cake",         caliber: 75,  duration: 45.0, height: 90, colors: ["#ffd60a", "#a374e6", "#46a758", "#e5484d"], price: 285.00,vendor: "Lacroix Ruggieri" },

  // Mines
  { id: "mine_50_gold",            name: "Mine or 50mm",                partType: "mine",   subtype: "mine",         caliber: 50,  duration: 2.5, height: 30,  colors: ["#ffd60a"],                                  price: 11.00, vendor: "Pyro France" },
  { id: "mine_75_multi",           name: "Mine multicolore 75mm",       partType: "mine",   subtype: "mine",         caliber: 75,  duration: 3.0, height: 40,  colors: ["#e5484d", "#0091ff", "#46a758"],            price: 18.50, vendor: "Lacroix Ruggieri" },

  // Fontaines
  { id: "fountain_30s_silver",     name: "Fontaine argent 30s",         partType: "fountain", subtype: "ground",     caliber: 0,   duration: 30.0, height: 8,  colors: ["#e0e0e0"],                                  price: 9.00,  vendor: "Pyro France" },
  { id: "fountain_60s_gold",       name: "Fontaine or 60s",             partType: "fountain", subtype: "ground",     caliber: 0,   duration: 60.0, height: 10, colors: ["#ffd60a"],                                  price: 14.00, vendor: "Pyro France" },
  { id: "fountain_45s_multi",      name: "Fontaine multicolore 45s",    partType: "fountain", subtype: "ground",     caliber: 0,   duration: 45.0, height: 9,  colors: ["#e5484d", "#46a758", "#0091ff"],            price: 16.50, vendor: "Lacroix Ruggieri" },

  // Gerbes
  { id: "gerb_5m_gold_30s",        name: "Gerbe 5m or 30s",             partType: "gerb",   subtype: "ground",       caliber: 0,   duration: 30.0, height: 5,  colors: ["#ffd60a"],                                  price: 22.00, vendor: "Pyro France" },
  { id: "gerb_8m_silver_45s",      name: "Gerbe 8m argent 45s",         partType: "gerb",   subtype: "ground",       caliber: 0,   duration: 45.0, height: 8,  colors: ["#e0e0e0"],                                  price: 36.00, vendor: "Lacroix Ruggieri" },

  // Comètes
  { id: "comet_20_gold",           name: "Comète or 20mm",              partType: "comet",  subtype: "comet",        caliber: 20,  duration: 2.5, height: 50,  colors: ["#ffd60a"],                                  price: 4.20,  vendor: "Pyro France" },
  { id: "comet_30_silver",         name: "Comète argent 30mm",          partType: "comet",  subtype: "comet",        caliber: 30,  duration: 3.0, height: 60,  colors: ["#e0e0e0"],                                  price: 5.80,  vendor: "Pyro France" },
  { id: "comet_30_red",            name: "Comète rouge 30mm",           partType: "comet",  subtype: "comet",        caliber: 30,  duration: 3.0, height: 60,  colors: ["#e5484d"],                                  price: 5.80,  vendor: "Pyro France" },

  // SFX
  { id: "sfx_whistle_long",        name: "Sifflet long",                partType: "sfx",    subtype: "sfx",          caliber: 0,   duration: 2.0, height: 0,   colors: ["#9aa0ad"],                                  price: 3.50,  vendor: "Pyro France" },
  { id: "sfx_crackle_burst",       name: "Crépitement explosif",        partType: "sfx",    subtype: "sfx",          caliber: 0,   duration: 1.5, height: 0,   colors: ["#9aa0ad"],                                  price: 4.20,  vendor: "Pyro France" },
];

export function getEffect(id) {
  return EFFECTS.find((e) => e.id === id);
}
