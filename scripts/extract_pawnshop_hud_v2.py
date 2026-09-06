"""Extract approved ImageGen HUD components into exact, non-distorted game canvases."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/design-references/pawnshop-hud-v2-reference.png"
OUTPUT = ROOT / "public/assets/ui/pawnshop-hud-v2"

# Bounding boxes come from connected alpha components in the approved 1536x1024 reference sheet.
ASSETS = {
    "action-buy.png": ((76, 13, 329, 258), (116, 112)),
    "action-haggle.png": ((361, 12, 615, 257), (116, 112)),
    "action-reject.png": ((646, 13, 900, 257), (116, 112)),
    "offer-panel.png": ((23, 680, 591, 798), (520, 112)),
    "close-day.png": ((1276, 712, 1511, 931), (120, 108)),
}


def contain_without_distortion(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    scale = min(target_width / source.width, target_height / source.height)
    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((target_width - resized.width) // 2, (target_height - resized.height) // 2),
    )
    return canvas


def main() -> None:
    sheet = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (box, size) in ASSETS.items():
        contain_without_distortion(sheet.crop(box), size).save(OUTPUT / name)


if __name__ == "__main__":
    main()
