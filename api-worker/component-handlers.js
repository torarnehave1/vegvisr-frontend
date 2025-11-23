// Component serving handler
export async function handleServeComponent(request, env, pathname) {
  try {
    // Extract component name from path: /components/canvas-drawing.js -> canvas-drawing
    const componentName = pathname.replace('/components/', '').replace('.js', '')
    
    // Map of available components
    const components = {
      'canvas-drawing': `/**
 * Canvas Drawing Web Component
 * A standalone, reusable drawing canvas component
 * Usage: <canvas-drawing width="800" height="600"></canvas-drawing>
 */

class CanvasDrawing extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    
    // State
    this.isDrawing = false
    this.currentColor = '#000000'
    this.currentWidth = 2
    this.history = []
    this.historyStep = -1
    this.maxHistory = 20
  }

  static get observedAttributes() {
    return ['width', 'height', 'stroke-color', 'stroke-width', 'show-controls', 'background-color']
  }

  connectedCallback() {
    this.render()
    this.setupCanvas()
    this.setupEventListeners()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render()
      this.setupCanvas()
    }
  }

  get canvasWidth() {
    return parseInt(this.getAttribute('width') || '800')
  }

  get canvasHeight() {
    return parseInt(this.getAttribute('height') || '600')
  }

  get strokeColor() {
    return this.getAttribute('stroke-color') || '#000000'
  }

  get strokeWidth() {
    return parseInt(this.getAttribute('stroke-width') || '2')
  }

  get showControls() {
    return this.getAttribute('show-controls') !== 'false'
  }

  get backgroundColor() {
    return this.getAttribute('background-color') || '#ffffff'
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .canvas-container {
          display: inline-block;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        canvas {
          display: block;
          cursor: crosshair;
          touch-action: none;
        }

        .controls {
          margin-top: 1rem;
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
          padding: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        label {
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
        }

        input[type="color"] {
          width: 50px;
          height: 40px;
          border: 2px solid white;
          border-radius: 6px;
          cursor: pointer;
          background: none;
        }

        input[type="range"] {
          width: 120px;
          cursor: pointer;
        }

        button {
          padding: 0.5rem 1rem;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        button:active {
          transform: translateY(0);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .width-value {
          color: white;
          font-weight: 600;
          min-width: 2ch;
        }
      </style>

      <div class="canvas-container">
        <canvas id="canvas"></canvas>
      </div>

      \${this.showControls ? \`
        <div class="controls">
          <div class="control-group">
            <label>Color:</label>
            <input type="color" id="colorPicker" value="\${this.strokeColor}">
          </div>
          
          <div class="control-group">
            <label>Width:</label>
            <input type="range" id="widthSlider" min="1" max="20" value="\${this.strokeWidth}">
            <span class="width-value" id="widthValue">\${this.strokeWidth}</span>
          </div>

          <button id="undoBtn">↶ Undo</button>
          <button id="clearBtn">✕ Clear</button>
          <button id="exportBtn">⬇ Export PNG</button>
        </div>
      \` : ''}
    \`
  }

  setupCanvas() {
    this.canvas = this.shadowRoot.getElementById('canvas')
    if (!this.canvas) return

    this.ctx = this.canvas.getContext('2d')
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight

    // Set background
    this.ctx.fillStyle = this.backgroundColor
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Initialize drawing settings
    this.currentColor = this.strokeColor
    this.currentWidth = this.strokeWidth

    // Save initial state
    this.saveState()
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this))
    this.canvas.addEventListener('mousemove', this.draw.bind(this))
    this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this))
    this.canvas.addEventListener('mouseleave', this.stopDrawing.bind(this))

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouch.bind(this))
    this.canvas.addEventListener('touchmove', this.handleTouch.bind(this))
    this.canvas.addEventListener('touchend', this.stopDrawing.bind(this))

    if (!this.showControls) return

    // Control events
    const colorPicker = this.shadowRoot.getElementById('colorPicker')
    const widthSlider = this.shadowRoot.getElementById('widthSlider')
    const widthValue = this.shadowRoot.getElementById('widthValue')
    const undoBtn = this.shadowRoot.getElementById('undoBtn')
    const clearBtn = this.shadowRoot.getElementById('clearBtn')
    const exportBtn = this.shadowRoot.getElementById('exportBtn')

    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        this.currentColor = e.target.value
        this.dispatchEvent(new CustomEvent('colorChange', { detail: this.currentColor }))
      })
    }

    if (widthSlider && widthValue) {
      widthSlider.addEventListener('input', (e) => {
        this.currentWidth = parseInt(e.target.value)
        widthValue.textContent = this.currentWidth
      })
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo())
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear())
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.export())
    }
  }

  startDrawing(e) {
    this.isDrawing = true
    const pos = this.getMousePos(e)
    this.ctx.beginPath()
    this.ctx.moveTo(pos.x, pos.y)
  }

  draw(e) {
    if (!this.isDrawing) return

    const pos = this.getMousePos(e)
    
    this.ctx.strokeStyle = this.currentColor
    this.ctx.lineWidth = this.currentWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    
    this.ctx.lineTo(pos.x, pos.y)
    this.ctx.stroke()

    this.dispatchEvent(new CustomEvent('draw', { detail: pos }))
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false
      this.saveState()
    }
  }

  handleTouch(e) {
    e.preventDefault()
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    
    if (e.type === 'touchstart') {
      this.startDrawing(mouseEvent)
    } else if (e.type === 'touchmove') {
      this.draw(mouseEvent)
    }
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  saveState() {
    // Remove any states after current step
    this.history = this.history.slice(0, this.historyStep + 1)
    
    // Add new state
    this.history.push(this.canvas.toDataURL())
    
    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    } else {
      this.historyStep++
    }
  }

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--
      const img = new Image()
      img.src = this.history[this.historyStep]
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.drawImage(img, 0, 0)
      }
    }
  }

  clear() {
    this.ctx.fillStyle = this.backgroundColor
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.saveState()
    this.dispatchEvent(new CustomEvent('clear'))
  }

  export() {
    const dataUrl = this.canvas.toDataURL('image/png')
    this.dispatchEvent(new CustomEvent('export', { detail: dataUrl }))
    
    // Auto-download
    const link = document.createElement('a')
    link.download = \`drawing-\${Date.now()}.png\`
    link.href = dataUrl
    link.click()
  }
}

// Register the custom element
customElements.define('canvas-drawing', CanvasDrawing)`
    }
    
    const componentCode = components[componentName]
    
    if (!componentCode) {
      return new Response('Component not found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        }
      })
    }
    
    return new Response(componentCode, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
    
  } catch (error) {
    console.error('Error serving component:', error)
    return new Response(`Error serving component: ${error.message}`, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    })
  }
}
