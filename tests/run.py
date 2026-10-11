"""Lance toutes les vérifications d'une machine (ou de toutes) : « npm test » ou « python3 tests/run.py scie-format ».
Prérequis : npm install, puis npm run build (les tests portent sur dist/).
1. node --check du script module extrait de la page fabriquée ;
2. chaque tests/<machine>/test_*.py (exercices, parcours SCORM, affichage ordinateur et téléphone).
Les tests sont lents en headless (rendu logiciel swiftshader) : compter une dizaine de minutes."""
import glob, os, re, subprocess, sys, tempfile, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def node_check(machine):
    html = open(os.path.join(ROOT, 'dist', machine + '.html'), encoding='utf-8').read()
    m = re.search(r'<script type="module">\n(.*)</script>', html, re.S)
    with tempfile.NamedTemporaryFile('w', suffix='.mjs', delete=False, encoding='utf-8') as f: f.write(m.group(1)); p = f.name
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True); os.unlink(p)
    return r.returncode == 0, r.stderr.strip()

def main():
    machines = sys.argv[1:] or sorted(d for d in os.listdir(os.path.join(ROOT, 'tests')) if os.path.isdir(os.path.join(ROOT, 'tests', d)) and glob.glob(os.path.join(ROOT, 'tests', d, 'test_*.py')))
    bad = []
    for mac in machines:
        if not os.path.exists(os.path.join(ROOT, 'dist', mac + '.html')): sys.exit(f'dist/{mac}.html absent : lancez « npm run build ».')
        ok, err = node_check(mac); print(f'[{mac}] node --check : {"OK" if ok else "ÉCHEC"} {err}')
        if not ok: bad.append(f'{mac} node --check')
        for t in sorted(glob.glob(os.path.join(ROOT, 'tests', mac, 'test_*.py'))):
            t0 = time.time(); print(f'[{mac}] {os.path.basename(t)}', flush=True)
            r = subprocess.run([sys.executable, '-u', t])
            print(f'[{mac}] {os.path.basename(t)} : {"OK" if r.returncode == 0 else "ÉCHEC"} ({time.time()-t0:.0f} s)\n', flush=True)
            if r.returncode: bad.append(f'{mac} {os.path.basename(t)}')
    print('Tout est bon.' if not bad else 'Échecs : ' + ', '.join(bad))
    sys.exit(1 if bad else 0)

main()
