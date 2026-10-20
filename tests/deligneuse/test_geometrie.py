"""Déligneuse multilames : contrôle géométrique sans navigateur.
Les rouleaux presseurs restent hors du cercle des lames, quelle que soit leur hauteur (pièce de 0 à 120 mm)
(bug signalé par l'enseignant : rouleaux à ±150 mm, dans les lames Ø 300)."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import ROOT, check, run

def constants():
    js = "import('./machines/deligneuse/constants.js').then(c=>console.log(JSON.stringify(c)))"
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

async def main():
    c = constants()
    R, r, ys = c['R_BLADE'], c['R_ROLL'], c['SHAFT_Y']
    worst = min(((x ** 2 + (ys - (c['TABLE_Y'] + h / 1000 + r)) ** 2) ** 0.5 - R - r, x, h) for x in c['ROLLERS'] for h in range(0, 121))
    check(worst[0] >= 0.0099, f"jeu mini entre lames Ø {round(2*R*1000)} et rouleaux Ø {round(2*r*1000)} : {worst[0]*1000:.1f} mm (rouleau en x = {worst[1]}, pièce de {worst[2]} mm)")

if __name__ == '__main__': run(main)
