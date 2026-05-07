// GPU Lab : explorer le pipeline shaders + sonder le WASM compilateur
// du moteur Finale 3D embarqué.
//
// Cette vue est une fenêtre de diagnostic / exploration. Elle ne rend
// rien (pour l'instant) : elle inventorie ce qui est disponible côté
// moteur Finale 3D, charge le `.wasm`, tente d'instancier l'embind.

import { el, pageHeader, toast } from "../lib/dom.js";
import { decodeMessage, pretty, stats } from "../lib/protobuf-decoder.js";
import { mapFinTreeToCues } from "../lib/fin-mapper.js";
import { createShow, saveState } from "../lib/state.js";

const SHADER_PATH = "../../app.nw/gpu/";
const WASM_PATH = "../../app.nw/htmlui/vdl_effect_compiler-DmdKSrYM.wasm";
const TINYEXR_PATH = "../../app.nw/htmlui/tinyexr-CWVRs81W.wasm";

const SHADERS = [
  // (libellé · fichier · famille)
  ["Common (helpers)",         "common.glsl",                       "shared"],
  ["Prelude",                  "prelude.glsl",                      "shared"],
  ["Vertex defs (structs)",    "vertex_defs.glsl",                  "shared"],
  ["Spark v1 — fragment",      "shader_spark_v1.frag",              "spark"],
  ["Spark v2 — fragment",      "shader_spark_v2.frag",              "spark"],
  ["Spark star v1 — vertex",   "shader_spark_star_v1.vert",         "spark"],
  ["Spark star v2 — vertex",   "shader_spark_star_v2.vert",         "spark"],
  ["Spark trail v1 — vertex",  "shader_spark_trail_v1.vert",        "spark"],
  ["Spark trail v2 — vertex",  "shader_spark_trail_v2.vert",        "spark"],
  ["Smoke — fragment",         "shader_smoke.frag",                 "smoke"],
  ["Smoke star — vertex",      "shader_smoke_star.vert",            "smoke"],
  ["Smoke trail — vertex",     "shader_smoke_trail.vert",           "smoke"],
  ["Flame — fragment",         "shader_flame.frag",                 "flame"],
  ["Flame trail — vertex",     "shader_flame_trail.vert",           "flame"],
  ["Light beam — fragment",    "shader_light_beam_star.frag",       "lightbeam"],
  ["Light beam — vertex",      "shader_light_beam_star.vert",       "lightbeam"],
  ["Mesh — fragment",          "shader_mesh.frag",                  "mesh"],
  ["Mesh — vertex",            "shader_mesh.vert",                  "mesh"],
  ["Mesh reflective — vertex", "shader_meshReflective.vert",        "mesh"],
  ["GLTF — fragment",          "shader_gltf.frag",                  "mesh"],
  ["GLTF — vertex",            "shader_gltf.vert",                  "mesh"],
  ["Reflective — fragment",    "shader_reflective.frag",            "mesh"],
  ["Tonemap — fragment",       "shader_tonemap.frag",               "post"],
  ["Tonemap (cubemap) — frag", "shader_tonemap_with_cubemap.frag",  "post"],
  ["Gaussian blur — fragment", "shader_gaussianBlur.frag",          "post"],
  ["Composite — fragment",     "shader_compositeTextures.frag",     "post"],
  ["Postprocess — fragment",   "shader_postProcess.frag",           "post"],
  ["Fullscreen — vertex",      "shader_fullscreen.vert",            "post"],
  ["Physics pre — vertex",     "physics_pre.vert",                  "physics"],
  ["Physics inline — vert.h",  "physics_inline.hpp.vert",           "physics"],
  ["Physics post — vertex",    "physics_post.vert",                 "physics"],
  ["Rect2D — fragment",        "shader_rect2d.frag",                "ui"],
  ["Rect2D — vertex",          "shader_rect2d.vert",                "ui"],
  ["Line — fragment",          "shader_line.frag",                  "ui"],
  ["Line — vertex",            "shader_line.vert",                  "ui"],
];

