// © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
// Démonstration « rendu des personnages » (avant / après) : node tools/personnage/demo_rendu/build.mjs → dist/Demo_rendu_personnages.html
import * as esbuild from 'esbuild'; import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const here=path.dirname(url.fileURLToPath(import.meta.url)), root=path.resolve(here,'../../..');
const js=(await esbuild.build({ entryPoints:[path.join(here,'demo.js')], bundle:true, write:false, format:'iife', minify:true, target:'es2020',
  loader:{ '.glbz':'binary' }, charset:'utf8', legalComments:'none', logLevel:'silent' })).outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=fs.readFileSync(path.join(here,'demo.html'),'utf8').replace('<!--SCRIPT-->',()=>'<script>'+js+'</script>');
fs.mkdirSync(path.join(root,'dist'),{ recursive:true }); const out=path.join(root,'dist','Demo_rendu_personnages.html'); fs.writeFileSync(out,html);
console.log(`${out} : ${(fs.statSync(out).size/1e6).toFixed(1)} Mo`);
