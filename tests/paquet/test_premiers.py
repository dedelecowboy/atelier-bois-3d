# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Premiers pas (engine/premiers.js, demandé par l'enseignant le 07/11/2026) : cartes de présentation à l'entrée de l'atelier
et de chaque module (comment marche la page, comment obtenir le permis machine).
- dossier d'entraînement (file://) : ouvertes seules à la première visite de l'atelier et d'une machine, plus ensuite,
  rouvertes par « ? », textes « Entraîné » ; Échap, « Passer », « C'est parti » ; en-tête laissé visible ;
- paquetage séparé (PARCOURS) et paquetage unique (ATELIER_PKG avec verrous) : textes de l'évaluation et du verrou ;
- les 10 modules : cartes construites (badge, niveau, nombres) ; téléphone 412 px ; « 🔈 Lire » lit la carte ;
- sous un test automatique sans PREMIERS_TEST : rien ne s'ouvre (les autres tests ne les voient pas).
Captures : tests/out/premiers_*.png"""
import asyncio, os, sys, tempfile, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import check, CHROMIUM, Page
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tests', 'out')
ZIP = os.path.join(ROOT, 'dist', 'Atelier_bois_3D_entrainement.zip')
MODULES = ['risques', 'scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'mortaiseuse', 'tenonneuse', 'scie-format', 'scie-ruban']
TEST = 'window.PREMIERS_TEST=true;'
ETAT = """()=>{ const f=document.getElementById('ppFond'); const s=f&&f.querySelector('.pp-slide:not([hidden])');
  return { open:!!f&&!f.hidden, n:f? f.querySelectorAll('.pp-slide').length : 0, t:s? s.querySelector('.pp-t').textContent : '', txt:f? f.innerText : '',
    btn:!!document.getElementById('ppBtn'), top:f? f.getBoundingClientRect().top : -1 }; }"""

async def main():
    os.makedirs(OUT, exist_ok=True)
    d = tempfile.mkdtemp(prefix='premiers_')
    with zipfile.ZipFile(ZIP) as z: z.extractall(d)
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        # --- sans PREMIERS_TEST : rien ne s'ouvre sous un test automatique ---
        pg = await br.new_page(viewport={'width': 1400, 'height': 820})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.g*/**', lambda r: r.abort())
        await pg.goto('file://' + os.path.join(d, 'index.html')); await pg.wait_for_function('window.__ready', timeout=120000)
        e = await pg.evaluate(ETAT)
        check(e['btn'] and not e['open'], 'test automatique : bouton « ? » présent, cartes pas ouvertes seules')
        await pg.close()

        # --- dossier d'entraînement : première visite ---
        ctx = await br.new_context(viewport={'width': 1400, 'height': 820})
        await ctx.add_init_script(TEST)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.g*/**', lambda r: r.abort())
        await pg.goto('file://' + os.path.join(d, 'index.html')); await pg.wait_for_function('window.__ready', timeout=120000); await pg.wait_for_timeout(400)
        e = await pg.evaluate(ETAT)
        hdr = await pg.evaluate("()=>document.querySelector('.at-top').getBoundingClientRect().bottom")
        check(e['open'] and e['n'] == 4 and e['t'] == "Bienvenue dans l'atelier", f'atelier : premiers pas ouverts seuls, 4 cartes ({e["t"]})')
        check(abs(e['top'] - hdr) < 2, f'atelier : en-tête laissé visible au-dessus ({e["top"]:.0f} / {hdr:.0f} px)')
        await pg.screenshot(path=os.path.join(OUT, 'premiers_atelier_1.png'))
        await pg.click('#ppFond [data-pp=next]'); await pg.click('#ppFond [data-pp=next]')
        e = await pg.evaluate(ETAT)
        check(e['t'] == 'Le permis machine' and 'Entraîné' in e['txt'] and 'Moodle' in e['txt'], 'atelier, carte 3 : permis dans Moodle, badge « Entraîné » ici')
        await pg.screenshot(path=os.path.join(OUT, 'premiers_atelier_3.png'))
        lu = await pg.evaluate("()=>__atelier.lecture.consigne()?.t||''")
        check('Moodle' in lu, '« 🔈 Lire » lit la carte affichée')
        await pg.keyboard.press('ArrowRight'); e = await pg.evaluate(ETAT)
        check(e['t'] == 'Pour bien lire', 'flèche → : carte suivante')
        last = await pg.evaluate("()=>document.querySelector('#ppFond [data-pp=next]').textContent")
        check(last == "C'est parti", f'dernière carte : bouton « {last} »')
        await pg.click('#ppFond [data-pp=next]'); e = await pg.evaluate(ETAT)
        check(not e['open'], '« C\'est parti » ferme')
        await pg.reload(); await pg.wait_for_function('window.__ready', timeout=120000); await pg.wait_for_timeout(300)
        e = await pg.evaluate(ETAT); check(not e['open'], 'atelier rechargé : plus ouverts seuls')
        await pg.click('#ppBtn'); e = await pg.evaluate(ETAT); check(e['open'] and e['t'] == "Bienvenue dans l'atelier", '« ? » les rouvre à la première carte')
        await pg.keyboard.press('Escape'); e = await pg.evaluate(ETAT); check(not e['open'], 'Échap ferme')

        # machine du dossier : ouverte seule à sa première visite
        await pg.goto('file://' + os.path.join(d, 'scie-radiale', 'index.html')); await pg.wait_for_function('window.__ready', timeout=120000); await pg.wait_for_timeout(400)
        e = await pg.evaluate(ETAT)
        hdr = await pg.evaluate("()=>document.querySelector('.top').getBoundingClientRect().bottom")
        check(e['open'] and e['n'] == 3 and e['t'].startswith('Scie radiale · KANAK 900 R') and 'tronçonnage' in e['txt'], f'scie radiale : 3 cartes, à quoi sert la machine ({e["t"]})')
        check(abs(e['top'] - hdr) < 2, 'scie radiale : en-tête visible')
        check('Permis niveau 1' in e['txt'], 'scie radiale : niveau du permis')
        await pg.screenshot(path=os.path.join(OUT, 'premiers_machine_1.png'))
        await pg.click('#ppFond .pp-dots [data-go="2"]'); e = await pg.evaluate(ETAT)
        check('Entraîné' in e['txt'] and '3 exercices guidés' in e['txt'], 'scie radiale, carte 3 : badge « Entraîné », 3 exercices')
        await pg.screenshot(path=os.path.join(OUT, 'premiers_machine_3.png'))
        await pg.click('#ppFond [data-pp=x]'); e = await pg.evaluate(ETAT); check(not e['open'], '× ferme')
        await ctx.close()

        # téléphone
        ctx = await br.new_context(viewport={'width': 412, 'height': 860}, is_mobile=True, has_touch=True)
        await ctx.add_init_script(TEST)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.g*/**', lambda r: r.abort())
        for url, nom in [(os.path.join(d, 'index.html'), 'atelier'), (os.path.join(d, 'toupie', 'index.html'), 'toupie')]:
            await pg.goto('file://' + url); await pg.wait_for_function('window.__ready', timeout=120000); await pg.wait_for_timeout(400)
            if nom == 'toupie': await pg.click('#ppFond .pp-dots [data-go="2"]')
            box = await pg.evaluate("()=>{ const b=document.querySelector('#ppFond .pp-box').getBoundingClientRect(); return { l:b.left, r:b.right, b:b.bottom, w:innerWidth, h:innerHeight, sw:document.documentElement.scrollWidth }; }")
            check(box['l'] >= 0 and box['r'] <= box['w'] and box['b'] <= box['h'] + 1 and box['sw'] <= box['w'], f'téléphone, {nom} : carte dans l\'écran ({box})')
            await pg.screenshot(path=os.path.join(OUT, f'premiers_tel_{nom}.png'))
        await ctx.close()
        check(not errs, f'dossier d\'entraînement : aucune erreur JavaScript ({errs[:2]})')
        await br.close()

    # --- paquetage séparé (évaluation seule) ---
    async with Page('mortaiseuse', scorm=True, init=TEST) as pg:
        await pg.page.click('#ppFond .pp-dots [data-go="1"]'); e = await pg.eval(ETAT)
        check(e['open'] and "c'est l'évaluation" in e['txt'] and '15 organes' in e['txt'] and '20 questions' in e['txt'], 'paquetage séparé : carte « Comment ça marche » de l\'évaluation (15 organes, 20 questions)')
        await pg.page.click('#ppFond .pp-dots [data-go="2"]'); e = await pg.eval(ETAT)
        check('Ordre conseillé' in e['txt'] and 'Raboteuse' in e['txt'] and 'Repasser' in e['txt'], 'paquetage séparé : badge, ordre conseillé après la raboteuse, nouvelle tentative')
        check(not pg.errors, f'paquetage séparé : aucune erreur ({pg.errors[:2]})')

    # --- paquetage unique avec verrous (ATELIER_PKG simulé) ---
    PKGJS = TEST + "window.ATELIER_PKG={ atelier:'Atelier', titles:{ raboteuse:'4. Raboteuse', tenonneuse:'7. Tenonneuse' }, prereq:{ tenonneuse:'raboteuse' } };"
    async with Page('tenonneuse', scorm=True, init=PKGJS) as pg:
        e = await pg.eval(ETAT)
        choice = await pg.eval("()=>!document.getElementById('choice').hidden")
        check(e['open'] and choice, 'paquetage unique : premiers pas au-dessus de la carte S\'entraîner / évaluation')
        await pg.page.click('#ppFond .pp-dots [data-go="1"]'); e = await pg.eval(ETAT)
        check('Évaluation' in e['txt'] and 'pupitre' in e['txt'], 'paquetage unique : carte « Comment ça marche » (présentation, exercice, évaluation)')
        await pg.page.click('#ppFond .pp-dots [data-go="2"]'); e = await pg.eval(ETAT)
        check('s\'ouvre quand' in e['txt'] and 'Raboteuse' in e['txt'] and 'Permis niveau 2'.lower() in e['txt'].lower(), 'paquetage unique : verrou nommé (raboteuse), niveau 2')
        await pg.shot('premiers_paquet_tenonneuse.png')
        await pg.page.keyboard.press('Escape')
        choice = await pg.eval("()=>!document.getElementById('choice').hidden && document.getElementById('ppFond').hidden")
        check(choice, 'fermé : la carte S\'entraîner / évaluation reste')

    # --- les 10 modules (page web) : cartes construites ---
    for m in MODULES:
        async with Page(m, init=TEST) as pg:
            e = await pg.eval(ETAT)
            svg = await pg.eval("()=>!!document.querySelector('#ppFond .pp-slide[data-i=\"0\"] svg')")
            check(e['open'] and e['n'] == 3 and svg and not pg.errors and 'undefined' not in e['txt'] and 'NaN' not in e['txt'],
                  f'{m} : 3 cartes, badge dessiné, aucun « undefined » ({e["t"]})')
            await pg.page.click('#ppFond .pp-dots [data-go="1"]'); e2 = await pg.eval(ETAT)
            await pg.page.click('#ppFond .pp-dots [data-go="2"]'); e3 = await pg.eval(ETAT)
            check('undefined' not in e2['txt'] + e3['txt'] and 'NaN' not in e2['txt'] + e3['txt'], f'{m} : cartes 2 et 3 sans « undefined »')
            if m == 'risques':
                check('vestiaire' in e3['txt'] and '4 exercices guidés' in e2['txt'] + e3['txt'], 'risques généraux : vestiaire et 4 exercices guidés cités')
                await pg.page.click('#ppFond .pp-dots [data-go="1"]'); await pg.shot('premiers_risques_2.png')

if __name__ == '__main__':
    from harness import run
    run(main)
