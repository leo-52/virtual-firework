#!/usr/bin/env python3
"""Met à jour le moteur de feux du simulateur de site 3D (« Reconnaissance de site 3D — JPA »,
fichier simu_3d_vNNN.html) à partir du moteur PrevoFX (src/render/threeFireworks.js).

Usage :
    python3 outils/faire_moteur_simu.py simu_3d_v142.html simu_3d_v143.html

Ce que fait le script (mêmes transformations que l'ancien _feux/faire_moteur.py, + B381-B389) :
  1. moteur PrevoFX -> bloc autonome `var PFX = (function(){ ... })();` (pas de modules ES :
     THREE est global, les `import` sont retirés, la couche Cesium `ThreeFireworks` aussi) ;
  2. tailles d'écran des matériaux branchées sur `PFX_VUE` (réglées par le simulateur) ;
  3. `calScale()` : facteur de calibre interpolé (bombettes de 20, 25 mm… absentes de CAL_SCALE) ;
  4. options propres au simulateur dans `new Shell(..., opts)` : envMul (envergure au calibre),
     colors, riseColor ;
  5. exports : scene, Shell, updateTrails, updatePuffs, updateSmoke, shellLights, setupBloomPass,
     BLOOM_DEF, EFFECTS, LABELS, CAL_SCALE, APEX_SCALE, calScale, BUILD, C (couleurs) ;
  6. dans la page : remplace l'ancien moteur, puis raccorde le rendu des feux du simulateur à la
     lueur ronde (setupBloomPass, BLOOM_DEF), à la taille angulaire des étoiles (plus de correction
     de champ faite à la main) et à la fumée (updateSmoke + shellLights) ;
  7. réglage de LUEUR propre au simulateur (`var PFX_REGLAGES`, gardé s'il existe déjà) ;
  8. module « Surface d'eau » (outils/simu3d/eau.js) : panneau Scène + reflets des feux, installé
     ou mis à jour.
"""
import pathlib
import re
import sys

ICI = pathlib.Path(__file__).resolve().parent
SOURCE = ICI.parent / 'src' / 'render' / 'threeFireworks.js'

MARQUE = "// ── Moteur d'effets PREVOFX (genere par"

OPTS_SIMU = (
    "    // (simu 3D) envergure a l'echelle du calibre de la bombette : la vitesse d'eclatement (donc le diametre, ~v/frein) suit le calibre\n"
    "    if (opts && opts.envMul) { const kT = Math.max(0.3, opts.envMul); this.cfg.speedMul *= opts.envMul; this.cfg.riseLean *= opts.envMul; "
    "this.cfg.headSize *= kT; this.cfg.starSize *= kT; if (this.cfg.splitStarSize) this.cfg.splitStarSize *= kT; "
    "if (this.cfg.trailing) this.cfg.trailing = Object.assign({}, this.cfg.trailing, { grain: this.cfg.trailing.grain * kT }); "
    "if (this.cfg.riseSparks) this.cfg.riseSparks = Object.assign({}, this.cfg.riseSparks, { size: (this.cfg.riseSparks.size || 1) * kT }); "
    "if (this.cfg.burstSparks) this.cfg.burstSparks = Object.assign({}, this.cfg.burstSparks, { sp: this.cfg.burstSparks.sp * opts.envMul }); }\n"
    "    if (opts && opts.colors) this.cfg.colors = opts.colors;\n"
    "    if (opts && opts.riseColor) this.cfg.riseColor = opts.riseColor;\n"
)

CALSCALE = (
    "function calScale(c){ if (CAL_SCALE[c]) return CAL_SCALE[c]; const k=Object.keys(CAL_SCALE).map(Number).sort((x,y)=>x-y); "
    "if (c<=k[0]) return CAL_SCALE[k[0]]*c/k[0]; for (let i=1;i<k.length;i++) if (c<k[i]) { const t=(c-k[i-1])/(k[i]-k[i-1]); "
    "return CAL_SCALE[k[i-1]]+t*(CAL_SCALE[k[i]]-CAL_SCALE[k[i-1]]); } return CAL_SCALE[k[k.length-1]]*c/k[k.length-1]; }\n"
)

# Dosage de la LUEUR propre au simulateur (le moteur le lit s'il existe : PrevoFX, lui, n'en a pas).
# user (23/10/2026) : « y'a encore du halo » -> lueur générale de la v142 (0,3) + halo léger par étoile.
# Modifiable à la main dans la page : le générateur GARDE la ligne existante à la régénération.
REGLAGES_DEFAUT = ("var PFX_REGLAGES = { star: { haloPx: 5, haloI: 0.02, halo2I: 0.0 }, trail: { haloI: 0.015, halo2I: 0.0 }, "
                   "bloom: [0.15, 0.0, 0.75], air: 0.25 };   // lueur du simulateur (star/trail : halos par étoile ; bloom : force, rayon, seuil ; air : lueur de l'air autour des bombes)")
