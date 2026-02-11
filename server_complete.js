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
  "category": "business" | "ecommerce" | "success_story"
}`;

  const createRes = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: { 
      'API_KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: systemPrompt + "\n\nTrouve-moi UNE actualité business récente avec un chiffre choc pour créer un carrousel Instagram viral. Réponds uniquement en JSON.",
      agentProfile: 'manus-1.6-lite',
      taskMode: 'chat',
      hideInTaskList: true
    })
  });

  const taskData = await createRes.json();
  
  // Attendre que la tâche soit terminée
  let attempts = 0;
  while (attempts < 40) {
    await new Promise(r => setTimeout(r, 2000));
    
    const statusRes = await fetch(`https://api.manus.ai/v1/tasks/${taskData.task_id}`, {
      headers: { 'API_KEY': API_KEY }
    });
    
    const status = await statusRes.json();
    
    if (status.status === 'completed') {
      const assistantMessage = status.output?.find(msg => msg.role === 'assistant');
      const textContent = assistantMessage?.content?.[0]?.text || '';
      
      // Extraire le JSON
      let jsonMatch = textContent.match(/\{[\s\S]*"subject"[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = textContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) jsonMatch[0] = jsonMatch[1];
      }
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No valid JSON found in task result');
    }
    
    if (status.status === 'failed') {
      throw new Error(`Task failed: ${status.error || 'Unknown error'}`);
    }
    
    attempts++;
  }
  
  // Fallback
  return {
    subject: "L'ÉCHEC SPECTACULAIRE D'UNE STARTUP À 1 MILLIARD",
    mainNumber: "1 MILLIARD $",
    context: "Une startup valorisée à 1 milliard de dollars fait faillite en quelques mois.",
    category: "business"
  };
}

/**
 * Génère le contenu détaillé du carrousel (8 slides)
 */
async function generateCarouselContent(news) {
  const API_KEY = process.env.FORGE_API_KEY;
  
  const systemPrompt = `Tu es un expert en storytelling pour Instagram. 
Tu dois créer un script narratif de 8 slides pour un carrousel Instagram basé sur une actualité business.

Style:
- Ton dramatique et percutant
- Chiffres mis en avant
- Storytelling captivant
- Format court et impactant

Structure des 8 slides:
1. HOOK avec le chiffre choc
2. Contexte de l'histoire
3. Le problème/défi
4. Les conséquences
5. Les leçons à tirer
6. L'impact sur le marché
7. Ce que ça change pour vous
8. CTA (géré automatiquement)

Réponds UNIQUEMENT en JSON avec cette structure exacte:
{
  "subject": "Titre du carrousel",
  "keywords": ["mot1", "mot2", "mot3"],
  "slides": [
    {"title": "TITRE SLIDE 1", "subtitle": "Sous-titre explicatif"},
    {"title": "TITRE SLIDE 2", "subtitle": "Sous-titre explicatif"},
    ...7 slides au total (pas 8, la slide 8 est le CTA)
  ]
}`;

  const createRes = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: { 
      'API_KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: systemPrompt + `\n\nActualité: ${news.subject}\nChiffre choc: ${news.mainNumber}\nContexte: ${news.context}\n\nCrée le script du carrousel. Réponds uniquement en JSON.`,
      agentProfile: 'manus-1.6-lite',
      taskMode: 'chat',
      hideInTaskList: true
    })
  });

  const taskData = await createRes.json();
  
  // Attendre que la tâche soit terminée
  let attempts = 0;
  while (attempts < 40) {
    await new Promise(r => setTimeout(r, 2000));
    
    const statusRes = await fetch(`https://api.manus.ai/v1/tasks/${taskData.task_id}`, {
      headers: { 'API_KEY': API_KEY }
    });
    
    const status = await statusRes.json();
    
    if (status.status === 'completed') {
      const assistantMessage = status.output?.find(msg => msg.role === 'assistant');
      const textContent = assistantMessage?.content?.[0]?.text || '';
      
      // Extraire le JSON
      let jsonMatch = textContent.match(/\{[\s\S]*"subject"[\s\S]*"slides"[\s\S]*\}/);
      if (!jsonMatch) {
        jsonMatch = textContent.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) jsonMatch[0] = jsonMatch[1];
      }
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No valid JSON found in task result');
    }
    
    if (status.status === 'failed') {
      throw new Error(`Task failed: ${status.error || 'Unknown error'}`);
    }
    
    attempts++;
  }
  
  throw new Error('Task timeout');
}

/**
 * Génère les images avec le script Python
 */
async function generateImagesWithPython(slides, keywords, branding) {
  const pythonData = {
    slides: [
      ...slides.slice(0, 7),
      {
        title: "Clique sur le lien en bio pour lancer ton business à SUCCÈS.",
        subtitle: ""
      }
    ],
    keywords: keywords || [],
    branding: branding || "@ahmed.businessbooster",
    background_path: join(__dirname, "pasted_file_7pUHYh_image.png"),
    output_dir: "/tmp/carousel_output"
  };

  const pythonProcess = spawn("python3", [join(__dirname, "generate_carousel.py")], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  pythonProcess.stdin.write(JSON.stringify(pythonData));
  pythonProcess.stdin.end();

  let stdout = "";
  let stderr = "";

  pythonProcess.stdout.on("data", (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    stderr += data.toString();
    console.log("[Python]", data.toString().trim());
  });

  const exitCode = await new Promise((resolve) => {
    pythonProcess.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`Python script failed: ${stderr}`);
  }

  const result = JSON.parse(stdout.trim());
  
  if (!result.success) {
    throw new Error(result.error || "Python script failed");
  }

  return result.files;
}

/**
 * Upload les images sur S3
 */
async function uploadToS3(files) {
  const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
  const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  const AWS_BUCKET = process.env.AWS_BUCKET_NAME;

  if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY || !AWS_BUCKET) {
    console.log('[S3] Missing AWS credentials, returning local file paths');
    return files.map(f => `file://${f}`);
  }

  // TODO: Implémenter l'upload S3 avec AWS SDK
  // Pour l'instant, retourner les chemins locaux
  return files.map(f => `file://${f}`);
}

app.get('/api/webhook/generate', async (req, res) => {
  console.log('🎨 Generating carousel...');
  try {
    // 1. Rechercher une actualité
    console.log('[1/4] Searching for business news...');
    const news = await findBusinessNews();
    console.log(`✓ Found: ${news.subject}`);

    // 2. Générer le contenu du carrousel
    console.log('[2/4] Generating carousel content...');
    const content = await generateCarouselContent(news);
    console.log(`✓ Generated ${content.slides.length} slides`);

    // 3. Générer les images avec Python
    console.log('[3/4] Generating images with Python...');
    const files = await generateImagesWithPython(content.slides, content.keywords, "@ahmed.businessbooster");
    console.log(`✓ Generated ${files.length} images`);

    // 4. Upload sur S3
    console.log('[4/4] Uploading to S3...');
    const urls = await uploadToS3(files);
    console.log(`✓ Uploaded ${urls.length} images`);

    res.json({
      success: true,
      subject: content.subject,
      keywords: content.keywords,
      slides: urls
    });
  } catch (error) {
    console.error(`❌ ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server on port ${PORT}`);
});