const FAMILIES = {
  shared:    { label: "Partagés",       color: "#9aa0ad" },
  spark:     { label: "Sparks",         color: "#ffd60a" },
  smoke:     { label: "Smoke",          color: "#a374e6" },
  flame:     { label: "Flame",          color: "#ff7a3d" },
  lightbeam: { label: "Light beam",     color: "#0091ff" },
  mesh:      { label: "Mesh / GLTF",    color: "#46a758" },
  post:      { label: "Post-process",   color: "#e5484d" },
  physics:   { label: "Physique",       color: "#f5a524" },
  ui:        { label: "UI / 2D",        color: "#9aa0ad" },
};

let _navigateGlobal = null;

export function renderGpuLab(main, navigate) {
  _navigateGlobal = navigate;
  main.append(pageHeader(
    "GPU Lab",
    "Exploration du pipeline graphique embarqué et sondage du compilateur d'effets WASM.",
    [el("button", { class: "btn", onClick: () => navigate("home") }, "← Accueil")]
  ));

  // ---- Onglets ----
  let activeTab = "shaders";
  const tabsEl = el("div", { class: "tabs" });
  const body = el("div", { class: "lab-body" });
  main.append(tabsEl, body);

  function setTab(name) {
    activeTab = name;
    [...tabsEl.children].forEach((c) =>
      c.classList.toggle("active", c.dataset.tab === name));
    body.innerHTML = "";
    if (name === "shaders") body.appendChild(buildShadersTab());
    else if (name === "wasm") body.appendChild(buildWasmTab());
    else if (name === "fin") body.appendChild(buildFinTab());
    else body.appendChild(buildSummaryTab());
  }

  for (const [key, label] of [["summary", "Résumé"], ["shaders", "Shaders GLSL"], ["wasm", "WASM compilateur"], ["fin", "Inspecteur .fin"]]) {
    const b = el("button", { class: "tab", "data-tab": key,
      onClick: () => setTab(key) }, label);
    tabsEl.appendChild(b);
  }
  setTab("shaders");
}

// ---- Shaders ---------------------------------------------------------------

function buildShadersTab() {
  const root = el("div", {});
  const list = el("div", { class: "lab-shader-list" });
  const detail = el("pre", { class: "lab-shader-detail" }, "Sélectionnez un shader.");

  // Filtre famille
  const filterRow = el("div", { class: "lab-filters" });
  let activeFamily = "all";
  const families = ["all", ...Object.keys(FAMILIES)];
  for (const f of families) {
    const cnt = f === "all"
      ? SHADERS.length
      : SHADERS.filter((s) => s[2] === f).length;
    const btn = el("button", {
      class: "tab" + (f === activeFamily ? " active" : ""),
      onClick: () => { activeFamily = f; redraw(); },
    }, f === "all" ? `Tous (${cnt})` : `${FAMILIES[f].label} (${cnt})`);
    filterRow.appendChild(btn);
  }
  root.appendChild(filterRow);
  root.appendChild(el("div", { class: "lab-shader-grid" }, list, detail));

  function redraw() {
    [...filterRow.children].forEach((c, i) => {
      c.classList.toggle("active", families[i] === activeFamily);
    });
    list.innerHTML = "";
    const items = activeFamily === "all"
      ? SHADERS
      : SHADERS.filter((s) => s[2] === activeFamily);
    for (const [label, file, family] of items) {
      const fam = FAMILIES[family];
      const item = el("button", {
        class: "lab-shader-item",
        style: { borderLeftColor: fam.color },
        onClick: async () => {
          [...list.children].forEach((c) => c.classList.remove("active"));
          item.classList.add("active");
          detail.textContent = "Chargement…";
          try {
            const txt = await fetch(SHADER_PATH + file).then((r) => {
              if (!r.ok) throw new Error("HTTP " + r.status);
              return r.text();
            });
            detail.textContent = analyzeShader(txt);
          } catch (e) {
            detail.textContent = "Échec du chargement : " + e.message +
              "\n\n(En NW.js, l'app doit servir les fichiers via file:// — " +
              "vérifiez que le chemin app.nw/gpu/ existe à côté de app/.)";
          }
        },
      },
        el("span", { class: "lab-shader-fam",
          style: { background: fam.color } }),
        el("span", {}, label));
      list.appendChild(item);
    }
  }
  redraw();
  return root;
}

