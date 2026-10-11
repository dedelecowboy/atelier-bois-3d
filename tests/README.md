# Tests

Scénarios Playwright (Python) joués en headless avec chromium + swiftshader, sur les pages fabriquées dans `dist/`.
Les requêtes vers cdn.jsdelivr.net/npm/three@0.160.0 sont servies depuis `node_modules/three`.

```
npm install
npm run build
npm test                          # toutes les machines
python3 tests/run.py scie-format  # une machine
python3 tests/scie-format/test_exercices.py   # un seul fichier
```

- `harness.py` : banc commun (ouverture de la page, fausse API SCORM, outils JS `setR`, `op`, `checks`, `alerts`, `results`…).
- `run.py` : `node --check` du script module extrait, puis tous les `tests/<machine>/test_*.py`.
- `scie-format/` :
  - `jeux.py` : les trois exercices guidés joués comme un élève, résultats attendus ;
  - `test_exercices.py` : format → 800 × 450 ; planche → 160 sans flache ; inciseur → 800 × 400 sans éclat ;
  - `test_parcours.py` : parcours complet (94 / 100, passed, 50 interactions), reprise, faute grave relevée ;
  - `test_paquetage.py` : le zip SCORM servi comme par Moodle (three.js local, `application/x-javascript`) ;
  - `test_affichage.py` : ordinateur 1400 px et téléphone 412 px, captures dans `tests/out/`.

En headless, les pertes de contexte WebGL et les captures lentes ne sont pas des bugs utilisateur.
Le parcours complet prend plusieurs minutes (rendu logiciel).
