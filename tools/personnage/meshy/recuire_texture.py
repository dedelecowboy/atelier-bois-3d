# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
#!/usr/bin/env python3
"""Recuit la texture couleur d'un personnage riggé à partir du modèle détaillé d'origine (même personnage).

Pour chaque pixel de la texture du riggé : point 3D correspondant sur sa surface (rastérisation dans
l'espace de texture), point le plus proche sur le modèle détaillé (aligné par boîtes englobantes),
couleur lue dans la texture 4K du détaillé à cet endroit. Les bords des îlots sont ensuite étendus
de quelques pixels pour éviter les liserés aux coutures.

  python3 recuire_texture.py --perso perso.glb --hd detail.glb --out perso_recuit.glb [--res 2048]
"""
import argparse, io, json, os, struct, sys, time
import numpy as np, trimesh
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glbio import load, acc

ap = argparse.ArgumentParser()
ap.add_argument('--perso', required=True); ap.add_argument('--hd', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--res', type=int, default=2048); ap.add_argument('--q', type=int, default=88)
A = ap.parse_args(); t0 = time.time()

g, b = load(A.perso); pr = g['meshes'][0]['primitives'][0]
P = acc(g, b, pr['attributes']['POSITION']).astype(np.float64)
UV = acc(g, b, pr['attributes']['TEXCOORD_0']).astype(np.float64)
F = acc(g, b, pr['indices']).reshape(-1, 3).astype(np.int64)
hd = trimesh.load(A.hd, force='mesh', process=False)
H = np.asarray(hd.vertices, np.float64); lo, hi = H.min(0), H.max(0); rlo, rhi = P.min(0), P.max(0)
s = (rhi[1] - rlo[1]) / (hi[1] - lo[1])
# repère du perso -> repère du détaillé
toH = lambda X: (X - (rlo + rhi) / 2) / s + (lo + hi) / 2
R = A.res
# --- rastérisation dans l'espace de texture : pour chaque pixel, face + barycentriques
pix_face = -np.ones((R, R), np.int64); pix_bc = np.zeros((R, R, 3))
T = UV[F] * R - 0.5   # coordonnées pixel (x = u, y = v ; glTF : v vers le bas = ligne)
for fi in range(len(F)):
    t = T[fi]; x0, y0 = np.floor(t.min(0)).astype(int); x1, y1 = np.ceil(t.max(0)).astype(int)
    x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, R - 1); y1 = min(y1, R - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    p = np.stack([xs.ravel(), ys.ravel()], 1).astype(np.float64)
    a, bb, c = t; v0 = bb - a; v1 = c - a; v2 = p - a
    den = v0[0] * v1[1] - v1[0] * v0[1]
    if abs(den) < 1e-12: continue
    l1 = (v2[:, 0] * v1[1] - v1[0] * v2[:, 1]) / den; l2 = (v0[0] * v2[:, 1] - v2[:, 0] * v0[1]) / den; l0 = 1 - l1 - l2
    ins = (l0 >= -1e-3) & (l1 >= -1e-3) & (l2 >= -1e-3)
    if not ins.any(): continue
    px = p[ins].astype(int); pix_face[px[:, 1], px[:, 0]] = fi
    pix_bc[px[:, 1], px[:, 0]] = np.stack([l0[ins], l1[ins], l2[ins]], 1)
cov = pix_face >= 0; ys, xs = np.nonzero(cov)
print(f'rastérisation : {cov.sum()} pixels couverts ({time.time()-t0:.0f} s)')
pts = (P[F[pix_face[ys, xs]]] * pix_bc[ys, xs][:, :, None]).sum(1)
# --- point le plus proche sur le détaillé, par paquets
hm = trimesh.Trimesh(H, hd.faces, process=False); huv = np.asarray(hd.visual.uv, np.float64)
tex = np.asarray(hd.visual.material.baseColorTexture.convert('RGB'), np.float32); TH, TW = tex.shape[:2]
col = np.zeros((len(pts), 3), np.float32); step = 100000
for i in range(0, len(pts), step):
    q = toH(pts[i:i + step]); cp, d, tri = trimesh.proximity.closest_point(hm, q)
    bc = np.clip(trimesh.triangles.points_to_barycentric(hm.triangles[tri], cp), 0, None); bc /= bc.sum(1, keepdims=True)
    uv = (huv[hd.faces[tri]] * bc[:, :, None]).sum(1)
    # trimesh donne v vers le haut : ligne = (1 - v)
    xf = np.clip(uv[:, 0] * TW - 0.5, 0, TW - 1); yf = np.clip((1 - uv[:, 1]) * TH - 0.5, 0, TH - 1)
    x0 = np.floor(xf).astype(int); y0 = np.floor(yf).astype(int); x1 = np.minimum(x0 + 1, TW - 1); y1 = np.minimum(y0 + 1, TH - 1)
    fx = (xf - x0)[:, None]; fy = (yf - y0)[:, None]
    col[i:i + step] = (tex[y0, x0] * (1 - fx) * (1 - fy) + tex[y0, x1] * fx * (1 - fy) + tex[y1, x0] * (1 - fx) * fy + tex[y1, x1] * fx * fy)
    print(f'  {min(i+step,len(pts))}/{len(pts)} ({time.time()-t0:.0f} s)', flush=True)
img = np.zeros((R, R, 3), np.float32); img[ys, xs] = col
# --- extension des bords des îlots (8 px)
filled = cov.copy()
for _ in range(8):
    acc_c = np.zeros_like(img); acc_n = np.zeros((R, R), np.float32)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        acc_c += np.roll(np.roll(img * filled[:, :, None], dy, 0), dx, 1); acc_n += np.roll(np.roll(filled, dy, 0), dx, 1)
    new = (~filled) & (acc_n > 0); img[new] = acc_c[new] / acc_n[new][:, None]; filled |= new
o = io.BytesIO(); Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(o, 'JPEG', quality=A.q, optimize=True); data = o.getvalue()
print(f'texture recuite : {R}px, {len(data)//1024} Ko')
# --- remplace l'image couleur dans le GLB (reconstruit le binaire)
bi = g['textures'][g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
views = []
for k, bv in enumerate(g['bufferViews']):
    o0 = bv.get('byteOffset', 0); views.append(data if k == g['images'][bi]['bufferView'] else b[o0:o0 + bv['byteLength']])
g['images'][bi]['mimeType'] = 'image/jpeg'
BIN = bytearray()
for k, d in enumerate(views):
    while len(BIN) % 4: BIN.append(0)
    g['bufferViews'][k]['byteOffset'] = len(BIN); g['bufferViews'][k]['byteLength'] = len(d); BIN.extend(d)
while len(BIN) % 4: BIN.append(0)
g['buffers'] = [{'byteLength': len(BIN)}]
js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(A.out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(BIN)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js); f.write(struct.pack('<II', len(BIN), 0x004E4942)); f.write(BIN)
print(f'{A.out} : {os.path.getsize(A.out)//1024} Ko ({time.time()-t0:.0f} s)')
