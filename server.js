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

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Instagram Carousel Generator',
    endpoints: {
      generate: '/api/webhook/generate?limit=1'
    }
  });
});

// Main webhook endpoint
app.get('/api/webhook/generate', async (req, res) => {
  const limit = parseInt(req.query.limit) || 1;
  
  console.log(`[Webhook] Received GET request for ${limit} carousel(s)`);
  
  try {
    // Call Python script
    const pythonScript = join(__dirname, 'generate_carousel.py');
    const python = spawn('python3', [pythonScript, limit.toString()]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Python Error] ${data}`);
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Python] Process exited with code ${code}`);
        console.error(`[Python] stderr: ${stderr}`);
        return res.status(500).json({ 
          error: 'Carousel generation failed',
          details: stderr
        });
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`[Webhook] Successfully generated carousel`);
        res.json(result);
      } catch (parseError) {
        console.error(`[JSON Parse Error] ${parseError.message}`);
        console.error(`[Python stdout] ${stdout}`);
        res.status(500).json({ 
          error: 'Failed to parse Python output',
          stdout,
          stderr
        });
      }
    });
    
  } catch (error) {
    console.error(`[Server Error] ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

// POST endpoint (same logic)
app.post('/api/webhook/generate', async (req, res) => {
  const limit = parseInt(req.body.limit || req.query.limit) || 1;
  
  console.log(`[Webhook] Received POST request for ${limit} carousel(s)`);
  
  try {
    const pythonScript = join(__dirname, 'generate_carousel.py');
    const python = spawn('python3', [pythonScript, limit.toString()]);
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Python Error] ${data}`);
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Python] Process exited with code ${code}`);
        return res.status(500).json({ 
          error: 'Carousel generation failed',
          details: stderr
        });
      }
      
      try {
        const result = JSON.parse(stdout);
        console.log(`[Webhook] Successfully generated carousel`);
        res.json(result);
      } catch (parseError) {
        console.error(`[JSON Parse Error] ${parseError.message}`);
        res.status(500).json({ 
          error: 'Failed to parse Python output',
          stdout,
          stderr
        });
      }
    });
    
  } catch (error) {
    console.error(`[Server Error] ${error.message}`);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Instagram Carousel Generator running on port ${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/webhook/generate`);
});
