// Catalogue d'effets pyrotechniques. Données fictives mais réalistes (FR).
// Catégories : bombe, chandelle, fontaine, comete, finale, mine, gerbe.

export const CATEGORIES = {
  bombe:     { label: "Bombe",     icon: "✦", color: "#e5484d" },
  chandelle: { label: "Chandelle", icon: "↑", color: "#ff7a3d" },
  fontaine:  { label: "Fontaine",  icon: "⌃", color: "#f5a524" },
  comete:    { label: "Comète",    icon: "↗", color: "#46a758" },
  finale:    { label: "Finale",    icon: "✺", color: "#a374e6" },
  mine:      { label: "Mine",      icon: "△", color: "#0091ff" },
  gerbe:     { label: "Gerbe",     icon: "‖", color: "#ffd60a" },
};

export const EFFECTS = [
  // ---- Bombes ----
  { id: "bomb_75_pivoine_rouge",   name: "Pivoine rouge 75mm",        category: "bombe",     caliber: 75,  duration: 4.0, height: 70,  colors: ["#e5484d"], price: 14.50, vendor: "Pyro France" },
  { id: "bomb_75_pivoine_bleue",   name: "Pivoine bleue 75mm",        category: "bombe",     caliber: 75,  duration: 4.0, height: 70,  colors: ["#0091ff"], price: 14.90, vendor: "Pyro France" },
  { id: "bomb_75_pivoine_verte",   name: "Pivoine verte 75mm",        category: "bombe",     caliber: 75,  duration: 4.0, height: 70,  colors: ["#46a758"], price: 14.50, vendor: "Pyro France" },
  { id: "bomb_75_or",              name: "Saule pleureur or 75mm",    category: "bombe",     caliber: 75,  duration: 5.5, height: 80,  colors: ["#ffd60a", "#ff7a3d"], price: 16.20, vendor: "Pyro France" },
  { id: "bomb_100_chrysantheme",   name: "Chrysanthème argent 100mm", category: "bombe",     caliber: 100, duration: 5.0, height: 110, colors: ["#e0e0e0"], price: 32.00, vendor: "Lacroix Ruggieri" },
  { id: "bomb_100_palmier",        name: "Palmier doré 100mm",        category: "bombe",     caliber: 100, duration: 6.0, height: 110, colors: ["#ffd60a"], price: 34.50, vendor: "Lacroix Ruggieri" },
  { id: "bomb_125_couronne",       name: "Couronne multicolore 125mm",category: "bombe",     caliber: 125, duration: 6.0, height: 140, colors: ["#e5484d","#0091ff","#46a758"], price: 58.00, vendor: "Lacroix Ruggieri" },
  { id: "bomb_150_grand_finale",   name: "Bouquet final 150mm",       category: "bombe",     caliber: 150, duration: 7.0, height: 170, colors: ["#ffd60a","#e5484d","#a374e6"], price: 92.00, vendor: "Lacroix Ruggieri" },

  // ---- Chandelles ----
  { id: "cand_25_rouge_x10",       name: "Chandelle rouge ×10 (25mm)",category: "chandelle", caliber: 25,  duration: 12.0, height: 35, colors: ["#e5484d"], price: 8.50,  vendor: "Pyro France" },
  { id: "cand_30_or_x12",          name: "Chandelle or ×12 (30mm)",   category: "chandelle", caliber: 30,  duration: 14.0, height: 45, colors: ["#ffd60a"], price: 12.00, vendor: "Pyro France" },
  { id: "cand_30_multi_x20",       name: "Chandelle multi ×20 (30mm)",category: "chandelle", caliber: 30,  duration: 22.0, height: 50, colors: ["#e5484d","#0091ff","#46a758"], price: 19.50, vendor: "Lacroix Ruggieri" },

  // ---- Fontaines ----
  { id: "font_30s_argent",         name: "Fontaine argent 30s",       category: "fontaine",  caliber: 0,   duration: 30.0, height: 8,  colors: ["#e0e0e0"], price: 9.00,  vendor: "Pyro France" },
  { id: "font_60s_or",             name: "Fontaine or 60s",           category: "fontaine",  caliber: 0,   duration: 60.0, height: 10, colors: ["#ffd60a"], price: 14.00, vendor: "Pyro France" },
  { id: "font_45s_multi",          name: "Fontaine multicolore 45s",  category: "fontaine",  caliber: 0,   duration: 45.0, height: 9,  colors: ["#e5484d","#46a758","#0091ff"], price: 16.50, vendor: "Lacroix Ruggieri" },

  // ---- Comètes ----
  { id: "com_20_or",               name: "Comète or 20mm",            category: "comete",    caliber: 20,  duration: 2.5, height: 50, colors: ["#ffd60a"], price: 4.20, vendor: "Pyro France" },
  { id: "com_30_argent",           name: "Comète argent 30mm",        category: "comete",    caliber: 30,  duration: 3.0, height: 60, colors: ["#e0e0e0"], price: 5.80, vendor: "Pyro France" },
  { id: "com_30_rouge",            name: "Comète rouge 30mm",         category: "comete",    caliber: 30,  duration: 3.0, height: 60, colors: ["#e5484d"], price: 5.80, vendor: "Pyro France" },

  // ---- Mines ----
  { id: "mine_50_or",              name: "Mine or 50mm",              category: "mine",      caliber: 50,  duration: 2.5, height: 30, colors: ["#ffd60a"], price: 11.00, vendor: "Pyro France" },
  { id: "mine_75_multi",           name: "Mine multicolore 75mm",     category: "mine",      caliber: 75,  duration: 3.0, height: 40, colors: ["#e5484d","#0091ff","#46a758"], price: 18.50, vendor: "Lacroix Ruggieri" },

  // ---- Gerbes ----
  { id: "gerbe_5m_or_30s",         name: "Gerbe 5m or 30s",           category: "gerbe",     caliber: 0,   duration: 30.0, height: 5, colors: ["#ffd60a"], price: 22.00, vendor: "Pyro France" },
  { id: "gerbe_8m_argent_45s",     name: "Gerbe 8m argent 45s",       category: "gerbe",     caliber: 0,   duration: 45.0, height: 8, colors: ["#e0e0e0"], price: 36.00, vendor: "Lacroix Ruggieri" },

  // ---- Finales ----
  { id: "fin_20s_pack",            name: "Pack final 20s",            category: "finale",    caliber: 50,  duration: 20.0, height: 100, colors: ["#ffd60a","#e5484d","#a374e6","#0091ff"], price: 145.00, vendor: "Lacroix Ruggieri" },
  { id: "fin_30s_grand",           name: "Grand final 30s",           category: "finale",    caliber: 75,  duration: 30.0, height: 130, colors: ["#ffd60a","#e5484d","#a374e6","#0091ff","#46a758"], price: 240.00, vendor: "Lacroix Ruggieri" },
];

export function getEffect(id) {
  return EFFECTS.find((e) => e.id === id);
}
