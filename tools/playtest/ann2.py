import json, sys
from PIL import Image, ImageDraw
k = sys.argv[1]
im = Image.open('t2_%s.png' % k).convert('RGB'); d = ImageDraw.Draw(im)
info = json.load(open('t2_%s.json' % k))
for x, y, road, outs in info['gn']:
    for q in outs: d.line([(x, y), tuple(q)], fill=(40,90,255) if road else (255,40,40), width=2)
    d.ellipse([x-3, y-3, x+3, y+3], fill=(255,255,0) if not road else (255,255,255))
sx, sy = info['start']; d.ellipse([sx-8, sy-8, sx+8, sy+8], outline=(0,255,0), width=3)
for name, x, y in info['marks']:
    d.ellipse([x-5, y-5, x+5, y+5], fill=(0,200,255)); d.text((x+7, y-7), name, fill=(255,255,255))
im.save('t2a_%s.png' % k)
