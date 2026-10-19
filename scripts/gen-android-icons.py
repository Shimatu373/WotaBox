"""把 WotaBox 图标写进 Android 工程。

策略：读取现有 PNG 的尺寸，按同样尺寸重绘 —— 这样不用猜各个密度目录该多大，
系统要求的所有规格都会自动对上。

- ic_launcher.png          圆角方形完整图标（旧版启动器）
- ic_launcher_round.png    圆形裁剪版
- ic_launcher_foreground.png  仅图形内容（透明底），供自适应图标使用
                              108dp 画布里内容占约 66%，正好落在安全区内
- splash.png               深色底 + 居中图标

用法：python scripts/gen-android-icons.py
"""

import importlib.util
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

BG = (11, 16, 32, 255)  # #0b1020

# 复用 gen-icons.py 里的图形生成逻辑
spec = importlib.util.spec_from_file_location('genicons', os.path.join(HERE, 'gen-icons.py'))
genicons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(genicons)


def full_icon(size):
    """圆角方形完整图标"""
    base = genicons.with_rounded_bg(512)
    if size == 512:
        return base
    return base.resize((size, size), Image.LANCZOS)


def round_icon(size):
    """圆形裁剪版（旧版启动器的圆形图标）"""
    src = full_icon(size).convert('RGBA')
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def foreground(size):
    """自适应图标前景：透明底，仅图形"""
    return genicons.content(size)


def splash(size_w, size_h):
    """深色底 + 居中图标"""
    img = Image.new('RGBA', (size_w, size_h), BG)
    side = int(min(size_w, size_h) * 0.38)
    logo = full_icon(side)
    img.alpha_composite(logo, ((size_w - side) // 2, (size_h - side) // 2))
    return img


def replace(path, factory):
    try:
        with Image.open(path) as im:
            w, h = im.size
    except Exception as e:
        print(f'  跳过 {path}: {e}')
        return
    img = factory(w, h) if factory.__code__.co_argcount == 2 else factory(w)
    img.save(path, 'PNG')
    print(f'  {os.path.relpath(path, RES):45s} {w}x{h}')


def main():
    if not os.path.isdir(RES):
        print('找不到 Android 工程，先运行 npx cap add android')
        return

    total = 0
    for root, _dirs, files in os.walk(RES):
        for name in files:
            if not name.endswith('.png'):
                continue
            path = os.path.join(root, name)
            if name == 'ic_launcher.png':
                replace(path, full_icon)
            elif name == 'ic_launcher_round.png':
                replace(path, round_icon)
            elif name == 'ic_launcher_foreground.png':
                replace(path, foreground)
            elif name == 'splash.png':
                replace(path, splash)
            else:
                continue
            total += 1

    print(f'\n共替换 {total} 个图片资源')


if __name__ == '__main__':
    main()
