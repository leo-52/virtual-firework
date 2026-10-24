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
REGLAGES_DEFAUT = ("var PFX_REGLAGES = { star: { haloPx: 7, haloI: 0.055, halo2Px: 18, halo2I: 0.012 }, trail: { haloI: 0.035, halo2I: 0.0 }, "
                   "bloom: [0.38, 0.0, 0.68], air: 0.25 };   // lueur du simulateur (B392 : halo FIN et vivant par étoile, lueur ronde douce — pas la grosse boule floue refusée en v143 ; star/trail : halos par étoile ; bloom : force, rayon, seuil ; air : lueur de l'air autour des bombes)")
REGLAGES_MARQUE = "@@REGLAGES@@"

RETOUR = (
    "\nreturn { scene, Shell, updateTrails, updatePuffs, updateSmoke, shellLights, setupBloomPass, BLOOM_DEF, BUILD,\n"
    "  EFFECTS, LABELS, CAL_SCALE, APEX_SCALE, calScale, defDepuisCatalogue, NOMS_COULEUR, couleurNom,\n"
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
      <label class="coche" title="Lacs, rivières, étangs du site et eau ajoutée à la main : eau animée, reflets et reflets des feux pendant le tir. Rien n'est changé dans les exports."><input type="checkbox" id="eauReflets" checked> <span>Eau réaliste</span></label>
      <label class="coche" title="L'eau reflète les bâtiments, les arbres et les berges (une vue de plus à calculer ; coupé en qualité Léger)."><input type="checkbox" id="eauDecor" checked> <span>Reflets du décor</span></label>
      <div>
        <label for="eauVagues" class="regle"><span>Vagues</span><output><span id="eauVaguesTxt">légères</span></output></label>
        <input type="range" id="eauVagues" min="0" max="1" step="0.05" value="0.2" title="De l'eau sans vague (miroir) à une eau agitée par le vent.">
      </div>
      <div class="rang outilsEau">
        <button id="eauOutilNiveau" title="Touche le fond d'un étang, d'un lac ou d'une rivière : l'eau remplit tout ce qui est plus bas que le niveau choisi.">Niveau</button>
        <button id="eauOutilPinceau" title="Glisse sur le terrain pour peindre de l'eau.">Pinceau</button>
        <button id="eauOutilGomme" title="Glisse sur le terrain pour effacer de l'eau.">Gomme</button>
      </div>
      <div>
        <label for="eauNiveau" class="regle"><span>Niveau de l'eau</span><output><span id="eauNiveauTxt">touche un plan d'eau</span></output></label>
        <input type="range" id="eauNiveau" min="-1" max="8" step="0.05" value="0.5" title="Hauteur de l'eau au-dessus du point touché : l'eau monte ou descend et suit les berges.">
      </div>
      <div>
        <label for="eauPinceau" class="regle"><span>Taille du pinceau</span><output><span id="eauPinceauTxt">5 m</span></output></label>
        <input type="range" id="eauPinceau" min="1" max="40" step="0.5" value="5">
      </div>
      <div class="rang"><button id="eauEffacer">Tout effacer</button></div>
      <p class="hint">Les plans d'eau connus sont déjà en eau. « Niveau » remplit un creux jusqu'à la hauteur choisie ; « Pinceau » et « Gomme » ajoutent ou retirent de l'eau (rivière, forme particulière). Gardée dans le fichier du site, hors export.</p>
    </div>
"""
EAU_CSS = ("  .outilsEau button.actif{background:var(--accent-faible);border-color:var(--accent);color:var(--accent2)}\n"
           "  #eauNiveau:disabled{opacity:.45}\n")


def module(html, ident, chemin):
    # installe (ou remplace) <script id="ident"> avec le fichier chemin, juste avant </body>
    if not chemin.exists():
        return html
    bloc = f'<script id="{ident}">\n' + chemin.read_text(encoding='utf-8') + '</script>\n'
    m = re.search(rf'<script id="{ident}">.*?</script>\n', html, flags=re.S)
    if m:
        return html[:m.start()] + bloc + html[m.end():]
    i = html.rfind('</body>')
    return html[:i] + bloc + html[i:]


def eau(html):
    # feux automatiques : traduction désignation -> effet PrevoFX (outils/simu3d/feux_auto.js)
    html = module(html, 'feux_auto', EAU_JS.parent / 'feux_auto.js')
    # section « Surface d'eau » (onglet Scène, avant « Postes de tir ») : posée ou remplacée
    m = re.search(r'    <div class="section" id="eauSection">.*?\n    </div>\n', html, flags=re.S)
    if m:
        html = html[:m.start()] + EAU_UI + html[m.end():]
    else:
        a = '    <div class="section">\n      <p class="titre">Postes de tir</p>'
        html = remplace_une(html, a, EAU_UI + a, 'section Postes de tir')
    html = html.replace('    <button id="terminerEau">Terminer l\'eau</button>\n', '')   # outil de tracé v144 retiré
    html = re.sub(r'  #terminerEau\{[^\n]*\n  #terminerEau:active\{[^\n]*\n', '', html)
    html = re.sub(r'  \.outilsEau button\.actif\{[^\n]*\n  #eauNiveau:disabled\{[^\n]*\n', '', html)
    html = remplace_une(html, '</style>', EAU_CSS + '</style>', 'style')
    return son(module(html, 'eau', EAU_JS))



# ── SON DES FEUX (B391) : src/audio.js (le module de PrevoFX web) + les 7 mp3 embarqués ──────
SON_JS = ICI / 'simu3d' / 'son.js'
AUDIO_JS = ICI.parent / 'src' / 'audio.js'
SONS_DIR = ICI.parent / 'sons'


def module_texte(html, ident, texte):
    # comme module(), mais à partir d'un texte déjà construit
    bloc = f'<script id="{ident}">\n' + texte + '</script>\n'
    m = re.search(rf'<script id="{ident}">.*?</script>\n', html, flags=re.S)
    if m:
        return html[:m.start()] + bloc + html[m.end():]
    i = html.rfind('</body>')
    return html[:i] + bloc + html[i:]


def son(html):
    """Injecte <script id="son"> : outils/simu3d/son.js (crochets + bouton) dans lequel on colle
    src/audio.js transformé en script classique (plus d'export ni d'import.meta ; les mp3 viennent
    du tableau SONS_B64 embarqué au lieu du réseau). Idempotent. Rien si un fichier manque."""
    if not (SON_JS.exists() and AUDIO_JS.exists() and SONS_DIR.exists()):
        return html
    import base64, json
    audio = AUDIO_JS.read_text(encoding='utf-8')
    audio = re.sub(r'^export ', '', audio, flags=re.M)
    audio = remplace_une(audio, "const _V = new URL(import.meta.url).search;", "const _V = '';", 'anti-cache du module son')
    audio = remplace_une(audio, "const MP3_URL = name => new URL('../sons/' + name + '.mp3' + _V, import.meta.url);",
                         "const MP3_URL = name => SONS_AB[name];", 'source des mp3 du module son')
    if 'import.meta' in audio:
        sys.exit('module son : import.meta restant (script classique impossible)')
    b64 = {p.stem: base64.b64encode(p.read_bytes()).decode('ascii') for p in sorted(SONS_DIR.glob('*.mp3'))}
    js = SON_JS.read_text(encoding='utf-8')
    js = remplace_une(js, '/*@@AUDIO@@*/', audio, 'marqueur audio de son.js')
    js = remplace_une(js, '/*@@SONS@@*/{}', json.dumps(b64), 'marqueur mp3 de son.js')
    # le moteur exporte le crochet des mini-marrons (son de chaque détonation du multi-marron)
    html = html.replace("return { scene, Shell, updateTrails,", "return { scene, Shell, __setMarronPop, updateTrails,")
    return module_texte(html, 'son', js)

CATALOGUE_JS = ICI.parent / 'src' / 'render' / 'catalogue.js'


def catalogue(html):
    """B391 : traduction CATALOGUE Prévot -> effet (src/render/catalogue.js), injectée en script
    autonome `var PFX_CATALOGUE = (function(){ ... })();` (exports ES -> retour), idempotent."""
    if not CATALOGUE_JS.exists():
        return html
    s = CATALOGUE_JS.read_text(encoding='utf-8')
    noms = re.findall(r"^export (?:const|let|function) (\w+)", s, flags=re.M)
    s = re.sub(r"^export (const|let|function|class) ", r"\1 ", s, flags=re.M)
    if re.search(r"^\s*(import|export)\b", s, flags=re.M):
        sys.exit('catalogue.js : il reste un import/export')
    bloc = ("// ── Catalogue Prévot -> effet PrevoFX (genere par outils/faire_moteur_simu.py depuis src/render/catalogue.js) ──\n"
            "var PFX_CATALOGUE = (function () {\n" + s + "\nreturn { " + ", ".join(noms) + " };\n})();\n")
    m = re.search(r'<script id="catalogue">.*?</script>\n', html, flags=re.S)
    bloc = '<script id="catalogue">\n' + bloc + '</script>\n'
    if m:
        return html[:m.start()] + bloc + html[m.end():]
    # avant le script feux_auto (qui s'en sert), sinon avant </body>
    i = html.find('<script id="feux_auto">')
    if i < 0:
        i = html.rfind('</body>')
    return html[:i] + bloc + html[i:]


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    mot = moteur()
    html = catalogue(page(src.read_text(encoding='utf-8'), mot))
    dst.write_text(html, encoding='utf-8')
    b = re.search(r"const BUILD = '(B\d+)'", mot)
    print(f'{dst} écrit — moteur PrevoFX {b.group(1) if b else "?"}')


if __name__ == '__main__':
    main()
