# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
#!/usr/bin/env python3
"""Allège un EPI généré par Meshy (objet seul, sans squelette) pour le jeu.

1. réduction de la forme seule (MeshLab), 2. nouveau découpage de texture (xatlas),
3. couleurs recopiées depuis le modèle d'origine (point le plus proche, texture 4K),
4. texture entièrement remplie autour des morceaux, 5. normales reprises sur l'original, texture JPEG.
Le modèle reste dans son repère d'origine (face vers +Z, haut vers +Y) : l'ajustement sur la tête
se fait dans le jeu.

  python3 epi_prep.py --in casque_meshy.glb --out epi_casque.glb [--faces 5000] [--tex 1024]
"""
import argparse, io, json, os, struct, sys, tempfile, time
import numpy as np, trimesh, pymeshlab, xatlas
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--in', dest='inp', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--faces', type=int, default=5000); ap.add_argument('--tex', type=int, default=1024); ap.add_argument('--q', type=int, default=88)
A = ap.parse_args(); t0 = time.time(); tmp = tempfile.mkdtemp()
hd = trimesh.load(A.inp, force='mesh', process=False)
H = np.asarray(hd.vertices, np.float64); HF = np.asarray(hd.faces, np.int64); HUV = np.asarray(hd.visual.uv, np.float64)
tex = np.asarray(hd.visual.material.baseColorTexture.convert('RGB'), np.float32); TH, TW = tex.shape[:2]
# 1. forme réduite (sommets soudés pour que la réduction ne soit pas bloquée par les coutures)
w = trimesh.Trimesh(H, HF, process=True)
ms = pymeshlab.MeshSet(); ms.add_mesh(pymeshlab.Mesh(w.vertices, w.faces))
ms.meshing_decimation_quadric_edge_collapse(targetfacenum=A.faces, qualitythr=0.4, preservenormal=True, optimalplacement=True, autoclean=True)
mm = ms.current_mesh(); V = mm.vertex_matrix().astype(np.float64); F = mm.face_matrix().astype(np.int64)
# 2. découpage de texture
vmap, F2, UV = xatlas.parametrize(V.astype(np.float32), F.astype(np.uint32))
V = V[vmap]; F = F2.astype(np.int64); UV = UV.astype(np.float64)
print(f'forme : {len(F)} faces, {len(V)} sommets ({time.time()-t0:.0f} s)')
hm = trimesh.Trimesh(H, HF, process=False)
def sample(pts):
    cp, _, tri = trimesh.proximity.closest_point(hm, pts)
    bc = np.clip(trimesh.triangles.points_to_barycentric(hm.triangles[tri], cp), 0, None); bc /= bc.sum(1, keepdims=True)
    return tri, bc
# 3. couleurs : rastérisation dans l'espace de texture, puis lecture sur l'original
R = A.tex; pf = -np.ones((R, R), np.int64); pb = np.zeros((R, R, 3))
T = np.stack([UV[:, 0] * R - 0.5, (1 - UV[:, 1]) * R - 0.5], 1)[F]
for fi in range(len(F)):
    t = T[fi]; x0, y0 = np.maximum(np.floor(t.min(0)).astype(int), 0); x1, y1 = np.minimum(np.ceil(t.max(0)).astype(int), R - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1)); p = np.stack([xs.ravel(), ys.ravel()], 1).astype(float)
    a, b_, c = t; v0 = b_ - a; v1 = c - a; v2 = p - a; den = v0[0] * v1[1] - v1[0] * v0[1]
    if abs(den) < 1e-12: continue
    l1 = (v2[:, 0] * v1[1] - v1[0] * v2[:, 1]) / den; l2 = (v0[0] * v2[:, 1] - v2[:, 0] * v0[1]) / den; l0 = 1 - l1 - l2
    ins = (l0 >= -1e-3) & (l1 >= -1e-3) & (l2 >= -1e-3)
    if ins.any(): q = p[ins].astype(int); pf[q[:, 1], q[:, 0]] = fi; pb[q[:, 1], q[:, 0]] = np.stack([l0[ins], l1[ins], l2[ins]], 1)
cov = pf >= 0; ys, xs = np.nonzero(cov)
pts = (V[F[pf[ys, xs]]] * pb[ys, xs][:, :, None]).sum(1)
col = np.zeros((len(pts), 3), np.float32)
for i in range(0, len(pts), 100000):
    tri, bc = sample(pts[i:i + 100000]); uv = (HUV[HF[tri]] * bc[:, :, None]).sum(1)
    xf = np.clip(uv[:, 0] * TW - 0.5, 0, TW - 1); yf = np.clip((1 - uv[:, 1]) * TH - 0.5, 0, TH - 1)
    col[i:i + 100000] = tex[np.round(yf).astype(int), np.round(xf).astype(int)]
img = np.zeros((R, R, 3), np.float32); img[ys, xs] = col
# 4. toute la texture remplie par la couleur du morceau le plus proche (sinon le fond noir bave aux petites tailles d'image)
from scipy import ndimage
_, (iy, ix) = ndimage.distance_transform_edt(~cov, return_indices=True); img = img[iy, ix]
o = io.BytesIO(); Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(o, 'JPEG', quality=A.q, optimize=True); jpg = o.getvalue()
# 5. normales reprises sur l'original
tri, bc = sample(V); N = (np.asarray(hd.vertex_normals)[HF[tri]] * bc[:, :, None]).sum(1); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
# écriture
BIN = bytearray(); views = []; accs = []
def view(d, t=None):
    while len(BIN) % 4: BIN.append(0)
    v = {'buffer': 0, 'byteOffset': len(BIN), 'byteLength': len(d)}
    if t: v['target'] = t
    BIN.extend(d); views.append(v); return len(views) - 1
def add(arr, ct, typ, t=None, mm=False):
    arr = np.ascontiguousarray(arr); a = {'bufferView': view(arr.tobytes(), t), 'componentType': ct, 'count': len(arr), 'type': typ}
    if mm: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1
uvg = np.stack([UV[:, 0], 1 - UV[:, 1]], 1).astype(np.float32)
attrs = {'POSITION': add(V.astype(np.float32), 5126, 'VEC3', 34962, True), 'NORMAL': add(N.astype(np.float32), 5126, 'VEC3', 34962), 'TEXCOORD_0': add(uvg, 5126, 'VEC2', 34962)}
ind = add(F.reshape(-1).astype(np.uint16), 5123, 'SCALAR', 34963); img_v = view(jpg)
name = os.path.splitext(os.path.basename(A.out))[0]
G = {'asset': {'version': '2.0', 'generator': 'atelier-bois-3d epi_prep.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
     'nodes': [{'mesh': 0, 'name': name}], 'meshes': [{'name': name, 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}],
     'materials': [{'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 0.75}, 'doubleSided': True}],
     'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{}], 'images': [{'bufferView': img_v, 'mimeType': 'image/jpeg'}], 'accessors': accs, 'bufferViews': views}
while len(BIN) % 4: BIN.append(0)
G['buffers'] = [{'byteLength': len(BIN)}]
js = json.dumps(G, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(A.out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(BIN))); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(BIN), 0x004E4942)); f.write(BIN)
print(f'{A.out} : {len(F)} faces, {os.path.getsize(A.out)//1024} Ko ({time.time()-t0:.0f} s)')
