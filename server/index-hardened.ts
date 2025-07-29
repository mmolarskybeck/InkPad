import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('/api/compile', cors(corsOptions)); // Preflight

// Body parsing with size limit
app.use(express.json({ limit: '2mb' }));

// Rate limiting
const compileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: 'Too many compilation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/compile', compileLimiter);

// Health check with inklecate verification
app.get('/health', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      await execFileAsync('inklecate', ['--version']);
    } else {
      await execFileAsync('npx', ['inklecate', '--version']);
    }
    res.json({ 
      status: 'healthy', 
      timestamp: Date.now(),
      service: 'inkpad-compiler'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      error: 'inklecate not accessible' 
    });
  }
});

// Main compilation endpoint
app.post('/api/compile', async (req, res) => {
  const startTime = Date.now();
  let tempFile: string | null = null;
  
  // Structured logging
  console.log(JSON.stringify({
    event: 'compile_request',
    size: req.body.source?.length || 0,
    timestamp: new Date().toISOString(),
    ip: req.ip
  }));

  try {
    const { source } = req.body;
    
    if (!source || typeof source !== 'string') {
      return res.status(400).json({
        success: false,
        errors: [{
          message: 'Invalid or missing ink source',
          type: 'validation'
        }]
      });
    }

    // Create temp files with cleanup guarantee
    const baseFilename = `ink-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    tempFile = join(tmpdir(), `${baseFilename}.ink`);
    const outputFile = join(tmpdir(), `${baseFilename}.json`);
    
    await fs.writeFile(tempFile, source, 'utf8');

    // Determine inklecate path - prefer npm version
    const inklecatePath = process.env.NODE_ENV === 'production' ? 'inklecate' : 'npx inklecate';

    // Compile with timeout
    const compileTimeout = parseInt(process.env.MAX_COMPILE_TIME || '30000');
    const { stdout, stderr } = await execFileAsync(
      process.env.NODE_ENV === 'production' ? 'inklecate' : 'npx',
      process.env.NODE_ENV === 'production' 
        ? ['-o', outputFile, tempFile]
        : ['inklecate', '-o', outputFile, tempFile],
      { timeout: compileTimeout }
    );

    if (stderr && stderr.includes('ERROR')) {
      // Parse errors from stderr
      const errors = parseInklecateErrors(stderr);
      return res.status(400).json({
        success: false,
        errors
      });
    }

    // Read the compiled JSON output
    let compiledJson;
    try {
      let jsonContent = await fs.readFile(outputFile, 'utf8');
      // Remove BOM if present
      if (jsonContent.charCodeAt(0) === 0xFEFF) {
        jsonContent = jsonContent.slice(1);
      }
      compiledJson = JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to read compiled output:', error);
      return res.status(500).json({
        success: false,
        errors: [{
          message: 'Failed to read compiled output',
          type: 'server_error'
        }]
      });
    } finally {
      // Clean up output file
      await fs.unlink(outputFile).catch(() => {});
    }

    // Success
    console.log(JSON.stringify({
      event: 'compile_success',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }));

    res.json({
      success: true,
      compiled: compiledJson,
      compileTime: Date.now() - startTime
    });

  } catch (error: any) {
    console.error('Compilation error:', error);
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(408).json({
        success: false,
        errors: [{
          message: 'Compilation timeout - story too complex',
          type: 'timeout'
        }]
      });
    }

    res.status(500).json({
      success: false,
      errors: [{
        message: 'Internal compilation error',
        type: 'server_error'
      }]
    });
  } finally {
    // Always cleanup temp file
    if (tempFile) {
      await fs.unlink(tempFile).catch(err => {
        console.error('Failed to cleanup temp file:', err);
      });
    }
  }
});

// Error parser helper
function parseInklecateErrors(stderr: string): any[] {
  const errors = [];
  const lines = stderr.split('\n');
  
  for (const line of lines) {
    const match = line.match(/ERROR: (.+) at line (\d+)/);
    if (match) {
      errors.push({
        message: match[1],
        line: parseInt(match[2]),
        type: 'compilation'
      });
    } else if (line.includes('ERROR:')) {
      errors.push({
        message: line.replace('ERROR:', '').trim(),
        type: 'compilation'
      });
    }
  }
  
  return errors.length > 0 ? errors : [{
    message: stderr,
    type: 'compilation'
  }];
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Compiler service running on port ${PORT}`);
});
