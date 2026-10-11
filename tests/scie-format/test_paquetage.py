"""Scie à format : le paquetage SCORM tel que Moodle le reçoit (zip de dist/), servi fichier par fichier,
sans aucun accès au CDN : manifeste, three.js local, parcours actif, dialogue avec l'API SCORM."""
import asyncio, mimetypes, os, re, sys, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import ROOT, CHROMIUM, scorm_mock, check, run
from playwright.async_api import async_playwright

ZIP = os.path.join(ROOT, 'dist', 'KANAK550_scie_format_SCORM12.zip')

async def main():
    z = zipfile.ZipFile(ZIP); names = set(z.namelist())
    man = z.read('imsmanifest.xml').decode()
    listed = set(re.findall(r'<file href="([^"]+)"', man))
    check('index.html' in names and 'imsmanifest.xml' in names, 'zip : index.html et imsmanifest.xml à la racine')
    check(listed == names - {'imsmanifest.xml'}, f'manifeste : {len(listed)} fichiers déclarés = contenu du zip')
    check('<schemaversion>1.2</schemaversion>' in man and 'masteryscore' not in man, 'manifeste SCORM 1.2 sans masteryscore')
    index = z.read('index.html').decode()
    check('cdn.jsdelivr' not in index and 'window.PARCOURS=true' in index, 'index.html : three.js local, parcours actif')
    mock = re.search(r'<script>(.*)</script>', scorm_mock(), re.S).group(1).replace('window.PARCOURS=true;', '')
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 800}); errors, outside = [], []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        async def route(r):
            u = r.request.url
            if u.startswith('http://moodle.local/scorm/'):
                f = u.split('/scorm/')[1].split('?')[0]
                if f in names:   # Moodle sert les .js en application/x-javascript (accepté pour les modules ES)
                    ct = 'application/x-javascript' if f.endswith('.js') else (mimetypes.guess_type(f)[0] or 'application/octet-stream')
                    return await r.fulfill(body=z.read(f), content_type=ct, headers={'X-Content-Type-Options': 'nosniff'})
                return await r.fulfill(status=404, body='')
            if 'fonts.g' not in u: outside.append(u)
            await r.abort()
        await pg.route('**/*', route); await pg.add_init_script(mock)
        await pg.goto('http://moodle.local/scorm/index.html')
        await pg.wait_for_function('window.__ready', timeout=30000); await pg.wait_for_timeout(800)
        ui = await pg.evaluate("document.getElementById('app').dataset.ui")
        status = await pg.evaluate("__store['cmi.core.lesson_status']")
        await b.close()
    check(not errors, 'aucune erreur JavaScript' + ('' if not errors else ' : ' + '; '.join(errors)))
    check(not outside, 'aucune requête hors du paquetage' + ('' if not outside else ' : ' + ', '.join(outside)))
    check(ui == 'parcours' and status == 'incomplete', 'parcours démarré, statut « incomplete » envoyé à Moodle')

if __name__ == '__main__': run(main)
