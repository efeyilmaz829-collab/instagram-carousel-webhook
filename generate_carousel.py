#!/usr/bin/env python3
"""
Script de génération de carrousels Instagram
Copie EXACTE du script original de l'utilisateur
"""
import sys
import json
import os
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# CONFIGURATION
IMAGE_WIDTH = 1080
IMAGE_HEIGHT = 1350

# POLICES (utiliser Noto Sans comme dans le script original)
try:
    FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
    FONT_REGULAR = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
except:
    # Fallback sur DejaVu si Noto n'est pas disponible
    FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# COULEURS
WHITE = (255, 255, 255)
ORANGE = (255, 140, 0)  # #FF8C00 - Orange vif
GRAY = (200, 200, 200)
FOOTER_GRAY = (160, 160, 160)
NUMBER_GRAY = (150, 150, 150)
BACKGROUND_COLOR = (10, 20, 30)  # Bleu foncé

def draw_centered_text(draw, text, y_start, font, color, highlights=None, highlight_color=None, max_width=900):
    """
    Dessine du texte centré avec possibilité de surligner certains mots
    COPIE EXACTE de la fonction du script original
    """
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        test_line = ' '.join(current_line + [word])
        if draw.textlength(test_line, font=font) <= max_width:
            current_line.append(word)
        else:
            lines.append(current_line)
            current_line = [word]
    lines.append(current_line)
    
    y = y_start
    for line in lines:
        line_str = ' '.join(line)
        x = (IMAGE_WIDTH - draw.textlength(line_str, font=font)) / 2
        curr_x = x
        
        for word in line:
            clean_word = word.strip('.,!?:\"').upper()
            is_high = highlights and any(h.upper() in clean_word for h in highlights)
            draw.text((curr_x, y), word + " ", font=font, fill=highlight_color if is_high else color)
            curr_x += draw.textlength(word + " ", font=font)
        
        y += font.size * 1.3
    
    return y

def create_slide(slide_number, title, subtitle, keywords, branding, background_path=None):
    """
    Crée une slide du carrousel
    COPIE EXACTE de la logique du script original
    """
    # Créer l'image de fond
    if background_path and os.path.exists(background_path):
        base_img = Image.open(background_path).convert("RGB")
        img = base_img.resize((IMAGE_WIDTH, IMAGE_HEIGHT), Image.Resampling.LANCZOS)
    else:
        img = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT), BACKGROUND_COLOR)
    
    draw = ImageDraw.Draw(img)
    
    # Charger les polices
    try:
        font_num = ImageFont.truetype(FONT_REGULAR, 35)
        font_title = ImageFont.truetype(FONT_BOLD, 70 if slide_number < 8 else 60)
        font_sub = ImageFont.truetype(FONT_REGULAR, 40)
        font_footer = ImageFont.truetype(FONT_REGULAR, 28)
        font_arrow = ImageFont.truetype(FONT_BOLD, 45)
    except:
        print(f"Warning: Could not load fonts, using default", file=sys.stderr)
        font_num = ImageFont.load_default()
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_footer = ImageFont.load_default()
        font_arrow = ImageFont.load_default()
    
    # Numérotation en haut à droite (comme dans le script original)
    draw.text((950, 60), f"{slide_number}/8", font=font_num, fill=NUMBER_GRAY)
    
    # Titre centré avec mots-clés en OR (position Y=500 comme dans le script original)
    next_y = draw_centered_text(draw, title, 500, font_title, WHITE, keywords, ORANGE, max_width=900)
    
    # Sous-titre (si présent)
    if subtitle:
        draw_centered_text(draw, subtitle, next_y + 60, font_sub, GRAY, max_width=850)
    
    # Branding en bas au centre
    footer_text = branding
    footer_w = draw.textlength(footer_text, font=font_footer)
    draw.text(((IMAGE_WIDTH - footer_w) / 2, 1260), footer_text, font=font_footer, fill=FOOTER_GRAY)
    
    # Flèche dorée → en bas à droite (sauf pour slide 8)
    if slide_number < 8:
        draw.text((980, 1250), "→", font=font_arrow, fill=ORANGE)
    
    return img

def generate_carousel(data, output_dir):
    """
    Génère un carrousel complet
    
    Args:
        data: dict contenant:
            - slides: liste de 8 dicts avec {title, subtitle}
            - keywords: liste de mots-clés à mettre en OR
            - branding: texte du branding (ex: @ahmed.businessbooster)
            - background_path: chemin vers l'image de fond (optionnel)
        output_dir: répertoire de sortie pour les images
    
    Returns:
        Liste des chemins des images générées
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    slides_data = data.get('slides', [])
    keywords = data.get('keywords', [])
    branding = data.get('branding', '@ahmed.businessbooster')
    background_path = data.get('background_path')
    
    if len(slides_data) != 8:
        raise ValueError(f"Le carrousel doit contenir exactement 8 slides (reçu {len(slides_data)})")
    
    generated_files = []
    
    for i, slide_data in enumerate(slides_data, 1):
        title = slide_data.get('title', '')
        subtitle = slide_data.get('subtitle', '')
        
        img = create_slide(i, title, subtitle, keywords, branding, background_path)
        
        output_file = output_path / f"slide_{i}.png"
        img.save(output_file, 'PNG', quality=95)
        generated_files.append(str(output_file))
        
        print(f"✓ Slide {i}/8 générée: {output_file}", file=sys.stderr)
    
    return generated_files

if __name__ == "__main__":
    # Lire les données depuis stdin
    if len(sys.argv) > 1:
        # Mode fichier
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
        output_dir = sys.argv[2] if len(sys.argv) > 2 else "./output"
    else:
        # Mode stdin (utilisé par Node.js)
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        output_dir = data.get('output_dir', '/tmp/carousel_output')
    
    # Générer le carrousel
    generated_files = generate_carousel(data, output_dir)
    
    # Retourner les chemins des fichiers générés (format attendu par TypeScript)
    print(json.dumps({"success": True, "files": generated_files}))