REGLAGES_MARQUE = "@@REGLAGES@@"

RETOUR = (
    "\nreturn { scene, Shell, updateTrails, updatePuffs, updateSmoke, shellLights, setupBloomPass, BLOOM_DEF, BUILD,\n"
    "  EFFECTS, LABELS, CAL_SCALE, APEX_SCALE, calScale,\n"
    "  C: { GOLD, DIMGOLD, SILVER, PINK, CYAN, YEL, GRN, BLU, RED, PURP, WHITE, COPPER, WARMSILVER, EGGGOLD } };\n"
    "})();\n"
)


def remplace_une(s, avant, apres, quoi):
    if avant not in s:
        sys.exit(f'motif introuvable ({quoi}) : {avant[:80]!r}')
    return s.replace(avant, apres, 1)


def moteur():
    s = SOURCE.read_text(encoding='utf-8')
    # 1. imports ES retirés (THREE est global dans la page)
    s = re.sub(r"^import [^\n]*\n", "\n", s, flags=re.M)
    # 2. tailles d'écran -> PFX_VUE
    s, n = re.subn(r"uH:\{value:0\.5\*\(innerHeight\|\|800\)\*k\}", "uH:PFX_VUE.uH", s)
    if n < 2:
        sys.exit(f'uH : {n} occurrence(s) seulement (attendu >= 2)')
    s = remplace_une(s, "uVp:{value:new THREE.Vector2(0.5*(innerWidth||1280)*k, 0.5*(innerHeight||800)*k)}",
                     "uVp:PFX_VUE.uVp", 'uVp')
    # 3. calScale : après la ligne CAL_SCALE ; toutes les lectures « CAL_SCALE[this.cal]||1 »
    m = re.search(r"^const CAL_SCALE = [^\n]*\n", s, flags=re.M)
    if not m:
        sys.exit('ligne CAL_SCALE introuvable')
    s = s[:m.end()] + CALSCALE + s[m.end():]
    s = s.replace("CAL_SCALE[this.cal]||1", "calScale(this.cal)")
    # 4. options du simulateur dans le constructeur de Shell
    m = re.search(r"^    if \(opts && opts\.color\) this\.cfg\.color = opts\.color;[^\n]*\n", s, flags=re.M)
    if not m:
        sys.exit('ligne opts.color introuvable')
    s = s[:m.end()] + OPTS_SIMU + s[m.end():]
    # 5. exports ES -> déclarations ; couche Cesium retirée
    s = re.sub(r"^export (const|let|function|class) ", r"\1 ", s, flags=re.M)
    i0 = s.find("class ThreeFireworks {")
    i1 = s.find("// Réglages d'aspect lus par main.js")
    if i0 < 0 or i1 < 0 or i1 < i0:
        sys.exit('bloc ThreeFireworks introuvable')
    s = s[:i0] + s[i1:]
    s = re.sub(r"^export \{[^\n]*\n", "", s, flags=re.M)
    if re.search(r"^\s*(import|export)\b", s, flags=re.M):
        sys.exit('il reste un import/export')
    entete = ("// ── Moteur d'effets PREVOFX (genere par outils/faire_moteur_simu.py depuis vf-web/src/render/threeFireworks.js) ──\n"
              + REGLAGES_MARQUE + "\n"
              "var PFX_VUE = { uH: { value: 400 }, uVp: { value: new THREE.Vector2(640, 400) } };\n"
              "var PFX = (function () {\n")
    return entete + s + RETOUR


