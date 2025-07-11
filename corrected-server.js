const express = require('express')
const multer = require('multer')
const axios = require('axios')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const winston = require('winston')
const path = require('path')
const fs = require('fs')
const FormData = require('form-data')
require('dotenv').config()

const app = express()
app.set('trust proxy', true)

const PORT = process.env.PORT || 3000
const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://whisper:8001'
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '100MB'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// Create upload directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'whisper-api' },
  transports: [
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
})

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseFileSize(MAX_FILE_SIZE),
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 File upload debug:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'unknown',
    })

    const allowedMimes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
      'audio/aac',
      'application/octet-stream', // Added for files without proper mimetype detection
    ]

    // Also check file extension as fallback
    const allowedExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.webm', '.ogg', '.aac']
    const fileExtension = file.originalname
      ? file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'))
      : ''

    const mimeTypeValid = allowedMimes.includes(file.mimetype)
    const extensionValid = allowedExtensions.includes(fileExtension)

    if (mimeTypeValid || extensionValid) {
      console.log('✅ File type accepted:', {
        mimetype: file.mimetype,
        extension: fileExtension,
        acceptedBy: mimeTypeValid ? 'mimetype' : 'extension',
      })
      cb(null, true)
    } else {
      console.log('❌ File type rejected:', {
        mimetype: file.mimetype,
        extension: fileExtension,
        allowedMimes: allowedMimes,
        allowedExtensions: allowedExtensions,
      })
      cb(new Error('Invalid file type. Only audio files are allowed.'))
    }
  },
})

// Middleware
app.use(helmet())
app.use(cors())
app.use(limiter)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - ${req.ip}`)
  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Norwegian Whisper Speech-to-Text API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      transcribe: '/transcribe (POST)',
      status: '/status',
    },
  })
})

// Transcription endpoint
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  const startTime = Date.now()

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    logger.info(`Transcription request: ${req.file.filename}, size: ${req.file.size} bytes`)

    // Prepare form data for Whisper service
    const formData = new FormData()
    formData.append('audio', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    })

    // Add any additional parameters
    if (req.body.language) {
      formData.append('language', req.body.language)
    }
    if (req.body.task) {
      formData.append('task', req.body.task)
    }

    // Send request to Whisper service
    const response = await axios.post(`${WHISPER_SERVICE_URL}/transcribe`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 300000, // 5 minutes timeout
    })

    const processingTime = Date.now() - startTime

    logger.info(
      `Transcription completed: ${req.file.filename}, processing time: ${processingTime}ms`,
    )

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error('Error deleting temp file:', err)
    })

    res.json({
      success: true,
      transcription: response.data,
      metadata: {
        filename: req.file.originalname,
        size: req.file.size,
        processingTime: processingTime,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Transcription error:', error)

    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) logger.error('Error deleting temp file:', err)
      })
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Whisper service unavailable' })
    }

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data.error || 'Transcription failed',
      })
    }

    res.status(500).json({ error: 'Internal server error' })
  }
})

// Service status endpoint
app.get('/status', async (req, res) => {
  try {
    const whisperResponse = await axios.get(`${WHISPER_SERVICE_URL}/health`, {
      timeout: 5000,
    })

    res.json({
      api: 'healthy',
      whisper: whisperResponse.data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(503).json({
      api: 'healthy',
      whisper: 'unavailable',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error)

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE}` })
    }
    return res.status(400).json({ error: error.message })
  }

  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Utility function to parse file size
function parseFileSize(size) {
  const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }
  const match = size.match(/^(\d+)\s*(B|KB|MB|GB)?$/i)
  if (!match) return 1024 * 1024 * 100 // Default 100MB
  const [, value, unit = 'B'] = match
  return parseInt(value) * units[unit.toUpperCase()]
}

app.listen(PORT, () => {
  logger.info(`Whisper API server running on port ${PORT}`)
})