function analyzeShader(text) {
  const lines = text.split("\n");
  const uniforms = lines.filter((l) => /^\s*uniform\s/.test(l));
  const ins = lines.filter((l) => /^\s*in\s/.test(l));
  const outs = lines.filter((l) => /^\s*out\s/.test(l));
  const structs = lines.filter((l) => /^\s*struct\s/.test(l));
  return [
    `// Lignes : ${lines.length}`,
    `// Uniforms : ${uniforms.length}`,
    `// In / Out : ${ins.length} / ${outs.length}`,
    `// Structs : ${structs.length}`,
    "",
    "// ===== UNIFORMS =====",
    ...uniforms.map((l) => "  " + l.trim()),
    "",
    "// ===== INPUTS =====",
    ...ins.map((l) => "  " + l.trim()),
    "",
    "// ===== OUTPUTS =====",
    ...outs.map((l) => "  " + l.trim()),
    "",
    "// ===== SOURCE COMPLÈTE =====",
    text,
  ].join("\n");
}

// ---- WASM probe -----------------------------------------------------------

function buildWasmTab() {
  const root = el("div", {});
  root.appendChild(el("p", { class: "page-subtitle" },
    "Le compilateur d'effets Finale 3D est un module C++ (Emscripten + Embind). " +
    "Cette page tente de le charger pour inspecter son interface. " +
    "Sans la glue JS d'origine extraite du bundle, l'instanciation complète " +
    "n'est pas garantie — mais on peut au moins lire les imports/exports."));

  const status = el("div", { class: "lab-wasm-status" }, "État : non chargé.");
  const probeBtn = el("button", {
    class: "btn btn-primary",
    onClick: () => probe(),
  }, "Sonder vdl_effect_compiler.wasm");
  const probeTinyBtn = el("button", {
    class: "btn",
    onClick: () => probeTiny(),
  }, "Sonder tinyexr.wasm");
  const out = el("pre", { class: "lab-wasm-output" }, "");

  root.append(
    el("div", { style: "display: flex; gap: 8px; margin: 12px 0;" },
      probeBtn, probeTinyBtn),
    status, out);

  async function probe() {
    status.textContent = "Téléchargement du WASM…";
    out.textContent = "";
    try {
      const buf = await fetch(WASM_PATH).then((r) => r.arrayBuffer());
      status.textContent = `Taille : ${(buf.byteLength / 1024 / 1024).toFixed(1)} Mo`;
      const mod = await WebAssembly.compile(buf);
      const imports = WebAssembly.Module.imports(mod);
      const exports = WebAssembly.Module.exports(mod);
      const lines = [];
      lines.push(`// Module compilé.`);
      lines.push(`// Imports requis : ${imports.length}`);
      lines.push(`// Exports : ${exports.length}`);
      lines.push("");
      lines.push("// ===== IMPORTS =====");
      for (const i of imports) lines.push(`  ${i.module}.${i.name} : ${i.kind}`);
      lines.push("");
      lines.push("// ===== EXPORTS =====");
      for (const e of exports) lines.push(`  ${e.name} : ${e.kind}`);
      lines.push("");
      lines.push("// Pour instancier complètement ce module et exposer les");
      lines.push("// classes embind (Vdl_effectCompiler, etc.), il faut :");
      lines.push("//   1. fournir une mémoire WebAssembly initiale ≥ 22 Mo");
      lines.push("//   2. implémenter les imports embind (_embind_register_*)");
      lines.push("//   3. configurer wasi_snapshot_preview1.fd_* en stub");
      lines.push("//   4. appeler __wasm_call_ctors pour déclencher la");
      lines.push("//      registration embind, qui peuple un registre JS");
      lines.push("//      d'où l'on peut extraire les classes/méthodes.");
      lines.push("");
      lines.push("// Le bundle d'origine fait tout ça via la glue Emscripten");
      lines.push("// minifiée. La reproduire est faisable mais conséquent.");
      out.textContent = lines.join("\n");
    } catch (e) {
      status.textContent = "Échec : " + e.message;
      out.textContent = String(e.stack || e.message);
      toast("WASM introuvable ou incompatible.");
    }
  }

  async function probeTiny() {
    status.textContent = "Téléchargement de tinyexr…";
    out.textContent = "";
    try {
      const buf = await fetch(TINYEXR_PATH).then((r) => r.arrayBuffer());
      status.textContent = `tinyexr : ${(buf.byteLength / 1024).toFixed(1)} Ko`;
      const mod = await WebAssembly.compile(buf);
      const exports = WebAssembly.Module.exports(mod);
      const imports = WebAssembly.Module.imports(mod);
      out.textContent = [
        `// tinyexr.wasm — décodeur d'images HDR (.exr)`,
        `// Imports : ${imports.length}, Exports : ${exports.length}`,
        "",
        "// EXPORTS:",
        ...exports.map((e) => `  ${e.name} : ${e.kind}`),
      ].join("\n");
    } catch (e) {
      status.textContent = "Échec : " + e.message;
      out.textContent = String(e.message);
    }
  }

  return root;
}

