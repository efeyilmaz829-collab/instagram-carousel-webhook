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
  const API_URL = process.env.BUILT_IN_FORGE_API_URL || process.env.FORGE_API_URL;
  const API_KEY = process.env.BUILT_IN_FORGE_API_KEY || process.env.FORGE_API_KEY;
  
  if (!API_URL || !API_KEY) {
    throw new Error('Missing API credentials');
  }

  const res = await fetch(`${API_URL}/llm/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Tu génères des carrousels Instagram business de 8 slides en JSON.' },
        { role: 'user', content: 'Crée un carrousel sur une actualité business. JSON: {"subject":"titre","keywords":["mot"],"slides":[{"title":"t","subtitle":"s"}]} - 8 slides exactement' }
      ]
    })
  });
  
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
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
