class CodeBlock extends HTMLElement {
  static get observedAttributes() {
    return ['language', 'line-numbers', 'theme']
  }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.render()
    }
  }

  getLanguage() {
    const lang = (this.getAttribute('language') || 'javascript').toLowerCase()
    return lang
  }

  escapeHtml(code) {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  highlight(code, lang) {
    // Extremely lightweight highlighting to avoid external deps
    const escaped = this.escapeHtml(code)

    const patterns = {
      javascript: {
        comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g,
        string: /(["'`])(?:\\.|(?!\1)[^\\])*\1/g,
        keyword: /\b(await|async|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/g,
        number: /\b(-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.\d+|\d+))\b/g
      },
      json: {
        string: /(["'])(?:\\.|(?!\1)[^\\])*\1/g,
        number: /\b(-?(0x[\dA-Fa-f]+|\d*\.\d+|\d+))\b/g,
        literal: /\b(true|false|null)\b/g
      },
      sql: {
        comment: /(\/\*[^]*?\*\/|--[^\n]*)/g,
        string: /('(?:''|[^'])*')/g,
        keyword: /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|OFFSET|AS)\b/gi,
        number: /\b(-?\d*\.\d+|-?\d+)\b/g
      },
      bash: {
        comment: /(#.*)/g,
        string: /(["'])(?:\\.|(?!\1)[^\\])*\1/g,
        keyword: /\b(if|then|else|elif|fi|for|in|do|done|while|case|esac|function)\b/g,
        number: /\b(-?\d*\.\d+|-?\d+)\b/g
      },
      html: {},
      css: {}
    }

    const colors = {
      comment: '#7a7a7a',
      string: '#e6db74',
      keyword: '#66d9ef',
      number: '#ae81ff',
      literal: '#fd971f'
    }

    const apply = (text, regex, cls) => text.replace(regex, match => `<span class="${cls}">${match}</span>`)

    let result = escaped
    const rules = patterns[lang] || patterns.javascript
    if (rules.comment) result = apply(result, rules.comment, 'cb-comment')
    if (rules.string) result = apply(result, rules.string, 'cb-string')
    if (rules.keyword) result = apply(result, rules.keyword, 'cb-keyword')
    if (rules.literal) result = apply(result, rules.literal, 'cb-keyword')
    if (rules.number) result = apply(result, rules.number, 'cb-number')

    return { html: result, colors }
  }

  render() {
    const lang = this.getLanguage()
    const showLineNumbers = this.hasAttribute('line-numbers')
    const theme = this.getAttribute('theme') || 'dark'
    const code = (this.textContent || '').trim()
    const { html, colors } = this.highlight(code, lang)

    const bg = theme === 'light' ? '#f7f7f7' : '#2d2d2d'
    const fg = theme === 'light' ? '#222' : '#e8e8e8'
    const gutter = theme === 'light' ? '#ddd' : '#444'
    const gutterText = theme === 'light' ? '#777' : '#bbb'

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          margin: 1em 0;
          font-family: 'Menlo', 'Courier New', monospace;
        }
        pre {
          background: ${bg};
          color: ${fg};
          padding: 1em;
          margin: 0;
          border-radius: 6px;
          overflow: auto;
          line-height: 1.5;
          font-size: 14px;
          position: relative;
          tab-size: 2;
          white-space: pre;
        }
        code {
          color: inherit;
          white-space: pre;
        }
        .line-numbers {
          padding-left: 3.2em;
        }
        .line-numbers .cb-gutter {
          position: absolute;
          top: 1em;
          left: 0;
          width: 2.6em;
          border-right: 1px solid ${gutter};
          color: ${gutterText};
          text-align: right;
          padding-right: 0.6em;
          font-size: 12px;
          line-height: 1.5;
          user-select: none;
        }
        .line-numbers .cb-gutter span {
          display: block;
        }
        .cb-comment { color: ${colors.comment}; }
        .cb-string { color: ${colors.string}; }
        .cb-keyword { color: ${colors.keyword}; font-weight: 500; }
        .cb-number { color: ${colors.number}; }
      </style>
      <pre class="${showLineNumbers ? 'line-numbers' : ''}">
        ${showLineNumbers ? this.renderLineNumbers(code) : ''}
        <code class="language-${lang}">${html}</code>
      </pre>
    `
  }

  renderLineNumbers(code) {
    const lines = code.split('\n').length || 1
    const spans = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('')
    return `<div class="cb-gutter" aria-hidden="true">${spans}</div>`
  }
}

customElements.define('code-block', CodeBlock)