def page(html, mot):
    # remplace l'ancien moteur (de la marque jusqu'à la fin du <script id="moteur_feux">)
    i0 = html.find(MARQUE)
    i1 = html.find("</script>", i0)
    if i0 < 0 or i1 < 0:
        sys.exit('ancien moteur introuvable dans la page')
    m = re.search(r"^var PFX_REGLAGES = [^\n]*$", html[i0:i1], flags=re.M)
    mot = mot.replace(REGLAGES_MARQUE, m.group(0) if m else REGLAGES_DEFAUT, 1)
    html = html[:i0] + mot + html[i1:]
    # lueur ronde + réglages B381 sur le bloom du simulateur
    if "PFX.setupBloomPass(bloom, r)" not in html: html = remplace_une(html,
        "const bloom = new PFX_POST.UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.22, 0.55);",
        "const bloom = new PFX_POST.UnrealBloomPass(new THREE.Vector2(256, 256), PFX.BLOOM_DEF[0], PFX.BLOOM_DEF[1], PFX.BLOOM_DEF[2]);\n"
        "  PFX.setupBloomPass(bloom, r);   // lueur ronde PrevoFX (B381) : noyau gaussien complet, niveaux larges coupés",
        'bloom du simulateur')
    # tailles : le moteur suit désormais la focale tout seul (taille angulaire B382)
    # (la v143 avait le commentaire AVANT le réglage uVp, qui se retrouvait commenté : on répare)
    COMM = "   // (PrevoFX B382) taille angulaire : le moteur suit la focale lui-même, plus de facteur k"
    html = html.replace("PFX_VUE.uH.value = 0.5 * H * pr;" + COMM + " PFX_VUE.uVp.value.set(0.5 * W * pr, 0.5 * H * pr);",
                        "PFX_VUE.uH.value = 0.5 * H * pr; PFX_VUE.uVp.value.set(0.5 * W * pr, 0.5 * H * pr);" + COMM)
    if "PFX_VUE.uH.value = 0.5 * H * pr;" not in html: html = remplace_une(html,
        "PFX_VUE.uH.value = 0.5 * H * pr * k; PFX_VUE.uVp.value.set(0.5 * W * pr, 0.5 * H * pr);",
        "PFX_VUE.uH.value = 0.5 * H * pr; PFX_VUE.uVp.value.set(0.5 * W * pr, 0.5 * H * pr);" + COMM,
        'taille des étoiles')
    # fumée : animée et éclairée par les bombes
    if "PFX.updateSmoke(dt" not in html: html = remplace_une(html,
        "PFX.updateTrails(dt); PFX.updatePuffs(dt);",
        "PFX.updateTrails(dt); PFX.updatePuffs(dt); PFX.updateSmoke(dt, PFX.shellLights(_feu.obus, 8));   // fumée PrevoFX (B381)",
        'mise à jour des feux')
    return eau(html)


# MODULE « SURFACE D'EAU » (v144, user : « une option surface d'eau… rivière, lac, étang… reflets, vagues »)
EAU_JS = ICI / 'simu3d' / 'eau.js'
EAU_UI = """    <div class="section" id="eauSection">
      <p class="titre">Surface d'eau</p>
      <label class="coche" title="Lacs, rivières, étangs et piscines du site (IGN, OpenStreetMap) et surfaces tracées : vagues animées et reflets des feux pendant le tir. Rien n'est changé dans les exports."><input type="checkbox" id="eauReflets" checked> <span>Eau réaliste et reflets des feux</span></label>
      <div>
        <label for="eauVagues" class="regle"><span>Vagues</span><output><span id="eauVaguesTxt">calme</span></output></label>
        <input type="range" id="eauVagues" min="0" max="1" step="0.05" value="0.35" title="De l'eau miroir (étang par temps calme) à une forte houle : déforme et étire les reflets.">
      </div>
      <div class="rang">
        <button id="eauTracer">Tracer une surface d'eau</button>
        <button id="eauEffacer">Effacer</button>
      </div>
      <p class="hint">Les plans d'eau connus sont déjà en eau. Pour un lac, une rivière ou un étang absent : touche ses coins sur le terrain, puis « Terminer l'eau ». Gardée dans le fichier du site, hors export (FWsim fait sa propre eau).</p>
    </div>
"""
EAU_CSS = ("  #terminerEau{display:none;position:absolute;left:50%;top:62px;transform:translateX(-50%);"
           "height:36px;padding:0 18px;background:var(--accent);color:var(--sur-accent);border:none;font:600 13px var(--sans)}\n"
           "  #terminerEau:active{transform:translateX(-50%) translateY(1px)}\n")


def eau(html):
    js = EAU_JS.read_text(encoding='utf-8')
    if 'id="eauSection"' not in html:
        # panneau Scène : après la section « Feu d'artifice » (avant « Postes de tir »)
        a = '    <div class="section">\n      <p class="titre">Postes de tir</p>'
        html = remplace_une(html, a, EAU_UI + a, 'section Postes de tir')
        html = remplace_une(html, '    <button id="terminerZone">Terminer la zone</button>\n',
                            '    <button id="terminerZone">Terminer la zone</button>\n    <button id="terminerEau">Terminer l\'eau</button>\n', 'bouton terminerZone')
        html = remplace_une(html, '</style>', EAU_CSS + '</style>', 'style')
    m = re.search(r'<script id="eau">.*?</script>\n', html, flags=re.S)
    bloc = '<script id="eau">\n' + js + '</script>\n'
    if m:
        html = html[:m.start()] + bloc + html[m.end():]
    else:
        i = html.rfind('</body>')
        html = html[:i] + bloc + html[i:]
    return html


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    mot = moteur()
    html = page(src.read_text(encoding='utf-8'), mot)
    dst.write_text(html, encoding='utf-8')
    b = re.search(r"const BUILD = '(B\d+)'", mot)
    print(f'{dst} écrit — moteur PrevoFX {b.group(1) if b else "?"}')


if __name__ == '__main__':
    main()