// ---- Inspecteur .fin ------------------------------------------------------

function buildFinTab() {
  const root = el("div", {});
  root.appendChild(el("p", { class: "page-subtitle" },
    "Charge un fichier .fin (format natif Finale 3D, Protocol Buffers binaire) " +
    "et affiche sa structure brute. Sans le descripteur .proto, les noms de " +
    "champs ne sont pas connus — on lit les tags numériques. C'est suffisant " +
    "pour repérer les chaînes (titres, noms d'effets) et la hiérarchie."));

  const fileBtn = el("button", {
    class: "btn btn-primary",
    onClick: () => pick(),
  }, "Choisir un fichier .fin…");

  const status = el("div", { class: "lab-wasm-status" }, "Aucun fichier chargé.");
  const summary = el("div", { class: "stats", style: "display: none;" });
  const out = el("pre", { class: "lab-wasm-output" }, "");
  const stringsBox = el("pre", { class: "lab-wasm-output", style: "display: none;" }, "");
  const tabBar = el("div", { class: "tabs" });

  let lastTree = null;
  let lastFileName = "";
  let currentView = "tree";

  const importBtn = el("button", {
    class: "btn btn-primary",
    style: "display: none;",
    onClick: () => {
      if (!lastTree) return;
      const mapping = mapFinTreeToCues(lastTree);
      if (!mapping.cues.length) {
        toast(mapping.warnings[0] || "Aucun cue trouvé.");
        return;
      }
      const sh = createShow("Import .fin — " + (lastFileName.replace(/\.fin$/i, "") || "spectacle"));
      sh.duration = mapping.duration;
      sh.cues = mapping.cues;
      sh.description = `Importé depuis ${lastFileName}. ${mapping.cues.length} cue(s) déduit(s) sur ${mapping.candidatesCount} candidat(s) protobuf.`;
      saveState();
      toast(`${mapping.cues.length} cue(s) importé(s) vers « ${sh.name} ».`);
      if (_navigateGlobal) _navigateGlobal("editor", { id: sh.id });
    },
  }, "→ Importer dans un nouveau spectacle");

  function setView(v) {
    currentView = v;
    [...tabBar.children].forEach((c) => c.classList.toggle("active", c.dataset.v === v));
    out.style.display = v === "tree" ? "" : "none";
    stringsBox.style.display = v === "strings" ? "" : "none";
  }
  for (const [v, label] of [["tree", "Arbre"], ["strings", "Chaînes lisibles"]]) {
    const b = el("button", { class: "tab", "data-v": v,
      onClick: () => setView(v) }, label);
    tabBar.appendChild(b);
  }

  root.append(
    el("div", { style: "display: flex; gap: 8px; margin: 12px 0;" }, fileBtn, importBtn),
    status, summary, tabBar, out, stringsBox);

  function pick() {
    const inp = el("input", {
      type: "file",
      accept: ".fin,.us,application/octet-stream",
      style: "display: none;",
      onChange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          status.textContent = `Lecture de ${f.name} (${(f.size / 1024).toFixed(1)} Ko)…`;
          const buf = new Uint8Array(await f.arrayBuffer());
          // Tente de décoder. Beaucoup de .fin ont un préambule ou sont
          // compressés (zstd) — on essaie aussi sur un offset varié.
          let tree = null;
          let usedOffset = 0;
          for (const off of [0, 4, 8, 16]) {
            try {
              const t = decodeMessage(buf, off);
              if (t.length > 0) { tree = t; usedOffset = off; break; }
            } catch {}
          }
          if (!tree) {
            status.textContent = "Format non reconnu (peut-être zstd ou autre encapsulation).";
            out.textContent = "";
            return;
          }
          lastTree = tree;
          lastFileName = f.name;
          importBtn.style.display = "";
          const s = stats(tree);
          status.textContent = `${f.name} décodé (offset ${usedOffset}) : ${s.fields} champs, ${s.messages} sous-messages, ${s.strings} chaînes, profondeur max ${s.maxDepth}.`;
          summary.style.display = "";
          summary.innerHTML = "";
          summary.append(
            statTile("Champs", s.fields),
            statTile("Sous-messages", s.messages),
            statTile("Chaînes", s.strings),
            statTile("Profondeur", s.maxDepth));

          out.textContent = pretty(tree).slice(0, 60000) +
            (s.fields > 1500 ? "\n\n... (tronqué)" : "");
          stringsBox.textContent = collectStrings(tree).join("\n");
          setView("tree");
        } catch (err) {
          status.textContent = "Échec : " + err.message;
          out.textContent = String(err.stack || err.message);
          toast(".fin illisible.");
        }
      },
    });
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => inp.remove(), 1000);
  }

  return root;
}

