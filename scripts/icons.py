"""App icons: a 4x4 corner of a maple-and-walnut board with a blue target square."""
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]
def icon(size, path, pad=0.0):
    im = Image.new('RGB', (size, size), '#2b2118'); d = ImageDraw.Draw(im)
    m = int(size * (0.16 + pad)); n = 4; s = (size - 2 * m) / n
    for i in range(n):
        for j in range(n):
            c = '#f0d9b5' if (i + j) % 2 == 0 else '#b58863'
            if (i, j) == (1, 2): c = '#2457d6'
            d.rectangle([m + i * s, m + j * s, m + (i + 1) * s, m + (j + 1) * s], fill=c)
    im.save(path)
for size, name in [(180, 'icon-180.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    icon(size, os.path.join(out, name))
icon(512, os.path.join(out, 'icon-maskable-512.png'), pad=0.06)
