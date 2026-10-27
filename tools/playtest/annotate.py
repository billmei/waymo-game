import json, sys
from PIL import Image, ImageDraw
for k in sys.argv[1:]:
    im = Image.open('td_%s.png' % k).convert('RGB'); d = ImageDraw.Draw(im)
    info = json.load(open('td_%s.json' % k))
    d.polygon([tuple(p) for p in info['area']], outline=(255,0,255))
    for x, y, nb in info['nodes']:
        for q in nb: d.line([(x, y), tuple(q)], fill=(255,40,40), width=3)
        d.ellipse([x-5, y-5, x+5, y+5], fill=(255,255,0))
    sx, sy = info['start']; d.ellipse([sx-8, sy-8, sx+8, sy+8], outline=(0,255,0), width=3)
    for name, x, y in info['marks']:
        if 0 <= x < 1000 and 0 <= y < 1000:
            d.ellipse([x-6, y-6, x+6, y+6], fill=(0,200,255)); d.text((x+8, y-6), name, fill=(0,0,0)); d.text((x+7, y-7), name, fill=(255,255,255))
    im.save('ann_%s.png' % k)
