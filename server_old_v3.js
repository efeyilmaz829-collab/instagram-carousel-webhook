import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const PROJECT_ID = 'cvjeZEG2jSRunn9RZSQpyT'; // Projet Manus existant

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Instagram Carousel Generator via Manus Project' });
});

async function generateCarouselWithManus() {
  const API_KEY = process.env.FORGE_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Missing FORGE_API_KEY');
  }

  // Créer une tâche dans le projet Manus existant
  const createRes = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: { 
      'API_KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `Génère un carrousel Instagram business de 8 slides sur une actualité business récente.

Utilise le script generate_carousel.py et l'image CTA.jpeg qui sont dans ce projet.

Retourne les URLs S3 des 8 images générées dans ce format JSON :
{
  "subject": "Titre du carrousel",
  "keywords": ["mot1", "mot2", "mot3"],
  "slides": [
    "https://s3.../slide_1.png",
    "https://s3.../slide_2.png",
    ...8 URLs au total
  ]
}`,
      agentProfile: 'manus-1.6',
      projectId: PROJECT_ID,
      taskMode: 'agent',
      hideInTaskList: false
    })
  });

  const taskData = await createRes.json();
  console.log(`✓ Task created in project: ${taskData.task_id}`);

  // Attendre que la tâche soit terminée (polling)
  let attempts = 0;
  while (attempts < 120) { // Max 4 minutes (Manus peut prendre du temps)
    await new Promise(r => setTimeout(r, 3000)); // Attendre 3 secondes
    
    const statusRes = await fetch(`https://api.manus.ai/v1/tasks/${taskData.task_id}`, {
      headers: { 'API_KEY': API_KEY }
    });
    
    const status = await statusRes.json();
    
    if (status.status === 'completed') {
      console.log('✓ Task completed');
      // Extraire le JSON de la réponse
      const assistantMessage = status.output?.find(msg => msg.role === 'assistant');
      const textContent = assistantMessage?.content?.[0]?.text || '';
      
      // Chercher le JSON dans la réponse
      const jsonMatch = textContent.match(/\{[\s\S]*"subject"[\s\S]*"slides"[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          subject: result.subject,
          keywords: result.keywords,
          slides: result.slides,
          task_url: status.metadata?.task_url || `https://manus.im/app/${taskData.task_id}`
        };
      }
      
      throw new Error('No valid JSON found in task result');
    }
    
    if (status.status === 'failed') {
      throw new Error(`Task failed: ${status.error || 'Unknown error'}`);
    }
    
    attempts++;
  }
  
  throw new Error('Task timeout after 4 minutes');
}

app.get('/api/webhook/generate', async (req, res) => {
  console.log('🎨 Generating carousel via Manus project...');
  try {
    const result = await generateCarouselWithManus();
    console.log(`✓ Carousel generated: "${result.subject}"`);
    console.log(`✓ ${result.slides.length} slides with S3 URLs`);
    
    res.json({
      success: true,
      subject: result.subject,
      keywords: result.keywords,
      slides: result.slides,
      task_url: result.task_url
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
  console.log(`📁 Using Manus project: ${PROJECT_ID}`);
});
