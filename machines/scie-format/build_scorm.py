# Fabrique le paquetage SCORM 1.2 de la scie à format.
# Prérequis : `npm install three@0.160.0` à la racine du dépôt (node_modules/three).
# Usage : python3 machines/scie-format/build_scorm.py  -> KANAK550_scie_format_SCORM12.zip
import os, shutil, subprocess
H=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(H,'..','..')); os.chdir(H)
T=os.path.join(ROOT,'node_modules','three')
os.makedirs('scorm/lib/addons/controls',exist_ok=True); os.makedirs('scorm/lib/addons/geometries',exist_ok=True); os.makedirs('scorm/lib/addons/environments',exist_ok=True)
shutil.copy(os.path.join(T,'build','three.module.js'),'scorm/lib/')
for a in ['controls/OrbitControls.js','geometries/RoundedBoxGeometry.js','environments/RoomEnvironment.js']: shutil.copy(os.path.join(T,'examples','jsm',a),'scorm/lib/addons/'+a)
shutil.copy(os.path.join(T,'LICENSE'),'scorm/lib/LICENSE-three.txt'); shutil.copy('imsmanifest.xml','scorm/imsmanifest.xml')
s=open('scie-format.html',encoding='utf-8').read()
s=s.replace('"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"','"three":"./lib/three.module.js","three/addons/":"./lib/addons/"')
assert 'cdn.jsdelivr' not in s
s=s.replace('<title>Scie à format 3D</title>','<title>KANAK 550 · Scie à format · Parcours évalué</title>',1)
doc='<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<script>window.PARCOURS=true;</script>\n'
i=s.index('</style>')+len('</style>')
open('scorm/index.html','w').write(doc+s[:i]+'\n</head>\n<body>\n'+s[i:]+'\n</body>\n</html>\n')
subprocess.run('cd scorm && rm -f ../KANAK550_scie_format_SCORM12.zip && zip -qr -X ../KANAK550_scie_format_SCORM12.zip imsmanifest.xml index.html lib',shell=True,check=True)
print('built')
