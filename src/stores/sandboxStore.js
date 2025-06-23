import { defineStore } from 'pinia'

export const useSandboxStore = defineStore('sandbox', {
  state: () => ({
    // Current worker code
    currentWorkerCode: '',

    // User prompt
    userPrompt: '',

    // Loading states
    isGenerating: false,

    // Admin logs for debugging
    logs: [],

    // Generation history
    generationHistory: [],
  }),

  actions: {
    // Add log entry with timestamp
    addLog(type, message, data = null) {
      const logEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type, // 'info', 'success', 'error', 'request', 'response'
        message,
        data,
      }

      this.logs.unshift(logEntry) // Add to beginning for latest first

      // Keep only last 100 logs to prevent memory issues
      if (this.logs.length > 100) {
        this.logs = this.logs.slice(0, 100)
      }

      console.log(`[Sandbox ${type.toUpperCase()}]`, message, data)
    },

    // Clear all logs
    clearLogs() {
      this.logs = []
      this.addLog('info', 'Logs cleared')
    },

    // Set user prompt
    setPrompt(prompt) {
      this.userPrompt = prompt
      this.addLog('info', `Prompt set: "${prompt}"`)
    },

    // Generate worker code
    async generateWorkerCode() {
      if (!this.userPrompt.trim()) {
        this.addLog('error', 'No prompt provided')
        return
      }

      this.isGenerating = true
      this.addLog('request', 'Starting AI worker generation', { prompt: this.userPrompt })

      try {
        // Add timestamp to prevent caching issues
        const timestamp = Date.now()
        const response = await fetch(
          `https://knowledge-graph-worker.torarnehave.workers.dev/generate-worker-ai?t=${timestamp}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
              prompt: this.userPrompt,
              userPrompt: this.userPrompt,
              timestamp: timestamp, // Include in body too
            }),
          },
        )

        this.addLog('info', `API response status: ${response.status}`)

        const result = await response.json()
        this.addLog('response', 'Received API response', result)

        if (result.success) {
          this.currentWorkerCode = result.code
          this.addLog('success', 'Worker code generated successfully')

          // Add to history
          this.generationHistory.unshift({
            id: Date.now(),
            prompt: this.userPrompt,
            code: result.code,
            timestamp: new Date().toISOString(),
            model: result.model || 'unknown',
          })

          // Keep only last 10 generations
          if (this.generationHistory.length > 10) {
            this.generationHistory = this.generationHistory.slice(0, 10)
          }
        } else {
          this.addLog('error', 'AI generation failed', result)
        }
      } catch (error) {
        this.addLog('error', 'Network error during generation', error.message)
      } finally {
        this.isGenerating = false
      }
    },

    // Set worker code manually
    setWorkerCode(code) {
      this.currentWorkerCode = code
      this.addLog('info', 'Worker code updated manually')
    },

    // Clear current code
    clearCode() {
      this.currentWorkerCode = ''
      this.addLog('info', 'Worker code cleared')
    },

    // Deploy worker code
    async deployWorker(userToken) {
      if (!this.currentWorkerCode.trim()) {
        this.addLog('error', 'No code to deploy')
        return
      }

      if (!userToken) {
        this.addLog('error', 'User token required for deployment')
        return
      }

      this.addLog('request', 'Starting worker deployment', {
        userToken: userToken.substring(0, 10) + '...', // Log partial token for privacy
        codeLength: this.currentWorkerCode.length,
      })

      try {
        const response = await fetch('https://api.vegvisr.org/deploy-sandbox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userToken: userToken,
            code: this.currentWorkerCode,
          }),
        })

        this.addLog('info', `Deployment API response status: ${response.status}`)

        const result = await response.json()
        this.addLog('response', 'Received deployment response', result)

        if (result.success) {
          this.addLog('success', `Worker deployed successfully to: ${result.endpoint}`)
          return {
            success: true,
            endpoint: result.endpoint,
            workerName: result.workerName,
            message: result.message,
          }
        } else {
          this.addLog('error', 'Deployment failed', result)
          return {
            success: false,
            error: result.error || 'Unknown deployment error',
          }
        }
      } catch (error) {
        this.addLog('error', 'Network error during deployment', error.message)
        return {
          success: false,
          error: 'Network error: ' + error.message,
        }
      }
    },
  },
})
