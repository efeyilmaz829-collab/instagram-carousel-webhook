const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration
const FORGE_API_URL = process.env.FORGE_API_URL || process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.FORGE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'efeyilmaz829-collab';
const GITHUB_REPO = 'instagram-carousel-webhook';

// Initialiser Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Upload une image sur GitHub et retourne l'URL publique
 */
async function uploadToGitHub(filePath, fileName) {
  try {
    const content = await fs.readFile(filePath);
    const base64Content = content.toString('base64');
    
    const githubPath = `carousel-images/${Date.now()}-${fileName}`;
    
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: githubPath,
      message: `Upload carousel image: ${fileName}`,
      content: base64Content,
    });
    
    // Retourner l'URL publique
    return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${githubPath}`;
  } catch (error) {
    console.error(`[GitHub Upload] Error uploading ${fileName}:`, error.message);
    throw error;
  }
}

/**
 * Génère un carrousel via le script Python
 */
async function generateCarousel() {
  try {
    console.log('[Carousel] Generating carousel content via LLM...');
    
    // 1. Appeler l'API LLM pour générer le contenu
    const response = await fetch(`${FORGE_API_URL}/llm/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en actualités business et e-commerce. Génère un carrousel Instagram de 8 slides sur une actualité business récente avec un chiffre choc.

Réponds UNIQUEMENT en JSON avec cette structure:
{
  "subject": "Titre percutant avec le chiffre choc",
  "keywords": ["mot1", "mot2", "mot3", "mot4"],
  "slides": [
    {"title": "TITRE SLIDE 1", "content": "Contenu slide 1"},
    {"title": "TITRE SLIDE 2", "content": "Contenu slide 2"},
    ...
    {"title": "TITRE SLIDE 8", "content": "Contenu slide 8"}
  ]
}`
          },
          {
            role: 'user',
            content: 'Génère un carrousel sur une actualité business récente avec un chiffre impressionnant.'
          }
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Nettoyer le JSON (retirer les balises markdown)
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.substring(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.substring(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
    }
    
    const carouselData = JSON.parse(cleanedContent.trim());
    console.log('[Carousel] Content generated:', carouselData.subject);

    // 2. Créer un fichier JSON temporaire pour le script Python
    const tempDir = '/tmp/carousel_input';
    await fs.mkdir(tempDir, { recursive: true });
    const inputFile = path.join(tempDir, 'carousel_data.json');
    await fs.writeFile(inputFile, JSON.stringify(carouselData, null, 2));

    // 3. Exécuter le script Python
    console.log('[Carousel] Generating images with Python...');
    const outputDir = '/tmp/carousel_output';
    await fs.mkdir(outputDir, { recursive: true });

    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'generate_carousel.py'),
      inputFile,
    ]);

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
      console.log('[Python]', data.toString().trim());
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
      console.error('[Python Error]', data.toString().trim());
    });

    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python script failed with code ${code}: ${pythonError}`));
        }
      });
    });

    // 4. Lire les fichiers générés et uploader sur GitHub
    console.log('[Carousel] Uploading images to GitHub...');
    const files = await fs.readdir(outputDir);
    const imageFiles = files.filter(f => f.endsWith('.png')).sort();
    
    const uploadPromises = imageFiles.map((file, index) => {
      const filePath = path.join(outputDir, file);
      return uploadToGitHub(filePath, `slide_${index + 1}.png`);
    });
    
    const imageUrls = await Promise.all(uploadPromises);
    console.log('[Carousel] All images uploaded to GitHub');

    // 5. Nettoyer les fichiers temporaires
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.rm(outputDir, { recursive: true, force: true });

    return {
      success: true,
      subject: carouselData.subject,
      keywords: carouselData.keywords,
      slides: imageUrls,
    };
  } catch (error) {
    console.error('[Carousel] Error:', error);
    throw error;
  }
}

// Route webhook
app.get('/api/webhook/generate', async (req, res) => {
  try {
    console.log('[Webhook] Received request for carousel generation');
    
    const result = await generateCarousel();
    
    res.json(result);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook: http://localhost:${PORT}/api/webhook/generate`);
});
