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
  res.json({ status: 'ok', service: 'Instagram Carousel Generator' });
});

async function generateCarouselContent() {
  const API_KEY = process.env.FORGE_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Missing FORGE_API_KEY');
  }

  // Créer une tâche Manus pour générer le contenu
  const createRes = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: { 
      'API_KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `Génère un carrousel Instagram business de 8 slides sur une actualité business récente.

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte (pas de markdown, pas de texte avant ou après) :
{
  "subject": "Titre du carrousel",
  "keywords": ["mot1", "mot2", "mot3"],
  "slides": [
    {"title": "Titre slide 1", "subtitle": "Sous-titre slide 1"},
    {"title": "Titre slide 2", "subtitle": "Sous-titre slide 2"},
    ...8 slides au total
  ]
}`,
      agentProfile: 'manus-1.6-lite',
      taskMode: 'chat',
      hideInTaskList: true
    })
  });

  const taskData = await createRes.json();
  console.log(`✓ Task created: ${taskData.task_id}`);

  // Attendre que la tâche soit terminée (polling)
  let attempts = 0;
  while (attempts < 60) { // Max 2 minutes
    await new Promise(r => setTimeout(r, 2000)); // Attendre 2 secondes
    
    const statusRes = await fetch(`https://api.manus.ai/v1/tasks/${taskData.task_id}`, {
      headers: { 'API_KEY': API_KEY }
    });
    
    const status = await statusRes.json();
    
    if (status.status === 'completed') {
      console.log('✓ Task completed');
      // Extraire le JSON de la réponse
      const assistantMessage = status.output?.find(msg => msg.role === 'assistant');
      const textContent = assistantMessage?.content?.[0]?.text || '';
      
      // Chercher le JSON dans la réponse (peut être entouré de ```json```)
      const jsonMatch = textContent.match(/\{[\s\S]*"subject"[\s\S]*"slides"[\s\S]*\}/);
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

async function generateImages(content) {
  const tempDir = `/tmp/carousel_${Date.now()}`;
  await fs.mkdir(tempDir, { recursive: true });

  const input = {
    slides: content.slides,
    keywords: content.keywords,
    branding: '@ahmed.businessbooster',
    background_path: join(__dirname, 'CTA.jpeg'),
    output_dir: tempDir
  };

  return new Promise((resolve, reject) => {
    const python = spawn('python3', [join(__dirname, 'generate_carousel.py')]);
    let stdout = '', stderr = '';

    python.stdin.write(JSON.stringify(input));
    python.stdin.end();

    python.stdout.on('data', d => stdout += d);
    python.stderr.on('data', d => { stderr += d; console.log(`[Python] ${d}`.trim()); });

    python.on('close', code => {
      if (code !== 0) return reject(new Error(`Python failed: ${stderr}`));
      try {
        const result = JSON.parse(stdout);
        resolve({ files: result.files, tempDir });
      } catch (e) {
        reject(new Error(`Parse error: ${e.message}`));
      }
    });
  });
}

app.get('/api/webhook/generate', async (req, res) => {
  console.log('🎨 Generating carousel...');
  try {
    const content = await generateCarouselContent();
    console.log(`✓ Content: "${content.subject}"`);
    
    const { files, tempDir } = await generateImages(content);
    console.log(`✓ ${files.length} images created`);

    // For now, return file paths (will add S3 upload later)
    await fs.rm(tempDir, { recursive: true, force: true });
    
    res.json({
      slides: files.map(f => `file://${f}`),
      subject: content.subject,
      keywords: content.keywords
    });
  } catch (error) {
    console.error(`❌ ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server on port ${PORT}`);
});
