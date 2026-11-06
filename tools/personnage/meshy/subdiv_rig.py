# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
#!/usr/bin/env python3
"""Arrondit un personnage riggé Meshy (10 000 faces) par subdivision de Loop, sans perdre le squelette.

Chaque triangle est découpé en quatre ; les positions suivent la règle de Loop (surface lissée),
calculée sur le maillage « soudé » (sommets de même position fusionnés) pour ne pas ouvrir les
coutures de texture ; les coordonnées de texture et les poids des os sont interpolés linéairement.
Les normales sont recalculées lissées. Les textures sont réduites et compressées en JPEG.

  python3 subdiv_rig.py --rig perso_rig.glb --out perso.glb [--niveaux 1] [--tex 2048] [--texmr 1024]
"""
import argparse, io, json, os, struct, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import load, acc

ap = argparse.ArgumentParser()
ap.add_argument('--rig', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--niveaux', type=int, default=1); ap.add_argument('--tex', type=int, default=2048)
ap.add_argument('--texmr', type=int, default=1024); ap.add_argument('--q', type=int, default=88)
ap.add_argument('--sansmr', action='store_true', help='ne pas garder la texture rugosité/métal')
A = ap.parse_args()

g, b = load(A.rig)
prim = g['meshes'][0]['primitives'][0]; at = prim['attributes']
P = acc(g, b, at['POSITION']).astype(np.float64)
UV = acc(g, b, at['TEXCOORD_0']).astype(np.float64)
J = acc(g, b, at['JOINTS_0']).astype(np.int64); Wt = acc(g, b, at['WEIGHTS_0']).astype(np.float64)
F = acc(g, b, prim['indices']).reshape(-1, 3).astype(np.int64)
nj = len(g['skins'][0]['joints'])
W = np.zeros((len(P), nj)); np.add.at(W, (np.repeat(np.arange(len(P)), 4), J.ravel()), Wt.ravel())


def loop(P, UV, W, F):
    nv = len(P)
    # soudure : un identifiant par position
    _, weld = np.unique(np.round(P, 6), axis=0, return_inverse=True); weld = weld.ravel()
    Fw = weld[F]; nw = weld.max() + 1
    Pw = np.zeros((nw, 3)); Pw[weld] = P
    # arêtes soudées : faces voisines et sommets opposés
    e = np.concatenate([Fw[:, [0, 1]], Fw[:, [1, 2]], Fw[:, [2, 0]]]); opp = np.concatenate([Fw[:, 2], Fw[:, 0], Fw[:, 1]])
    es = np.sort(e, 1); key = es[:, 0] * nw + es[:, 1]
    uk, einv, ecount = np.unique(key, return_inverse=True, return_counts=True)
    E = np.stack([uk // nw, uk % nw], 1)
    oppsum = np.zeros((len(uk), 3)); np.add.at(oppsum, einv, Pw[opp])
    inner = ecount == 2
    Emid = np.where(inner[:, None], 3 / 8 * (Pw[E[:, 0]] + Pw[E[:, 1]]) + 1 / 8 * oppsum, 0.5 * (Pw[E[:, 0]] + Pw[E[:, 1]]))
    # sommets : règle de Loop (bords : règle de bord)
    bnd = ~inner
    nb_sum = np.zeros((nw, 3)); nb_cnt = np.zeros(nw)
    for a, c in ((0, 1), (1, 0)):
        np.add.at(nb_sum, E[:, a], Pw[E[:, c]]); np.add.at(nb_cnt, E[:, a], 1)
    bsum = np.zeros((nw, 3)); bcnt = np.zeros(nw)
    for a, c in ((0, 1), (1, 0)):
        np.add.at(bsum, E[bnd, a], Pw[E[bnd, c]]); np.add.at(bcnt, E[bnd, a], 1)
    n = np.maximum(nb_cnt, 1)
    beta = np.where(n == 3, 3 / 16, 3 / (8 * n))
    Pv = (1 - n * beta)[:, None] * Pw + beta[:, None] * nb_sum
    isb = bcnt > 0
    Pv[isb] = 0.75 * Pw[isb] + 0.125 * bsum[isb] / np.maximum(bcnt[isb], 1)[:, None] * 2 / 2 * (bcnt[isb][:, None] / 2) if False else Pv[isb]
    Pv[isb] = np.where((bcnt[isb] == 2)[:, None], 0.75 * Pw[isb] + 0.125 * bsum[isb], Pw[isb])
    # sommets non soudés (coutures de texture) : nouvelles arêtes par paire de sommets non soudés
    eu = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); eus = np.sort(eu, 1)
    ukey = eus[:, 0] * nv + eus[:, 1]
    uu, uinv = np.unique(ukey, return_inverse=True)
    Eu = np.stack([uu // nv, uu % nv], 1)
    # arête soudée correspondante pour chaque arête non soudée
    wk = np.sort(weld[Eu], 1); wkey = wk[:, 0] * nw + wk[:, 1]
    widx = np.searchsorted(uk, wkey)
    newP = np.concatenate([Pv[weld], Emid[widx]])
    newUV = np.concatenate([UV, 0.5 * (UV[Eu[:, 0]] + UV[Eu[:, 1]])])
    newW = np.concatenate([W, 0.5 * (W[Eu[:, 0]] + W[Eu[:, 1]])])
    # triangle d'origine de chaque nouveau sommet (pour recaler la texture ensuite)
    parent = np.zeros(nv + len(Eu), np.int64); nf = len(F)
    parent[F.ravel()] = np.repeat(np.arange(nf), 3)
    parent[nv + uinv] = np.tile(np.arange(nf), 3)
    m = nv + uinv.reshape(3, -1).T  # milieux des arêtes (0-1, 1-2, 2-0) de chaque face
    a, b_, c = F[:, 0], F[:, 1], F[:, 2]; m01, m12, m20 = m[:, 0], m[:, 1], m[:, 2]
    newF = np.concatenate([np.stack([a, m01, m20], 1), np.stack([b_, m12, m01], 1), np.stack([c, m20, m12], 1), np.stack([m01, m12, m20], 1)])
    # texture recalée : le nouveau point est projeté sur son triangle d'origine (sur lequel Meshy a cuit
    # la texture) et reçoit les coordonnées de texture de ce point ; sinon la texture « glisse »
    T = P[F[parent]]; e1 = T[:, 1] - T[:, 0]; e2 = T[:, 2] - T[:, 0]; q = newP - T[:, 0]
    d11 = (e1 * e1).sum(1); d12 = (e1 * e2).sum(1); d22 = (e2 * e2).sum(1); q1 = (q * e1).sum(1); q2 = (q * e2).sum(1)
    den = d11 * d22 - d12 * d12; ok = np.abs(den) > 1e-14
    v = np.where(ok, (d22 * q1 - d12 * q2) / np.where(ok, den, 1), 0); w = np.where(ok, (d11 * q2 - d12 * q1) / np.where(ok, den, 1), 0)
    v = np.clip(v, 0, 1); w = np.clip(w, 0, 1); sw = v + w; over = sw > 1; v = np.where(over, v / sw, v); w = np.where(over, w / sw, w)
    U3 = UV[F[parent]]; proj = U3[:, 0] + v[:, None] * (U3[:, 1] - U3[:, 0]) + w[:, None] * (U3[:, 2] - U3[:, 0])
    newUV = np.where(ok[:, None], proj, newUV)
    return newP, newUV, newW, newF


for _ in range(A.niveaux):
    P, UV, W, F = loop(P, UV, W, F)
print(f'subdivisé : {len(F)} faces, {len(P)} sommets')

# normales lissées (à travers les coutures)
_, weld = np.unique(np.round(P, 6), axis=0, return_inverse=True); weld = weld.ravel()
fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
accn = np.zeros((weld.max() + 1, 3))
for k in range(3): np.add.at(accn, weld[F[:, k]], fn)
N = accn[weld]; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12

# 4 os les plus influents par sommet
idx = np.argsort(-W, 1)[:, :4]; w4 = np.take_along_axis(W, idx, 1); w4 /= w4.sum(1, keepdims=True)

# textures
mat = g['materials'][0]; pbr = mat['pbrMetallicRoughness']
def img(t):
    iv = g['images'][g['textures'][t['index']]['source']]; bv = g['bufferViews'][iv['bufferView']]; o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[o:o + bv['byteLength']]))
jpg = {}
for name, key, size in (('base', 'baseColorTexture', A.tex), ('mr', 'metallicRoughnessTexture', A.texmr)):
    if key not in pbr or (name == 'mr' and A.sansmr): continue
    im = img(pbr[key]).convert('RGB').resize((size, size), Image.LANCZOS)
    o = io.BytesIO(); im.save(o, 'JPEG', quality=A.q, optimize=True); jpg[name] = o.getvalue()
    print(f'texture {name} : {size}px, {len(jpg[name]) // 1024} Ko')

# écriture
out = {'asset': {'version': '2.0', 'generator': 'atelier-bois-3d subdiv_rig.py'}, 'scene': 0, 'scenes': g['scenes'],
       'nodes': g['nodes'], 'buffers': [], 'bufferViews': [], 'accessors': [], 'samplers': [{}], 'images': [], 'textures': []}
BIN = bytearray()
def view(data, target=None):
    while len(BIN) % 4: BIN.append(0)
    v = {'buffer': 0, 'byteOffset': len(BIN), 'byteLength': len(data)}
    if target: v['target'] = target
    BIN.extend(data); out['bufferViews'].append(v); return len(out['bufferViews']) - 1
def add(arr, ct, typ, target=None, mm=False, norm=False):
    arr = np.ascontiguousarray(arr); a = {'bufferView': view(arr.tobytes(), target), 'componentType': ct, 'count': int(len(arr)), 'type': typ}
    if norm: a['normalized'] = True
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    out['accessors'].append(a); return len(out['accessors']) - 1
memo = {}
def copy(i):
    if i not in memo:
        a = dict(g['accessors'][i]); d = acc(g, b, i); a['bufferView'] = view(d.tobytes()); a.pop('byteOffset', None)
        out['accessors'].append(a); memo[i] = len(out['accessors']) - 1
    return memo[i]
out['skins'] = [dict(s, inverseBindMatrices=copy(s['inverseBindMatrices'])) for s in g['skins']]
out['animations'] = [dict(an, samplers=[dict(sp, input=copy(sp['input']), output=copy(sp['output'])) for sp in an['samplers']]) for an in g.get('animations', [])]
w8 = np.round(w4 * 255).astype(np.int64); w8[:, 0] += 255 - w8.sum(1)
big = len(P) >= 65536
attrs = {'POSITION': add(P.astype(np.float32), 5126, 'VEC3', 34962, True), 'NORMAL': add(N.astype(np.float32), 5126, 'VEC3', 34962),
         'TEXCOORD_0': add(UV.astype(np.float32), 5126, 'VEC2', 34962), 'JOINTS_0': add(idx.astype(np.uint8), 5121, 'VEC4', 34962),
         'WEIGHTS_0': add(w8.astype(np.uint8), 5121, 'VEC4', 34962, norm=True)}
ind = add(F.reshape(-1).astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963)
ti = {}
for name, data in jpg.items():
    out['images'].append({'bufferView': view(data), 'mimeType': 'image/jpeg', 'name': name})
    out['textures'].append({'source': len(out['images']) - 1, 'sampler': 0}); ti[name] = len(out['textures']) - 1
M = {'name': 'Personnage', 'pbrMetallicRoughness': {'baseColorTexture': {'index': ti['base']}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}}
if 'mr' in ti: M['pbrMetallicRoughness'].update(metallicRoughnessTexture={'index': ti['mr']}, metallicFactor=1.0)
out['materials'] = [M]
out['meshes'] = [{'name': 'Personnage', 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}]
while len(BIN) % 4: BIN.append(0)
out['buffers'] = [{'byteLength': len(BIN)}]
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(A.out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(BIN)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(BIN), 0x004E4942)); f.write(BIN)
print(f'{A.out} : {os.path.getsize(A.out) // 1024} Ko')
