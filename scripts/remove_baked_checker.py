import sys
from pathlib import Path

from PIL import Image


def main(input_path: str, output_path: str) -> None:
    image = Image.open(input_path).convert("RGBA")
    pixels = list(image.getdata())
    cleaned = []
    for red, green, blue, _ in pixels:
        minimum = min(red, green, blue)
        maximum = max(red, green, blue)
        alpha = 255
        if maximum - minimum <= 30 and minimum >= 180:
            alpha = max(0, min(255, int((220 - minimum) * 6.375)))
        cleaned.append((red, green, blue, alpha))
    image.putdata(cleaned)
    width, height = image.size
    for x in range(width):
        for y in range(4):
            image.putpixel((x, y), (0, 0, 0, 0))
            image.putpixel((x, height - 1 - y), (0, 0, 0, 0))
    for y in range(height):
        for x in range(4):
            image.putpixel((x, y), (0, 0, 0, 0))
            image.putpixel((width - 1 - x, y), (0, 0, 0, 0))
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "PNG")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
