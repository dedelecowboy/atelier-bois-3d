# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Assemble les élèves Meshy et les EPI en un seul fichier compact pour le module des risques généraux.

  python3 tools/personnage/meshy/pack_eleves.py machines/risques/eleves.glbz \
      equipe=equipe_final.glb mal=mal_final.glb \
      casque=epi_casque.glb lunettes=epi_lunettes.glb ffp2=epi_ffp2.glb demimasque=epi_demimasque.glb

Les élèves sont les GLB finis par subdiv_rig.py puis recuire_texture.py (squelette Mixamo de Meshy, 24 os) ;
les EPI ceux de epi_prep.py. Le PREMIER élève donne le squelette commun : les autres sont liés à ses os
(mêmes noms, positions de repos à 2 cm près) avec ses matrices de liaison.

Chaque élève est découpé en quatre pièces d'après l'os qui commande chaque triangle :
  tete (Head : visage et cheveux), corps (le reste : tenue), pieds (Foot / ToeBase : chaussures),
  mains (Hand : nues ou gantées). On peut ainsi changer de tenue, de chaussures ou mettre des gants
  sans changer le visage de l'élève.

Format (lu par machines/risques/figures.js, sans chargeur asynchrone) : zlib( longueur JSON sur 4 octets,
JSON, données ). Positions en entiers 16 bits (échelle et décalage dans le JSON), normales 8 bits,
coordonnées de texture 16 bits, os et poids 8 bits, indices 16 bits, textures JPEG.
"""
import io, json, os, struct, sys, zlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import load, acc

TEX_ELEVE = 1024   # px : les élèves sont vus de loin dans la salle
TEX_EPI = 512
CHEVEUX_LONGS = ('fille_mal',)
Q = 86             # qualité JPEG

out_path = sys.argv[1]
args = dict(a.split('=', 1) for a in sys.argv[2:])
eleves = [k for k in args if k in ('equipe', 'mal', 'fille', 'fille_mal')]
epis = [k for k in args if k not in eleves]

BIN = bytearray()
def put(arr):
    arr = np.ascontiguousarray(arr)
    while len(BIN) % 4: BIN.append(0)
    o = len(BIN); BIN.extend(arr.tobytes()); return [o, arr.nbytes]
def jpeg(img, size):
    im = img.convert('RGB')
    if size: im = im.resize((size, size), Image.LANCZOS)
    o = io.BytesIO(); im.save(o, 'JPEG', quality=Q, optimize=True); return put(np.frombuffer(o.getvalue(), np.uint8))
def image_of(g, b, tex_index):
    iv = g['images'][g['textures'][tex_index]['source']]; bv = g['bufferViews'][iv['bufferView']]; o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[o:o + bv['byteLength']]))
def geom(P, N, UV, F, J=None, W=None):
    lo = P.min(0); hi = P.max(0); sc = (hi - lo) / 65535
    G = {'n': int(len(P)), 'pmin': lo.tolist(), 'pscale': sc.tolist(),
         'pos': put(np.round((P - lo) / sc).astype(np.uint16)),
         'nor': put(np.round(np.clip(N, -1, 1) * 127).astype(np.int8)),
         'uv': put(np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)),
         'idx': put(F.reshape(-1).astype(np.uint16))}
    if J is not None:
        G['jnt'] = put(J.astype(np.uint8)); G['wgt'] = put(W.astype(np.uint8))
    return G

J = {'eleves': {}, 'epi': {}, 'squelettes': {}}
GROUPES = {'equipe': 'garcon', 'mal': 'garcon', 'fille': 'fille', 'fille_mal': 'fille'}
REF = {}            # groupe -> (noms des os, matrices monde de repos) de l'élève de référence (le premier du groupe)
for k in eleves:
    g, b = load(args[k]); pr = g['meshes'][0]['primitives'][0]; at = pr['attributes']
    P = acc(g, b, at['POSITION']).astype(np.float64); N = acc(g, b, at['NORMAL']).astype(np.float64)
    UV = acc(g, b, at['TEXCOORD_0']).astype(np.float64); F = acc(g, b, pr['indices']).reshape(-1, 3).astype(np.int64)
    Jn = acc(g, b, at['JOINTS_0']).astype(np.int64); Wt = acc(g, b, at['WEIGHTS_0'])
    Wt = (Wt.astype(np.float64) / (255 if Wt.dtype == np.uint8 else 1))
    sk = g['skins'][0]; names = [g['nodes'][j]['name'].replace('mixamorig:', '') for j in sk['joints']]
    grp = GROUPES[k]
    ibm_k = acc(g, b, sk['inverseBindMatrices']).reshape(-1, 4, 4).astype(np.float64)
    if grp not in REF:
        # squelette commun : nœuds de l'armature (dont l'échelle 0,01 de Mixamo) et os
        par = {}
        for i, nd in enumerate(g['nodes']):
            for c in nd.get('children', []): par[c] = i
        jset = set(sk['joints']); arm = par[sk['joints'][0]]
        while arm in jset: arm = par[arm]
        def trs(nd): return {'t': nd.get('translation', [0, 0, 0]), 'r': nd.get('rotation', [0, 0, 0, 1]), 's': nd.get('scale', [1, 1, 1])}
        bones = []
        for j in sk['joints']:
            nd = g['nodes'][j]; p = par.get(j)
            bones.append({'name': nd['name'].replace('mixamorig:', ''), 'parent': sk['joints'].index(p) if p in jset else -1, **trs(nd)})
        J['squelettes'][grp] = {'armature': trs(g['nodes'][arm]), 'os': bones,
                                'ibm': put(acc(g, b, sk['inverseBindMatrices']).astype(np.float32))}
        REF[grp] = (names, np.linalg.inv(ibm_k.transpose(0, 2, 1)))
    base, Wref = REF[grp]
    # os de cet élève -> os du squelette commun (par nom)
    remap = np.array([base.index(n) for n in names])
    # recalage sur le squelette de référence du groupe : chaque sommet suit ses os, placés aux positions de repos
    # de la référence (habillage linéaire du repos de cet élève vers le repos de la référence)
    Bk = ibm_k.transpose(0, 2, 1)                                   # matrices de liaison (colonnes)
    M = np.einsum('nij,njk->nik', Wref[remap], Bk)                  # os i de cet élève -> os de même nom de la référence
    Ph = np.c_[P, np.ones(len(P))]
    P = np.einsum('vk,vkij,vj->vi', Wt, M[Jn], Ph)[:, :3]
    N = np.einsum('vk,vkij,vj->vi', Wt, M[Jn][:, :, :3, :3], N); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
    Jn = remap[Jn]
    dom = np.take_along_axis(Jn, np.argmax(Wt, 1)[:, None], 1)[:, 0]
    bn = np.array(base)
    isfoot = np.isin(bn[dom], ['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase'])
    ishand = np.isin(bn[dom], ['LeftHand', 'RightHand'])
    w8 = np.round(Wt * 255).astype(np.int64); w8[:, 0] += 255 - w8.sum(1)
    parts = {}
    ishead = np.isin(bn[dom], ['Head', 'HeadTop_End', 'headfront'])
    for name, sel in (('pieds', isfoot[F].all(1)), ('mains', ishand[F].all(1)), ('tete', ishead[F].all(1))):
        parts[name] = sel
    parts['corps'] = ~(parts['pieds'] | parts['mains'] | parts['tete'])
    if k in CHEVEUX_LONGS:
        # cheveux longs : les mèches dans le dos sont liées au dos par Meshy ; on les reconnaît à leur couleur
        # (châtain : teinte 0,02 à 0,11, saturée, ni claire ni noire) au-dessus de la taille, pour qu'elles
        # restent avec la tête quand l'élève change de tenue
        pbr0 = g['materials'][0]['pbrMetallicRoughness']
        T = np.asarray(image_of(g, b, pbr0['baseColorTexture']['index']).convert('RGB'), np.float64) / 255; R = T.shape[0]
        uvc = UV[F].mean(1); c = T[np.clip((uvc[:, 1] * R).astype(int), 0, R - 1), np.clip((uvc[:, 0] * R).astype(int), 0, R - 1)]
        mx = c.max(1); mn = c.min(1); sat = (mx - mn) / np.maximum(mx, 1e-6)
        hue = np.where(mx == c[:, 0], ((c[:, 1] - c[:, 2]) / np.maximum(mx - mn, 1e-6)) / 6 % 1, 0.5)
        mech = parts['corps'] & (hue > 0.02) & (hue < 0.11) & (sat > 0.35) & (mx > 0.15) & (mx < 0.75) & (P[F].mean(1)[:, 1] > 0.85)
        parts['tete'] = parts['tete'] | mech; parts['corps'] = parts['corps'] & ~mech
        print(f'  {k} : {int(mech.sum())} triangles de cheveux rattachés à la tête')
    E = {}
    for name, fm in parts.items():
        Fp = F[fm]; used = np.unique(Fp); m = -np.ones(len(P), np.int64); m[used] = np.arange(len(used))
        E[name] = geom(P[used], N[used], UV[used], m[Fp], Jn[used], w8[used])
    # boîte de la tête au repos (pour poser les EPI) et repères
    hp = P[ishead]
    if grp == 'fille':   # queue de cheval : boîte du visage seulement (moitié avant de la tête, au-dessus du menton)
        hp = hp[hp[:, 2] > np.median(hp[:, 2])]
    # repères du visage (pour poser les EPI) : peau = texture claire et rosée, blanc des yeux = texture presque blanche
    pbr1 = g['materials'][0]['pbrMetallicRoughness']
    T1 = np.asarray(image_of(g, b, pbr1['baseColorTexture']['index']).convert('RGB'), np.float64) / 255; R1 = T1.shape[0]
    cv = T1[np.clip((UV[:, 1] * R1).astype(int), 0, R1 - 1), np.clip((UV[:, 0] * R1).astype(int), 0, R1 - 1)]
    mxv = cv.max(1); mnv = cv.min(1); satv = (mxv - mnv) / np.maximum(mxv, 1e-6)
    hv = np.isin(bn[np.take_along_axis(Jn, np.argmax(Wt, 1)[:, None], 1)[:, 0]], ['Head', 'HeadTop_End', 'headfront'])
    sk_ = hv & (cv[:, 0] > 0.7) & (cv[:, 0] > cv[:, 2] + 0.08) & (satv < 0.45) & (mxv > 0.72); Sk = P[sk_]
    ear = Sk[np.abs(Sk[:, 0]) > np.percentile(np.abs(Sk[:, 0]), 97)]
    nose = Sk[Sk[:, 2] > np.percentile(Sk[:, 2], 99.5)]
    eye = P[hv & (mnv > 0.8) & (P[:, 2] > np.percentile(Sk[:, 2], 60))]
    E['reperes'] = {k: round(float(v), 4) for k, v in dict(haut=P[hv, 1].max(), oreille_x=np.abs(ear[:, 0]).mean(), oreille_y=ear[:, 1].mean(),
        oreille_z=ear[:, 2].mean(), oreille_bas=ear[:, 1].min(), oreille_haut=ear[:, 1].max(), nez_y=nose[:, 1].mean(), nez_z=nose[:, 2].max(),
        oeil_y=eye[:, 1].mean(), oeil_z=eye[:, 2].max(), menton=Sk[:, 1].min()).items()}
    print('  repères', E['reperes'])
    E['boite_tete'] = {'min': hp.min(0).tolist(), 'max': hp.max(0).tolist()}
    E['hauteur'] = float(P[:, 1].max()); E['groupe'] = grp
    pbr = g['materials'][0]['pbrMetallicRoughness']
    E['tex'] = jpeg(image_of(g, b, pbr['baseColorTexture']['index']), TEX_ELEVE)
    J['eleves'][k] = E
    print(f'{k} : ' + ', '.join(f"{n} {int(fm.sum())} faces" for n, fm in parts.items()))
for k in epis:
    g, b = load(args[k]); pr = g['meshes'][0]['primitives'][0]; at = pr['attributes']
    P = acc(g, b, at['POSITION']).astype(np.float64); N = acc(g, b, at['NORMAL']).astype(np.float64)
    UV = acc(g, b, at['TEXCOORD_0']).astype(np.float64); F = acc(g, b, pr['indices']).reshape(-1, 3)
    E = geom(P, N, UV, F); E['tex'] = jpeg(image_of(g, b, g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']), TEX_EPI)
    J['epi'][k] = E
js = json.dumps(J, separators=(',', ':')).encode()
raw = struct.pack('<I', len(js)) + js + bytes(BIN)
z = zlib.compress(raw, 9)
open(out_path, 'wb').write(z)
print(f'{out_path} : {len(z)//1024} Ko (brut {len(raw)//1024} Ko)')
