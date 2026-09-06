"""Extract the approved reduced-brass HUD sheet without changing component ratios."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/design-references/pawnshop-hud-v3-reduced-brass-reference.png"
OUTPUT = ROOT / "public/assets/ui/pawnshop-hud-v3"

ASSETS = {
    "menu-ledger.png": ((251, 77, 509, 502), (72, 119)),
    "menu-appraise.png": ((557, 77, 812, 502), (72, 120)),
    "menu-inventory.png": ((861, 77, 1117, 502), (72, 120)),
    "menu-memo.png": ((1166, 77, 1422, 502), (72, 120)),
    "offer-panel.png": ((24, 615, 743, 829), (376, 112)),
    "action-buy.png": ((773, 615, 985, 829), (116, 112)),
    "action-haggle.png": ((997, 615, 1207, 829), (116, 112)),
    "action-reject.png": ((1221, 615, 1431, 829), (116, 112)),
    "close-day.png": ((1445, 615, 1652, 829), (120, 108)),
}


def contain_without_distortion(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = min(size[0] / source.width, size[1] / source.height)
    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2),
    )
    return canvas


def main() -> None:
    sheet = Image.open(SOURCE).convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, (box, size) in ASSETS.items():
        contain_without_distortion(sheet.crop(box), size).save(OUTPUT / name)


if __name__ == "__main__":
    main()
