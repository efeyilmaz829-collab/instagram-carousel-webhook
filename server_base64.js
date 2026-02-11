import express from 'express';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Instagram Carousel Generator (Python + LLM)' });
});

/**
 * Recherche une actualité business avec l'API LLM Manus
 */
async function findBusinessNews() {
  const API_KEY = process.env.FORGE_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Missing FORGE_API_KEY');
  }

  const systemPrompt = `Tu es un expert en actualités business et e-commerce.
Ta mission est de trouver des actualités récentes (7 derniers jours maximum) avec des CHIFFRES CHOCS.

Critères de sélection:
- Doit contenir un chiffre impressionnant (milliards, millions, pourcentages élevés)
- Doit être récent et pertinent
- Doit concerner le business, l'économie ou la France

Réponds UNIQUEMENT avec un JSON:
{
  "title": "Titre court et percutant avec le chiffre",
  "source": "Source de l'info"
}`;

  const response = await fetch('https://api.manus.im/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Trouve-moi une actualité business récente avec un chiffre choc.' }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'business_news',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              source: { type: 'string' }
            },
            required: ['title', 'source'],
            additionalProperties: false
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

/**
 * Génère le contenu des 8 slides avec l'API LLM Manus
 */
async function generateCarouselContent(newsTitle) {
  const API_KEY = process.env.FORGE_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Missing FORGE_API_KEY');
  }

  const systemPrompt = `Tu es un expert en création de contenu Instagram pour entrepreneurs.
Ton style s'inspire de Maxence Rigottier et Sensei Slim : direct, percutant, avec des insights business concrets.

Génère un carrousel de 8 slides sur le sujet donné.

RÈGLES STRICTES:
- Slide 1: Titre accrocheur (max 6 mots)
- Slides 2-7: Un insight par slide (max 15 mots)
- Slide 8: CTA "Sauvegarde ce post" + question engagement
- Ton direct et percutant
- Pas de bullshit, que du concret
- Focus sur l'impact business

Réponds UNIQUEMENT avec un JSON:
{
  "subject": "Sujet du carrousel",
  "keywords": ["mot1", "mot2", "mot3", "mot4"],
  "slides": [
    "Texte slide 1",
    "Texte slide 2",
    ...
    "Texte slide 8"
  ]
}`;

  const response = await fetch('https://api.manus.im/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Crée un carrousel sur: ${newsTitle}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'carousel_content',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                minItems: 4,
                maxItems: 4
              },
              slides: {
                type: 'array',
                items: { type: 'string' },
                minItems: 8,
                maxItems: 8
              }
            },
            required: ['subject', 'keywords', 'slides'],
            additionalProperties: false
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

app.get('/api/webhook/generate', async (req, res) => {
  try {
    console.log('🎨 Starting carousel generation...');

    // 1. Rechercher une actualité business
    console.log('📰 Finding business news...');
    const news = await findBusinessNews();
    console.log('✅ News found:', news.title);

    // 2. Générer le contenu du carrousel
    console.log('🤖 Generating carousel content...');
    const carouselData = await generateCarouselContent(news.title);
    console.log('✅ Content generated:', carouselData.subject);

    // 3. Créer un fichier JSON temporaire pour le script Python
    const tempJsonPath = join(__dirname, `carousel_${Date.now()}.json`);
    await fs.writeFile(tempJsonPath, JSON.stringify(carouselData, null, 2));

    // 4. Exécuter le script Python pour générer les images
    console.log('🐍 Running Python script...');
    const pythonScript = join(__dirname, 'generate_carousel.py');
    
    const pythonProcess = spawn('python3', [pythonScript, tempJsonPath]);
    
    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
      console.log('Python:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
      console.error('Python Error:', data.toString());
    });

    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${pythonError}`));
        } else {
          resolve();
        }
      });
    });

    // 5. Lire les fichiers générés et les convertir en base64
    const outputDir = join(__dirname, 'output');
    const files = await fs.readdir(outputDir);
    const imageFiles = files.filter(f => f.endsWith('.png')).sort();

    const imagesBase64 = [];
    for (const file of imageFiles) {
      const filePath = join(outputDir, file);
      const imageBuffer = await fs.readFile(filePath);
      const base64 = imageBuffer.toString('base64');
      imagesBase64.push(`data:image/png;base64,${base64}`);
    }

    // 6. Nettoyer les fichiers temporaires
    await fs.unlink(tempJsonPath);

    // 7. Retourner le résultat avec les images en base64
    res.json({
      subject: carouselData.subject,
      keywords: carouselData.keywords,
      slides: imagesBase64
    });

    console.log('✅ Carousel generation complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}/`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/webhook/generate`);
});
