const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FORGE_API_KEY = process.env.FORGE_API_KEY;
const FORGE_API_URL = process.env.FORGE_API_URL || 'https://api.manus.im';

// ============================================================================
// LLM INTEGRATION (copié depuis le projet Manus original)
// ============================================================================

const resolveApiUrl = () => {
  const baseUrl = FORGE_API_URL && FORGE_API_URL.trim().length > 0
    ? FORGE_API_URL.replace(/\/$/, "")
    : "https://forge.manus.im";
  return `${baseUrl}/v1/chat/completions`;
};

const assertApiKey = () => {
  if (!FORGE_API_KEY) {
    throw new Error("FORGE_API_KEY is not configured");
  }
};

const normalizeMessage = (message) => {
  const { role, content } = message;
  return { role, content };
};

async function invokeLLM(params) {
  assertApiKey();

  const { messages } = params;

  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage),
    max_tokens: 32768,
    thinking: {
      budget_tokens: 128
    }
  };

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return await response.json();
}

// ============================================================================
// NEWS SEARCH (copié depuis le projet Manus original)
// ============================================================================

function cleanJsonResponse(content) {
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

async function findBusinessNews() {
  const systemPrompt = `Tu es un expert en actualités business et e-commerce. 
Ta mission est de trouver des actualités récentes (7 derniers jours maximum) avec des CHIFFRES CHOCS.

Critères de sélection:
- Doit contenir un chiffre impressionnant (milliards, millions, pourcentages élevés)
- Doit être récent et pertinent
- Doit avoir un angle dramatique ou contre-intuitif
- Catégories: échecs spectaculaires, rachats, licenciements, pivots stratégiques, success stories

Exemples de sujets parfaits:
- "88 milliards $ brûlés dans le Metaverse de Meta"
- "20 milliards $ : le rachat Adobe/Figma qui a échoué"
- "400 milliards $ de retours en e-commerce"

Réponds UNIQUEMENT en JSON avec cette structure exacte:
{
  "subject": "Titre court et percutant",
  "mainNumber": "LE CHIFFRE CHOC",
  "context": "Explication courte du contexte (1-2 phrases)",
  "category": "business" | "ecommerce" | "success_story",
  "sourceUrl": "URL de la source si disponible"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: "Trouve-moi UNE actualité business récente avec un chiffre choc pour créer un carrousel Instagram viral. Réponds uniquement en JSON.",
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[NewsSearch] LLM response:", JSON.stringify(response, null, 2));
      throw new Error("No content in LLM response");
    }

    const cleanedContent = cleanJsonResponse(content);
    const news = JSON.parse(cleanedContent);
    return news;
  } catch (error) {
    console.error("[NewsSearch] Error finding business news:", error);
    
    // Fallback: retourner une actualité par défaut
    return {
      subject: "L'ÉCHEC SPECTACULAIRE D'UNE STARTUP À 1 MILLIARD",
      mainNumber: "1 MILLIARD $",
      context: "Une startup valorisée à 1 milliard de dollars fait faillite en quelques mois. L'histoire d'une croissance trop rapide.",
      category: "business",
    };
  }
}

async function generateDetailedCarouselContent(news) {
  const systemPrompt = `Tu es un expert en storytelling pour Instagram. 
Tu dois créer un script narratif de 8 slides pour un carrousel Instagram basé sur une actualité business.

Style:
- Ton dramatique et percutant
- Questions rhétoriques
- Contraste et ironie
- Leçon universelle pour entrepreneurs

Structure obligatoire des 8 slides:
1. HOOK CHOC : Chiffre + mot dramatique
2. QUESTION PROVOCANTE : Pourquoi + motivation cachée
3. OBSTACLE/RÉVÉLATION : Coup de massue ou secret dévoilé
4. PRIX/DANGER : Conséquence chiffrée
5. RETOURNEMENT/SOLUTION : Vrai gagnant ou stratégie
6. VISION MACRO : Portée universelle
7. LEÇON : Principe contre-intuitif
8. CTA : "Clique sur le lien en bio pour lancer ton business à SUCCÈS."

Réponds UNIQUEMENT en JSON avec cette structure:
{
  "slides": [
    {"title": "TITRE EN MAJUSCULES", "subtitle": "Sous-titre explicatif."},
    ... (8 slides au total)
  ],
  "keywords": ["MOT1", "MOT2", ...]
}

IMPORTANT pour les mots-clés:
- Sélectionne 10-15 mots-clés IMPACTANTS qui seront surlignés en ORANGE
- Choisis les mots les plus CHOCS et DRAMATIQUES (chiffres, noms de marques, mots émotionnels)
- Exemples: "MILLIARDS", "TESLA", "LICENCIEMENTS", "CHOC", "MASSIFS", "PERDUS", "VRAIMENT"
- Évite les mots communs ("le", "de", "pour", "et", etc.)
- Privilégie les NOMS PROPRES, CHIFFRES, et MOTS ÉMOTIONNELS`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Crée un script de carrousel Instagram basé sur cette actualité:
          
Sujet: ${news.subject}
Chiffre choc: ${news.mainNumber}
Contexte: ${news.context}
Catégorie: ${news.category}

Respecte la structure narrative en 8 slides. Réponds uniquement en JSON.`,
        },
      ],
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[NewsSearch] LLM response:", JSON.stringify(response, null, 2));
      throw new Error("No content in LLM response");
    }

    const cleanedContent = cleanJsonResponse(content);
    const parsed = JSON.parse(cleanedContent);
    
    return {
      ...parsed,
      subject: news.subject,
      mainNumber: news.mainNumber,
    };
  } catch (error) {
    console.error("[NewsSearch] Error generating carousel content:", error);
    throw error;
  }
}

