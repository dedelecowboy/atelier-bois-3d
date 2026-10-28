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

- `degauchisseuse/`, `deligneuse/` : mêmes fichiers. Déligneuse : avivés → 2 × 85 mm, plateau en flache → avivé de 140 mm sans flache, multilames → 4 × 45 mm en une passe ; parcours 94 / 100, 50 interactions ; faute grave « presseurs trop hauts ».
- `scie-format/test_angles.py` : mode libre, onglet à 30° (chant scié à 60° du chant voisin) et biais à 45° (chant marqué 45°, décalage = épaisseur) ; captures `scie-format_onglet30.png`, `scie-format_biais45*.png`. `window.__scie` donne l'état, les pièces et la caméra aux tests.
- `scie-radiale/` : mêmes fichiers. Série → bout affranchi + 4 × 550 mm à la butée ; purge → fente, nœud et gerce dans des chutes courtes ; biais → lame à 45°, 3 × 600 mm à bouts biais parallèles ; gestes refusés (pièce touchée lame en avant, réglages lame en marche, pièce non tenue) ; parcours 94 / 100, 50 interactions ; fautes graves « protecteur trop haut » et « pièce touchée lame en avant ». `window.__radiale` donne l'état (réglages, tête, pièces) aux tests.

- `raboteuse/` : mêmes fichiers. Une pièce → traverse à 70 × 27 (capot interverrouillé, SR1 dessus signalé) ; série → 3 montants à 70 × 27 (hauteurs différentes de front en rouge, de front sans alerte après une passe à la même cote) ; contrôle → chêne non dégauchi classé « À dégauchir » (« section de pièce non rectangulaire »), frêne à 22,0 mm (arrachements contre le fil, effacés bout pour bout) ; parcours 94 / 100, 50 interactions, « Pièces débitées » visibles en scénario ; fautes graves « passe trop forte » et « main vers l'entrée machine en marche ». `window.__rabot` donne l'état, les pièces et leurs mesures aux tests.

- `toupie/` : mêmes fichiers, plus `test_securite.py`. Quart de rond R 10 (9,8 × 10 mm, régulier, bonne arête, repères gardés) ; feuillure 12 × 15 en deux passes (passe de 15 mm signalée) ; série de 3 baguettes moulurées sur toute la rive, sortie avancée de 2 mm (vitesse 9 000 > n max 8 000 et pièce de 220 mm signalées, pièce courte « Interdite au guide ») ; parcours 94 / 100, 50 interactions ; fautes graves « réglage moteur en marche », presseurs et lumière du guide ouverte à la passe, « choc » (saillie changée après la fermeture des lamelles). `test_securite.py` (mode libre) : outil retourné (ne coupe pas), avalant, inverseur et outil refusés moteur en marche, n max, pièce courte, pièce qui bute contre la sortie (dégagement refusé moteur en marche), entaille en bout, arrachements contre le fil, pièce de la raboteuse importée avec ses repères, profil transporté par `pieceJSON`, entraîneur (posé 4 mm sous le dessus à 3°, aucun point du bloc derrière le plan du guide, marche après l'arbre, passe sans poussoir, replacement exigé pour une autre hauteur). `window.__toupie` donne l'état, les pièces et les profils aux tests.

- `tenonneuse/` : mêmes fichiers, plus `test_securite.py`. Tenon simple → 9,0 × 40 à 9,0 mm de SR1, net (scie réglée capot ouvert, dérouleurs en montant, pare-éclat usiné à vide) ; série → 3 traverses tenonnées aux deux bouts, 500,0 mm entre arasements (butée contre l'arasement, SR1 sur la table) ; enfourchement → fraise n max 4 500 changée machine consignée, 2 enfourchements 9 × 40, pièce de 200 mm écartée ; parcours 94 / 100, 50 interactions ; fautes graves « pièce non serrée », « protecteur trop haut », « mains dans la zone des outils », « avance trop rapide », « chariot avancé pendant le chargement ». `test_securite.py` (mode libre) : capot (sélecteur, temporisation), filin et boîtier, lame retournée, dérouleur du mauvais sens, n max, carters, joue trop profonde, guide orienté refusé, butée sur la pièce, chute fine coincée (retrait refusé lame en rotation), éclats sans pare-éclat, SR1 dessus (tenon décalé), arasements décalés, épaulements sur chant, pièce importée, bouts transportés par `pieceJSON`. `window.__tenon` donne l'état, les pièces et les bouts usinés aux tests.

En headless, les pertes de contexte WebGL et les captures lentes ne sont pas des bugs utilisateur.
Le parcours complet prend plusieurs minutes (rendu logiciel).

- `risques/` : module « Risques généraux » (sans machine : la salle entière). `jeux.py` : les quatre scénarios joués au panneau « Actions » (sans faute, et avec fautes) ; `test_exercices.py` : dangers (12 sur 12 avec la bonne mesure, fausse alerte, mauvaise mesure), EPI (4 tenues, gants à la toupie = faute grave), consignation (dans l'ordre ; intervention machine en marche ou après le seul arrêt d'urgence refusée), départ de feu (bilan conforme ; feu entre soi et la sortie, porte enfumée, retour pour le sac) ; `test_parcours.py` : repérage au clic (armoire électrique), parcours 94 / 100, 56 interactions (4 scénarios de 15 points), faute grave → note Moodle 69 et « failed », reprise ; `test_affichage.py`, `test_paquetage.py` comme les machines. `window.__risques` donne l'état, les données et la scène aux tests.
- `scie-ruban/` : mêmes fichiers. Lame → 30 mm sans crique retournée, tension, dents hors du bandage, guide-lames, essai à vide ; chantournage → console côté chute (pilote de test `__ruban.pilot`) ; refente → lame de 20,0 mm, rondin écarté ; gestes refusés (réglages et portes lame en marche, intervention sans consignation, recul dans une courbe, chute à la main), alertes (lame à l'envers, pas, lame qui force, fin de passe sans poussoir, main dans l'axe, protecteur, rupture), rondin au gabarit ; parcours 94 / 100, 51 interactions ; fautes graves « protecteur trop haut » et « chute dégagée à la main ». `window.__ruban` donne l'état, les pièces et l'avance aux tests.
- `paquet/` : 10 éléments (atelier, « 0. Risques généraux », 8 machines), verrous « risques généraux » avant la scie radiale, la scie à format et la scie à ruban, « Ouvrir le module » depuis l'atelier.
