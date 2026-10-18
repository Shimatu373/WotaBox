"""生成 PWA 图标。

设计：深蓝底 + 两根交叉的荧光棒（wota 艺的视觉符号），带管身高光与柔和辉光。
修改配色或形状后重新运行：

    python scripts/gen-icons.py
"""

import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'icons')

BG = (11, 16, 32, 255)        # #0b1020 与 App 背景一致
BLUE = (74, 143, 224, 255)    # #4a8fe0
CYAN = (143, 208, 255, 255)   # #8fd0ff


def content(size):
    """透明底的图形内容：中央光晕 + 两根交叉荧光棒 + 棒身辉光。"""
    s = size
    layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))

    # 中央柔光
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r = s * 0.44
    gd.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=(60, 140, 230, 140))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.10))
    layer = Image.alpha_composite(layer, glow)

    def capsule(angle, color, length_ratio, width_ratio):
        bar = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bar)
        length = s * length_ratio
        width = s * width_ratio
        x0 = s / 2 - length / 2
        y0 = s / 2 - width / 2
        bd.rounded_rectangle([x0, y0, x0 + length, y0 + width], radius=width / 2, fill=color)

        # 管身高光：沿棒身上缘描一条细亮线，圆柱感立刻出来
        hw = width * 0.26
        hx0 = x0 + width * 0.42
        hy0 = y0 + width * 0.20
        bd.rounded_rectangle(
            [hx0, hy0, x0 + length - width * 0.42, hy0 + hw],
            radius=hw / 2,
            fill=(255, 255, 255, 78),
        )
        return bar.rotate(angle, resample=Image.BICUBIC, center=(s / 2, s / 2))

    # 角度与长度刻意不对称，避免读成 UI 的 "关闭" 叉号
    bar_a = capsule(-36, BLUE, 0.72, 0.108)
    bar_b = capsule(24, CYAN, 0.60, 0.108)

    # 棒身辉光
    halo = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    halo = Image.alpha_composite(halo, bar_a)
    halo = Image.alpha_composite(halo, bar_b)
    halo = halo.filter(ImageFilter.GaussianBlur(s * 0.035))

    layer = Image.alpha_composite(layer, halo)
    layer = Image.alpha_composite(layer, bar_a)
    layer = Image.alpha_composite(layer, bar_b)
    return layer


def with_rounded_bg(size, content_scale=1.0, radius_ratio=0.22):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=BG)
    c = content(512)
    if content_scale != 1.0:
        target = int(512 * content_scale)
        c = c.resize((target, target), Image.LANCZOS)
    img.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2))
    return img


def with_square_bg(size, content_scale=1.0):
    """满版方形底（maskable 与 iOS 图标，系统自己做圆角裁切）。"""
    img = Image.new('RGBA', (size, size), BG)
    c = content(512)
    if content_scale != 1.0:
        target = int(512 * content_scale)
        c = c.resize((target, target), Image.LANCZOS)
    img.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2))
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    icon512 = with_rounded_bg(512)
    icon512.save(os.path.join(OUT_DIR, 'icon-512.png'))
    icon512.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT_DIR, 'icon-192.png'))

    # maskable：内容缩到 72%，保证落在安全圆内
    with_square_bg(512, content_scale=0.72).save(os.path.join(OUT_DIR, 'icon-512-maskable.png'))

    # iOS 主屏图标（系统自动加圆角，用满版底色）
    with_square_bg(512, content_scale=0.86).resize((180, 180), Image.LANCZOS).save(
        os.path.join(OUT_DIR, 'apple-touch-icon.png')
    )

    for name in sorted(os.listdir(OUT_DIR)):
        path = os.path.join(OUT_DIR, name)
        with Image.open(path) as im:
            print(f'{name:32s} {im.size[0]}x{im.size[1]}  {os.path.getsize(path)} bytes')


if __name__ == '__main__':
    main()