function collectStrings(tree) {
  const out = [];
  for (const f of tree) {
    if (f.asString != null && f.asString.length > 1) {
      out.push(f.asString);
    }
    if (f.asMessage) out.push(...collectStrings(f.asMessage));
  }
  return out;
}

// ---- Résumé ---------------------------------------------------------------

function buildSummaryTab() {
  const root = el("div", { class: "lab-summary" });
  const families = Object.entries(FAMILIES).map(([key, fam]) => {
    const count = SHADERS.filter((s) => s[2] === key).length;
    return { key, fam, count };
  });
  const totalShaders = SHADERS.length;

  const grid = el("div", { class: "stats" });
  grid.append(
    statTile("Shaders inventoriés", totalShaders),
    statTile("Familles", Object.keys(FAMILIES).length),
    statTile("WASM compilateur", "32 Mo"),
    statTile("WASM tinyexr", "164 Ko"),
  );
  root.appendChild(grid);

  root.appendChild(el("h2", { class: "section-title" }, "Pipeline Finale 3D — vue d'ensemble"));
  root.appendChild(el("ol", { class: "lab-pipeline" },
    li("Compilateur VDL", "Le WASM transforme la description de l'effet (arbre Effect → Shot → Launch + Break → ...) en buffers GPU : ParticleState[], EmitterInfo, courbes indexées."),
    li("Physics pre/inline/post", "Vertex shaders qui mettent à jour les particules à chaque frame : pos += vel*dt, gravité, vent, friction. Évalue les courbes paramétriques."),
    li("Rendu par primitive", "Fragment shaders dédiés : sparks v1/v2 (étoiles + traînes), smoke, flame, light beam. Chacun consomme son propre InfoStruct."),
    li("Mesh / GLTF / Reflective", "Pour le décor (terrain, public, modèles SketchUp). Réflexion via texture cubemap."),
    li("Post-process", "Tonemap (LUT 3D + cubemap), gaussian blur (multi-passes), composite, autres effets écran."),
  ));

  root.appendChild(el("h2", { class: "section-title" }, "Familles de shaders"));
  const list = el("div", { class: "lab-fam-grid" });
  for (const f of families) {
    list.appendChild(el("div", {
      class: "lab-fam-tile",
      style: { borderLeftColor: f.fam.color },
    },
      el("strong", {}, f.fam.label),
      el("span", { class: "page-subtitle" }, ` — ${f.count} shader(s)`)));
  }
  root.appendChild(list);

  return root;
}

function statTile(label, value) {
  return el("div", { class: "stat-tile" },
    el("div", { class: "stat-tile-value" }, String(value)),
    el("div", { class: "stat-tile-label" }, label));
}

function li(title, body) {
  return el("li", {},
    el("strong", {}, title), " — ", el("span", {}, body));
}
