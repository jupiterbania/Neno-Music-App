import os
from PIL import Image, ImageDraw

# 1. Source image
src_path = 'assets/Logo&Icons/image copy.png'
if not os.path.exists(src_path):
    src_path = 'assets/Logo&Icons/image.png'

src_img = Image.open(src_path).convert('RGBA')

# Crop to tight bounding box of the logo
bbox = src_img.getbbox()
logo_cropped = src_img.crop(bbox)
logo_w, logo_h = logo_cropped.size
print(f"Source: {src_path}, Logo bounding box: {bbox}, dimensions: {logo_w}x{logo_h}")

def make_icon(size, scale_ratio=0.72, bg_color=(255, 255, 255, 255), is_round=False):
    """
    Creates an icon of `size` x `size`.
    `scale_ratio`: proportion of `size` occupied by the logo.
    `bg_color`: RGBA tuple or None for transparent.
    `is_round`: whether to draw a round circular background.
    """
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    if bg_color is not None:
        if is_round:
            draw.ellipse((0, 0, size - 1, size - 1), fill=bg_color)
        else:
            draw.rectangle((0, 0, size, size), fill=bg_color)
            
    max_logo_dim = int(size * scale_ratio)
    if logo_w >= logo_h:
        new_w = max_logo_dim
        new_h = max(1, int(logo_h * (max_logo_dim / logo_w)))
    else:
        new_h = max_logo_dim
        new_w = max(1, int(logo_w * (max_logo_dim / logo_h)))
        
    scaled_logo = logo_cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    
    canvas.paste(scaled_logo, (offset_x, offset_y), scaled_logo)
    return canvas

# --- 1. Master icon for Tauri CLI ---
# Using 72% scale for a clean, zoomed-out look
master_1024 = make_icon(1024, scale_ratio=0.72, bg_color=(255, 255, 255, 255))
master_1024.save('assets/app-icon-padded.png', 'PNG')
print("Generated assets/app-icon-padded.png")

# --- 2. Android Mipmaps Specs ---
# Adaptive foreground canvas is 108dp, safe zone is 72dp (66.6%).
# Using 56% scale ensures the entire logo sits comfortably inside the circle/squircle with breathing space.
ANDROID_DENSITIES = {
    'mipmap-mdpi': {'legacy': 48, 'fg': 108},
    'mipmap-hdpi': {'legacy': 72, 'fg': 162},
    'mipmap-xhdpi': {'legacy': 96, 'fg': 216},
    'mipmap-xxhdpi': {'legacy': 144, 'fg': 324},
    'mipmap-xxxhdpi': {'legacy': 192, 'fg': 432},
}

target_android_dirs = [
    'src-tauri/gen/android/app/src/main/res',
    'src-tauri/icons/android'
]

for base_dir in target_android_dirs:
    for density, sizes in ANDROID_DENSITIES.items():
        density_dir = os.path.join(base_dir, density)
        os.makedirs(density_dir, exist_ok=True)
        
        # Adaptive foreground (transparent bg, zoomed-out logo ~56%)
        fg_size = sizes['fg']
        fg_icon = make_icon(fg_size, scale_ratio=0.56, bg_color=None)
        fg_path = os.path.join(density_dir, 'ic_launcher_foreground.png')
        fg_icon.save(fg_path, 'PNG')
        
        # Legacy square launcher icon (white bg, zoomed-out logo ~72%)
        legacy_size = sizes['legacy']
        legacy_icon = make_icon(legacy_size, scale_ratio=0.72, bg_color=(255, 255, 255, 255))
        legacy_path = os.path.join(density_dir, 'ic_launcher.png')
        legacy_icon.save(legacy_path, 'PNG')
        
        # Legacy round launcher icon (white circular bg, zoomed-out logo ~64%)
        round_icon = make_icon(legacy_size, scale_ratio=0.64, bg_color=(255, 255, 255, 255), is_round=True)
        round_path = os.path.join(density_dir, 'ic_launcher_round.png')
        round_icon.save(round_path, 'PNG')
        
        print(f"Generated Android icons in {density_dir} (fg: {fg_size}x{fg_size}, legacy: {legacy_size}x{legacy_size})")

# --- 3. Large Notification Icon ---
large_notif_dir = 'src-tauri/gen/android/app/src/main/res/drawable'
os.makedirs(large_notif_dir, exist_ok=True)
notif_large = make_icon(256, scale_ratio=0.72, bg_color=(255, 255, 255, 255))
notif_large.save(os.path.join(large_notif_dir, 'ic_notification_large.png'), 'PNG')
print(f"Generated {large_notif_dir}/ic_notification_large.png")

# --- 4. Desktop PNG icons ---
desktop_sizes = {
    'src-tauri/icons/32x32.png': 32,
    'src-tauri/icons/64x64.png': 64,
    'src-tauri/icons/128x128.png': 128,
    'src-tauri/icons/128x128@2x.png': 256,
    'src-tauri/icons/icon.png': 512,
    'src-tauri/icons/Square30x30Logo.png': 30,
    'src-tauri/icons/Square44x44Logo.png': 44,
    'src-tauri/icons/Square71x71Logo.png': 71,
    'src-tauri/icons/Square89x89Logo.png': 89,
    'src-tauri/icons/Square107x107Logo.png': 107,
    'src-tauri/icons/Square142x142Logo.png': 142,
    'src-tauri/icons/Square150x150Logo.png': 150,
    'src-tauri/icons/Square284x284Logo.png': 284,
    'src-tauri/icons/Square310x310Logo.png': 310,
    'src-tauri/icons/StoreLogo.png': 50,
}

for path, sz in desktop_sizes.items():
    icon = make_icon(sz, scale_ratio=0.72, bg_color=(255, 255, 255, 255))
    icon.save(path, 'PNG')
    print(f"Generated {path} ({sz}x{sz})")

# Generate .ico file for Windows (contains 16, 32, 48, 64, 128, 256 sizes)
ico_sizes = [16, 32, 48, 64, 128, 256]
ico_images = [make_icon(s, scale_ratio=0.72, bg_color=(255, 255, 255, 255)) for s in ico_sizes]
ico_images[0].save(
    'src-tauri/icons/icon.ico',
    format='ICO',
    sizes=[(s, s) for s in ico_sizes],
    append_images=ico_images[1:]
)
print("Generated src-tauri/icons/icon.ico")
