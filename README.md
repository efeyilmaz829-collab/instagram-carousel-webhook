# Instagram Carousel Generator Webhook

Système automatisé de génération de carrousels Instagram pour actualités business.

## 🚀 Déploiement sur Railway

### Prérequis
- Compte GitHub
- Compte Railway (gratuit)

### Étapes

1. **Créer un repository GitHub**
   ```bash
   # Déjà fait dans ce projet
   ```

2. **Déployer sur Railway**
   - Aller sur [railway.app](https://railway.app)
   - Cliquer sur "New Project"
   - Sélectionner "Deploy from GitHub repo"
   - Choisir ce repository
   - Railway détectera automatiquement la configuration

3. **Obtenir l'URL**
   - Une fois déployé, Railway fournira une URL publique
   - Format: `https://votre-projet.up.railway.app`

## 📡 Endpoints

### GET /api/webhook/generate
Génère un carrousel Instagram

**Paramètres:**
- `limit` (optionnel): Nombre de carrousels à générer (défaut: 1)

**Exemple:**
```
https://votre-projet.up.railway.app/api/webhook/generate?limit=1
```

**Réponse:**
```json
{
  "slides": [
    "https://url-slide-1.png",
    "https://url-slide-2.png",
    ...
    "https://url-slide-8.png"
  ],
  "subject": "Titre du carrousel",
  "keywords": ["mot1", "mot2", "mot3"]
}
```

## 🎨 Spécifications visuelles

- **Format:** 1080x1350px (Instagram carousel)
- **Police:** Noto Sans
- **Couleur d'accentuation:** Orange vif (#FF8C00)
- **Slides:** 7 slides de contenu + 1 slide CTA personnalisée
- **Branding:** @ahmed.businessbooster

## 🔧 Configuration Make.com

1. **Module HTTP:** GET request vers `/api/webhook/generate?limit=1`
2. **Iterator:** Parcourir le tableau `slides`
3. **Array Aggregator:** Regrouper les 8 slides
4. **Instagram:** Créer un carrousel avec les 8 images
5. **Caption:** Utiliser `{{data.subject}}`

## 📦 Structure du projet

```
.
├── server.js              # Serveur Express
├── generate_carousel.py   # Script Python de génération
├── CTA.jpeg              # Image CTA personnalisée
├── package.json          # Dépendances Node.js
├── requirements.txt      # Dépendances Python
├── nixpacks.toml        # Configuration Railway
└── Procfile             # Commande de démarrage
```

## 🐛 Debugging

Logs disponibles dans le dashboard Railway:
- Requêtes HTTP
- Erreurs Python
- Génération d'images

## 📝 Licence

MIT
