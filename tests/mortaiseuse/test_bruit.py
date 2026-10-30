"""Mortaiseuse : bruit ENREGISTRÉ (30/10/2026, engine/sons/mortaise-*.mp3) en deux sources : le groupe hydraulique (mise en route,
pompe qui force au serrage des vérins) et le bédane (mise en route, à vide, plongée en usinage, arrêt). L'exercice « Mortaise à la cote »
joué comme un élève, sonomètre relevé toutes les 50 ms : serrage et usinage entendus, niveaux, alerte « casque » en usinage."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX
import importlib.util
_sp = importlib.util.spec_from_file_location('bruit_scies', os.path.join(os.path.dirname(__file__), '..', 'scie-format', 'test_bruit.py'))
_m = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_m); SON, FIN = _m.SON, _m.FIN
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

async def main():
    html = open(os.path.join(ROOT, 'dist', 'mortaiseuse.html'), encoding='utf-8').read()
    check(html.count('data:audio/mpeg;base64,') == 9, f'mortaiseuse : 9 enregistrements intégrés (pompe ×3, bédane ×4, aspiration ×2), page de {len(html)//1024} Ko')
    async with Page('mortaiseuse') as pg:
        await pg.eval("()=>document.querySelector('[data-mode=simple]').click()")
        s = await pg.eval(SON)
        await pg.eval(js(JEUX['simple']))
        r = await pg.eval(FIN)
        check(s['ech'] and s['sono'] and not s['err'] and not r['err'], f'sonomètre et enregistrements décodés {s["err"]} {r["err"]}')
        check(s['sources'] == ['pompe', 'bedane'], f'deux sources : {s["sources"]}')
        check(r['cuts'].get('0', 0) > 0, f'la pompe force au serrage des vérins ({r["cuts"].get("0", 0)} relevés)')
        check(r['cuts'].get('1', 0) > 0, f'le bédane usine pendant les plongées ({r["cuts"].get("1", 0)} relevés sur {r["n"]})')
        check(82 < r['vide'] < 85, f'à vide (bédane, pompe, aspiration) {r["vide"]:.1f} dB(A), sans alerte')
        check(r['top'] > r['vide'] + 2 and r['alerte'] > 0, f'en usinage jusqu\'à {r["top"]:.1f} dB(A), alerte « casque »')
        check(not pg.errors, 'aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('mortaiseuse_bruit_1400.png'))

if __name__ == '__main__': run(main)
