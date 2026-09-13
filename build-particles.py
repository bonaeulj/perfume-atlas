"""Precompute bitmap coordinates so file:// previews need no canvas pixel reads."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
source = (root / 'perfumes-data.js').read_text().split('=', 1)[1].strip().rstrip(';')
output = {}
for perfume in json.loads(source):
    path = root / perfume.get('image', '')
    if not path.is_file():
        continue
    with Image.open(path) as original:
        image = original.convert('RGBA')
        image.thumbnail((110, 110))
        placed = Image.new('RGBA', (110, 110), (255, 255, 255, 0))
        placed.alpha_composite(image, ((110-image.width)//2, (110-image.height)//2))
        alpha = placed.getchannel('A')
        bitmap = placed.convert('L').convert('1')
        points, colors, palette, palette_index = [], [], [], {}
        for y in range(110):
            for x in range(110):
                if alpha.getpixel((x, y)) <= 24:
                    continue
                if bitmap.getpixel((x, y)) != 0 and (x * 17 + y * 31) % 13 != 0:
                    continue
                r, g, b, _ = placed.getpixel((x, y))
                # Compact 64-colour maximum palette while retaining the
                # product's characteristic colour instead of storing RGB per dot.
                rgb = tuple(min(255, round(channel / 51) * 51) for channel in (r, g, b))
                if rgb not in palette_index:
                    palette_index[rgb] = len(palette)
                    palette.append('#%02x%02x%02x' % rgb)
                points.append(y * 110 + x)
                colors.append(palette_index[rgb])
        output[perfume['id']] = {'p': points, 'c': colors, 'k': palette}
(root / 'bitmap-points.js').write_text('window.BITMAP_POINTS='+json.dumps(output,separators=(',',':'))+';\n')
print(f'Built bitmap coordinates for {len(output)} fragrances')
