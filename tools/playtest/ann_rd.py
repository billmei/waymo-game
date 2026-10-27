import json, sys
from PIL import Image, ImageDraw
k = sys.argv[1]
im = Image.open('rd_%s.png' % k).convert('RGB'); d = ImageDraw.Draw(im)
info = json.load(open('rd_%s.json' % k))
for x, y, nb in info['gn']:
    for q in nb: d.line([(x, y), tuple(q)], fill=(255,40,40), width=3)
    d.ellipse([x-4, y-4, x+4, y+4], fill=(255,255,0))
for r in info['routes']:
    if r['px']:
        d.line([tuple(p) for p in r['px']], fill=(0,60,255), width=4)
        for p in r['px']: d.ellipse([p[0]-3,p[1]-3,p[0]+3,p[1]+3], fill=(255,255,255))
for name, x, y in info['marks']:
    if 0 <= x < 1000 and 0 <= y < 1000:
        d.ellipse([x-5, y-5, x+5, y+5], fill=(0,200,255)); d.text((x+7, y-7), name, fill=(255,255,255))
im.save('rda_%s.png' % k)
