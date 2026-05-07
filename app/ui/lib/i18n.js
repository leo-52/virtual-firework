// Table centrale de libellés FR. Source de vérité pour toutes les vues.
// À enrichir au fil des sessions ; pour la session 3 on couvre menus,
// actions, libellés VDL, et messages courants.
//
// Usage : import { t } from "./lib/i18n.js"; t("menu.file")

const FR = {
  // ---- Menus
  "menu.file":       "Fichier",
  "menu.edit":       "Édition",
  "menu.view":       "Affichage",
  "menu.effect":     "Effet",
  "menu.tools":      "Outils",
  "menu.help":       "Aide",

  // ---- Fichier
  "file.new":        "Nouveau spectacle",
  "file.open":       "Ouvrir…",
  "file.save":       "Enregistrer",
  "file.saveAs":     "Enregistrer sous…",
  "file.import":     "Importer",
  "file.importKml":  "Importer un fichier KML…",
  "file.importJson": "Importer un fichier JSON…",
  "file.export":     "Exporter",
  "file.exportJson": "Exporter en JSON",
  "file.exportCsv":  "Exporter le bon de commande (CSV)",
  "file.print":      "Imprimer…",
  "file.recent":     "Spectacles récents",
  "file.quit":       "Quitter",

  // ---- Édition
  "edit.undo":       "Annuler",
  "edit.redo":       "Rétablir",
  "edit.cut":        "Couper",
  "edit.copy":       "Copier",
  "edit.paste":      "Coller",
  "edit.duplicate":  "Dupliquer",
  "edit.delete":     "Supprimer",
  "edit.selectAll":  "Tout sélectionner",
  "edit.deselect":   "Désélectionner",
  "edit.find":       "Rechercher…",

  // ---- Affichage
  "view.home":       "Accueil",
  "view.shows":      "Spectacles",
  "view.editor":     "Éditeur",
  "view.library":    "Bibliothèque",
  "view.viewer":     "Visualiseur",
  "view.orders":     "Commandes",
  "view.settings":   "Paramètres",
  "view.toggleSidebar": "Afficher/masquer la barre latérale",
  "view.toggleInspector": "Afficher/masquer l'inspecteur",
  "view.fullscreen": "Plein écran",

  // ---- Effet
  "effect.add":      "Ajouter un effet…",
  "effect.library":  "Ouvrir la bibliothèque",
  "effect.favoriteToggle": "Marquer comme favori",
  "effect.createCustom": "Créer un effet personnalisé…",

  // ---- Outils
  "tools.simulator": "Simulateur 2D",
  "tools.finale3d":  "Moteur Finale 3D",
  "tools.networkShield": "Bouclier réseau",
  "tools.diagnostics": "Diagnostic de rendu",

  // ---- Aide
  "help.about":      "À propos",
  "help.shortcuts":  "Raccourcis clavier",
  "help.roadmap":    "Feuille de route",

  // ---- Commun
  "ok":              "OK",
  "cancel":          "Annuler",
  "save":            "Enregistrer",
  "close":           "Fermer",
  "delete":          "Supprimer",
  "duplicate":       "Dupliquer",
  "edit":            "Éditer",
  "search":          "Rechercher…",
  "filter":          "Filtrer",
  "all":             "Tout",
  "yes":             "Oui",
  "no":              "Non",
  "loading":         "Chargement…",
  "empty":           "Aucun élément",

  // ---- Cues / Timeline
  "cue":             "Cue",
  "cues":            "Cues",
  "cue.time":        "Temps",
  "cue.quantity":    "Quantité",
  "cue.position":    "Position",
  "cue.angle":       "Angle",
  "cue.duration":    "Durée",
  "timeline":        "Timeline",
  "timeline.zoom":   "Zoom",
  "timeline.fit":    "Ajuster",

  // ---- Library
  "library.title":   "Bibliothèque d'effets",
  "library.favorites": "Favoris",
  "library.custom":  "Mes effets",
  "library.builtIn": "Catalogue",
  "library.subtype": "Style visuel",
  "library.partType": "Type de pièce",
  "library.color":   "Couleur dominante",
  "library.caliber": "Calibre",
  "library.price":   "Prix",
  "library.vendor":  "Fournisseur",

  // ---- Inspector
  "inspector.title": "Inspecteur",
  "inspector.empty": "Sélectionnez un cue pour voir ses propriétés.",
  "inspector.props": "Propriétés",
  "inspector.timing": "Synchronisation",
  "inspector.geometry": "Géométrie",
  "inspector.appearance": "Apparence",

  // ---- Géo / KML
  "geo.title":       "Placement",
  "geo.location":    "Lieu de tir",
  "geo.coords":      "Coordonnées",
  "geo.import":      "Importer un fichier KML",
  "geo.placeholder": "Aucun lieu défini",

  // ---- Visual subtypes (VDL)
  "subtype.peony":          "Pivoine",
  "subtype.chrysanthemum":  "Chrysanthème",
  "subtype.willow":         "Saule",
  "subtype.palm":           "Palmier",
  "subtype.brocade":        "Brocart",
  "subtype.kamuro":         "Kamuro",
  "subtype.crossette":      "Crossette",
  "subtype.dahlia":         "Dahlia",
  "subtype.diadem":         "Diadème",
  "subtype.fallingLeaves":  "Feuilles tombantes",
  "subtype.ring":           "Anneau",
  "subtype.wave":           "Onde",
  "subtype.comet":          "Comète",
  "subtype.mine":           "Mine",
  "subtype.cake":           "Batterie",
  "subtype.ground":         "Effet sol",
  "subtype.sfx":            "Effet sonore",
  "subtype.light":          "Effet lumineux",
  "subtype.other":          "Autre",

  // ---- Part types (packaging)
  "partType.shell":         "Bombe",
  "partType.candle":        "Chandelle",
  "partType.cake":          "Batterie",
  "partType.singleShot":    "Coup unique",
  "partType.mortar":        "Mortier",
  "partType.rocket":        "Fusée",
  "partType.mine":          "Mine",
  "partType.fountain":      "Fontaine",
  "partType.gerb":          "Gerbe",
  "partType.comet":         "Comète",
  "partType.flame":         "Flamme",
  "partType.rack":          "Rampe",
  "partType.sfx":           "SFX",
  "partType.light":         "Lumière",
  "partType.other":         "Autre",
};

export function t(key, fallback) {
  return FR[key] ?? fallback ?? key;
}

export function tList(prefix) {
  const out = {};
  for (const k of Object.keys(FR)) {
    if (k.startsWith(prefix + ".")) out[k.slice(prefix.length + 1)] = FR[k];
  }
  return out;
}

export const i18n = FR;
