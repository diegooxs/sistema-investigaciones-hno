from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\descargas\sistema_investigaciones_hno\.qa_docx_actualizada")
pages = sorted(source.glob("page-*.png"))
font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 18)
for sheet_number, start in enumerate(range(0, len(pages), 9), 1):
    canvas = Image.new("RGB", (990, 1320), "#D8D8D8")
    draw = ImageDraw.Draw(canvas)
    for offset, path in enumerate(pages[start:start + 9]):
        image = Image.open(path).convert("RGB")
        image.thumbnail((310, 400))
        column, row = offset % 3, offset // 3
        x, y = 15 + column * 325, 30 + row * 430
        canvas.paste(image, (x + (310 - image.width) // 2, y))
        draw.text((x + 155, y + 404), f"Página {start + offset + 1}", fill="black", font=font, anchor="ma")
    canvas.save(source / f"contacto-{sheet_number:02d}.png")
