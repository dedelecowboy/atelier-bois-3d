# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
import json,struct,numpy as np
CT={5126:np.float32,5123:np.uint16,5121:np.uint8,5125:np.uint32,5122:np.int16,5120:np.int8}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    d=open(p,'rb').read();n=struct.unpack('<I',d[12:16])[0];g=json.loads(d[20:20+n]);b=d[20+n+8:]
    return g,b
def acc(g,b,i):
    a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];ct=CT[a['componentType']];nc=NC[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0);st=bv.get('byteStride',0);isz=np.dtype(ct).itemsize
    if st and st!=nc*isz:
        raw=np.frombuffer(b,np.uint8,count=st*(a['count']-1)+nc*isz,offset=off)
        out=np.lib.stride_tricks.as_strided(raw,(a['count'],nc*isz),(st,1)).copy().view(ct).reshape(a['count'],nc)
    else: out=np.frombuffer(b,ct,count=a['count']*nc,offset=off).reshape(a['count'],nc).copy()
    if a.get('normalized'): out=out.astype(np.float32)/np.iinfo(ct).max
    return out
