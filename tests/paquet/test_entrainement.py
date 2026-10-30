# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Dossier d'entraînement hors ligne (dist/Atelier_bois_3D_entrainement.zip, demandé par l'enseignant le 29/10/2026) :
dézippé et ouvert depuis le disque (file://, sans serveur ni internet pour three.js) : l'atelier est la page d'accueil,
chaque module s'ouvre dans le même onglet par « Ouvrir le simulateur », « ← Atelier » ramène à l'atelier ;
pas de Moodle, pas d'évaluation, pas de bascule Moodle ni de modification de l'implantation."""
import asyncio, os, sys, tempfile, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import check, CHROMIUM
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ZIP = os.path.join(ROOT, 'dist', 'Atelier_bois_3D_entrainement.zip')
MODULES = ['risques', 'scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'tenonneuse', 'scie-format', 'scie-ruban', 'mortaiseuse']

async def main():
    d = tempfile.mkdtemp(prefix='entrainement_')
    with zipfile.ZipFile(ZIP) as z:
        names = z.namelist(); z.extractall(d)
    check('index.html' in names and all(f'{m}/index.html' in names for m in MODULES) and not any(n.startswith('lib/') or n.endswith('.xml') for n in names),
          f'zip : atelier en index.html + {len(MODULES)} modules, three.js intégré, pas de manifeste SCORM')
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await br.new_page(viewport={'width': 1400, 'height': 820})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.g*/**', lambda r: r.abort())   # hors ligne : pas de polices Google
        await pg.goto('file://' + os.path.join(d, 'index.html')); await pg.wait_for_function('window.__ready', timeout=120000)
        st = await pg.evaluate("()=>({ n:__atelier.STATIONS.length, edit:document.getElementById('editBtn').hidden, vseg:document.querySelector('.vseg').hidden })")
        check(st['n'] >= 9 and st['edit'] and st['vseg'], f'atelier ouvert depuis le disque : {st["n"]} machines, ni bascule Moodle ni modification de l\'implantation')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'entrainement_atelier.png'))
        for m in ['scie-radiale', 'mortaiseuse', 'risques']:
            if m == 'risques': await pg.evaluate("()=>document.querySelector('#postes button[data-id=risques]').click()")
            else: await pg.evaluate(f"()=>__atelier.select(__atelier.STATIONS.find(s=>s.id==='{m}'))")
            href = await pg.evaluate("()=>{ const a=document.querySelector('#card a.go'); return a && [a.getAttribute('href'), a.target]; }")
            check(href and href[0] == f'{m}/index.html' and not href[1], f'{m} : lien « Ouvrir » vers {href and href[0]}, même onglet')
            await pg.click('#card a.go'); await pg.wait_for_function('window.__ready', timeout=120000); await pg.wait_for_timeout(500)
            mm = await pg.evaluate("()=>({ back:!document.getElementById('toAtelier').hidden, choice:!document.getElementById('choice')?.hidden, parc:document.getElementById('app').dataset.ui==='parcours', modes:!!document.querySelector('[data-mode]') })")
            check(mm['back'] and not mm['choice'] and not mm['parc'] and mm['modes'], f'{m} : module d\'entraînement (exercices, pas d\'évaluation), bouton « ← Atelier »')
            if m == 'mortaiseuse': await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'entrainement_mortaiseuse.png'))
            await pg.click('#toAtelier'); await pg.wait_for_function('window.__ready && window.__atelier?.STATIONS', timeout=120000)
            check(pg.url.endswith('/index.html') and '/' + m + '/' not in pg.url, f'{m} : « ← Atelier » ramène à l\'atelier')
        check(not errs, f'aucune erreur JavaScript ({errs[:2]})')
        await br.close()

if __name__ == '__main__':
    from harness import run
    run(main)
