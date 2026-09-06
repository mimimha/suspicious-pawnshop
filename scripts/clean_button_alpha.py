from pathlib import Path
from collections import deque
import sys

from PIL import Image


BUTTON_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/assets/ui/buttons")


def clean_alpha(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = image.load()

    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            brightness = (red + green + blue) / 3
            chroma = max(red, green, blue) - min(red, green, blue)

            # Generated previews baked a white/gray checkerboard into the RGB image.
            # Remove only bright neutral pixels; retain the dark painted button and shadow.
            if chroma < 18 and brightness >= 218:
                alpha = max(0, min(255, round((238 - brightness) * 12.75)))
                pixels[x, y] = (red, green, blue, alpha)

    # Remove any darker checker/shadow remnants only when they are connected to
    # the canvas edge. This protects neutral highlights and lettering inside the button.
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()
    for x in range(image.width):
        queue.extend(((x, 0), (x, image.height - 1)))
    for y in range(image.height):
        queue.extend(((0, y), (image.width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        red, green, blue, alpha = pixels[x, y]
        brightness = (red + green + blue) / 3
        chroma = max(red, green, blue) - min(red, green, blue)
        if not (alpha == 0 or (chroma < 35 and brightness > 150)):
            continue
        pixels[x, y] = (red, green, blue, 0)
        if x:
            queue.append((x - 1, y))
        if x + 1 < image.width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < image.height:
            queue.append((x, y + 1))

    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        margin = 12
        left = max(0, bounds[0] - margin)
        top = max(0, bounds[1] - margin)
        right = min(image.width, bounds[2] + margin)
        bottom = min(image.height, bounds[3] + margin)
        image = image.crop((left, top, right, bottom))

    image.save(path)


for button_path in BUTTON_DIR.glob("*.png"):
    clean_alpha(button_path)