// ============================================================================
// CAROUSEL GENERATION (Python script)
// ============================================================================

async function generateCarouselWithPython(data) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [
      path.join(__dirname, 'generate_carousel.py'),
      JSON.stringify(data)
    ]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Python stderr]:', data.toString());
    });

    python.on('close', async (code) => {
      if (code !== 0) {
        console.error('[Python] Process exited with code', code);
        console.error('[Python] stderr:', stderr);
        return reject(new Error(`Python script failed with code ${code}`));
      }

      try {
        const result = JSON.parse(stdout);
        
        if (result.success && result.files) {
          // Convertir les fichiers en base64
          const base64Images = [];
          for (const filePath of result.files) {
            const imageBuffer = await fs.readFile(filePath);
            const base64 = imageBuffer.toString('base64');
            base64Images.push(`data:image/jpeg;base64,${base64}`);
          }
          
          resolve({
            success: true,
            files: base64Images
          });
        } else {
          resolve(result);
        }
      } catch (error) {
        console.error('[Python] Failed to parse output:', stdout);
        reject(new Error('Failed to parse Python output'));
      }
    });
  });
}

// ============================================================================
// WEBHOOK ENDPOINT
// ============================================================================

app.all('/api/webhook/generate', async (req, res) => {
  try {
    console.log(`[Webhook] Received ${req.method} request for carousel generation`);

    // 1. Rechercher une actualité business
    console.log("[Webhook] Searching for business news...");
    const news = await findBusinessNews();
    console.log("[Webhook] Found news:", news.subject);

    // 2. Générer le contenu détaillé du carrousel
    console.log("[Webhook] Generating carousel content...");
    const carouselContent = await generateDetailedCarouselContent(news);
    console.log("[Webhook] Content generated with", carouselContent.slides.length, "slides");

    // 3. Générer les images avec Python
    console.log("[Webhook] Generating images with Python script...");
    const result = await generateCarouselWithPython({
      slides: carouselContent.slides,
      keywords: carouselContent.keywords,
      branding: "@ahmed.businessbooster",
    });

    if (!result.success || !result.files) {
      throw new Error(result.error || "Failed to generate carousel");
    }

    console.log("[Webhook] Images generated:", result.files.length);

    console.log(`[Webhook] ✅ Carousel generated successfully`);

    // Retourner la réponse au format simple pour Make.com
    res.json({
      success: true,
      subject: carouselContent.subject,
      main_number: carouselContent.mainNumber,
      slides: result.files, // Base64 images
      keywords: carouselContent.keywords,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Webhook] ❌ Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/webhook/generate`);
});
