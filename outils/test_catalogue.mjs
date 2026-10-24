#!/usr/bin/env node
// Passe TOUT le catalogue (data/effets.json) dans catalogue.js et rend compte de la couverture :
//   node outils/test_catalogue.mjs            -> résumé par type + références encore génériques
//   node outils/test_catalogue.mjs --json f   -> écrit l'inventaire complet (JSON) dans f
//   node outils/test_catalogue.mjs "désignation libre" -> traduit une désignation
import { readFileSync, writeFileSync } from 'node:fs';
import { effetPour, inventaire } from '../src/render/catalogue.js';

const ICI = new URL('.', import.meta.url).pathname;
const refs = JSON.parse(readFileSync(ICI + '../data/effets.json', 'utf8'));
const HORS = new Set(['accessoires','FORMATION','fil','montage','service','allumeurs','composant de chaînes pyrotechniques','batteries de mortiers et mortiers','scene','lampions','']);
const utiles = refs.filter(e => !HORS.has(e.type));

const arg = process.argv[2];
if (arg && arg !== '--json'){ console.log(JSON.stringify(effetPour(arg, +process.argv[3]||undefined), null, 1)); process.exit(0); }

const inv = inventaire(utiles);
let generiques = [], horsP = 0, crees = 0, nCree = 0;
for (const e of utiles){ const r = effetPour(e.designation, e.calibre, { hauteur_m:e.hauteur_m, duree_s:e.duree_s });
  if (r.generique) generiques.push(e); if (r.arch===null) horsP++; if (r.cree) nCree++; }
console.log(`${utiles.length} références utiles (${refs.length - utiles.length} accessoires écartés) — ${inv.length} types d'effet`);
console.log(`hors périmètre : ${horsP} · rabat générique (pivoine par défaut) : ${generiques.length} · passent par un archétype CRÉÉ en B391 : ${nCree}`);
console.log('');
for (const g of inv) console.log(`${String(g.n).padStart(4)}  ${g.cree ? '✚' : ' '} ${g.type.padEnd(56)} -> ${g.arch}   ex: ${g.refs[0].designation.slice(0,60)}`);
if (generiques.length){ console.log('\nENCORE GÉNÉRIQUES :'); for (const e of generiques.slice(0,80)) console.log('  ', e.reference, e.designation); }
if (arg === '--json'){ const f = process.argv[3] || '/tmp/inventaire_catalogue.json';
  const full = utiles.map(e => Object.assign({ reference:e.reference, designation:e.designation, video:e.video_url }, effetPour(e.designation, e.calibre, { hauteur_m:e.hauteur_m, duree_s:e.duree_s })));
  writeFileSync(f, JSON.stringify({ inventaire:inv, references:full }, null, 1)); console.log('\nécrit', f); }
