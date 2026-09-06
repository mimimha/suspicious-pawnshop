"""Extract the approved square left-menu buttons without distorting them."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/design-references/pawnshop-menu-square-v1-reference.png"
OUTPUT = ROOT / "public/assets/ui/pawnshop-menu-square-v1"
ASSETS = {
    "menu-ledger.png": (52, 108, 494, 573),
    "menu-appraise.png": (595, 108, 1037, 573),
    "menu-inventory.png": (1138, 108, 1579, 573),
    "menu-memo.png": (1681, 108, 2123, 573),
}


def main() -> None:
    sheet = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, box in ASSETS.items():
        source = sheet.crop(box)
        scale = min(90 / source.width, 90 / source.height)
        resized = source.resize(
            (round(source.width * scale), round(source.height * scale)),
            Image.Resampling.LANCZOS,
        )
        canvas = Image.new("RGBA", (90, 90), (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((90 - resized.width) // 2, (90 - resized.height) // 2))
        canvas.save(OUTPUT / name)


if __name__ == "__main__":
    main()
