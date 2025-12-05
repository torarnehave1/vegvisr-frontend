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
    return (this.getAttribute('language') || 'javascript').toLowerCase()
  }

  escapeHtml(code) {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  highlight(code, lang, theme) {
    const escaped = this.escapeHtml(code)

    const patterns = {
      javascript: {
        comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g,
        string: /(["'`])(?:\\.|(?!\1)[^\\])*\1/g,
        keyword: /\b(await|async|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/g,
        type: /\b(Array|Object|String|Number|Boolean|RegExp|Date|Math|JSON|Promise|Error|console|window|document)\b/g,
        number: /\b(-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.\d+|\d+))\b/g,
        operator: /([+\-*/%=<>!&|^~?:;,.(){}[\]])/g
      },
      json: {
        string: /(["'])(?:\\.|(?!\1)[^\\])*\1/g,
        number: /\b(-?(0x[\dA-Fa-f]+|\d*\.\d+|\d+))\b/g,
        literal: /\b(true|false|null)\b/g,
        operator: /([,:{}[\]])/g
      },
      sql: {
        comment: /(\/\*[^]*?\*\/|--[^\n]*)/g,
        string: /('(?:''|[^'])*')/g,
        keyword: /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|OFFSET|AS)\b/gi,
        number: /\b(-?\d*\.\d+|-?\d+)\b/g,
        operator: /([+\-*/%=<>!&|^~?:;,.(){}[\]])/g
      },
      bash: {
        comment: /(#[^\n]*)/g,
        string: /(["'])(?:\\.|(?!\1)[^\\])*\1/g,
        keyword: /\b(if|then|else|elif|fi|for|in|do|done|while|case|esac|function)\b/g,
        number: /\b(-?\d*\.\d+|-?\d+)\b/g,
        operator: /([+\-*/%=<>!&|^~?:;,.(){}[\]])/g
      },
      html: {
        comment: /(<!--[\s\S]*?-->)/g,
        tag: /<\/?[a-zA-Z][^>]*>/g,
        attribute: /\b([a-zA-Z-]+)(?=\s*=)/g,
        string: /(["'])(?:\\.|(?!\1)[^\\])*\1/g
      },
      css: {
        comment: /(\/\*[^]*?\*\/)/g,
        property: /\b([a-zA-Z-]+)(?=\s*:)/g,
        string: /(["'])(?:\\.|(?!\1)[^\\])*\1/g,
        number: /\b(-?\d*\.\d+|-?\d+)(?:px|em|rem|%|vh|vw|pt)?\b/g,
        operator: /([{};:,])/g
      }
    }

    const darkColors = {
      comment: '#6a9955',
      string: '#ce9178',
      keyword: '#569cd6',
      type: '#4ec9b0',
      number: '#b5cea8',
      literal: '#569cd6',
      operator: '#d4d4d4',
      tag: '#569cd6',
      attribute: '#9cdcfe',
      property: '#9cdcfe'
    }

    const lightColors = {
      comment: '#008000',
      string: '#a31515',
      keyword: '#0000ff',
      type: '#267f99',
      number: '#098658',
      literal: '#0000ff',
      operator: '#000000',
      tag: '#800000',
      attribute: '#ff0000',
      property: '#ff0000'
    }

    const colors = theme === 'light' ? lightColors : darkColors

    const apply = (text, regex, cls) => text.replace(regex, match => `<span class="${cls}">${match}</span>`)

    let result = escaped
    const rules = patterns[lang] || patterns.javascript
    if (rules.comment) result = apply(result, rules.comment, 'cb-comment')
    if (rules.string) result = apply(result, rules.string, 'cb-string')
    if (rules.keyword) result = apply(result, rules.keyword, 'cb-keyword')
    if (rules.type) result = apply(result, rules.type, 'cb-type')
    if (rules.number) result = apply(result, rules.number, 'cb-number')
    if (rules.literal) result = apply(result, rules.literal, 'cb-literal')
    if (rules.tag) result = apply(result, rules.tag, 'cb-tag')
    if (rules.attribute) result = apply(result, rules.attribute, 'cb-attribute')
    if (rules.property) result = apply(result, rules.property, 'cb-property')
    if (rules.operator) result = apply(result, rules.operator, 'cb-operator')

    return { html: result, colors }
  }

  render() {
    const lang = this.getLanguage()
    const showLineNumbers = this.hasAttribute('line-numbers')
    const theme = this.getAttribute('theme') || 'dark'
    const code = (this.textContent || '').trim()
    const { html, colors } = this.highlight(code, lang, theme)

    const bg = theme === 'light' ? '#f7f7f7' : '#1e1e1e'
    const fg = theme === 'light' ? '#000000' : '#d4d4d4'
    const gutter = theme === 'light' ? '#e5e5e5' : '#3e3e3e'
    const gutterText = theme === 'light' ? '#237893' : '#858585'

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
          display: flex;
          align-items: flex-start;
          gap: 0.8em;
        }
        code {
          color: inherit;
          white-space: pre;
          display: block;
        }
        .line-numbers {
          padding-left: 0;
        }
        .line-numbers .cb-gutter {
          position: sticky;
          top: 0;
          left: 0;
          width: 2.6em;
          border-right: 1px solid ${gutter};
          color: ${gutterText};
          text-align: right;
          padding-right: 0.6em;
          font-size: 12px;
          line-height: 1.5;
          user-select: none;
          flex-shrink: 0;
        }
        .line-numbers .cb-gutter span {
          display: block;
        }
        .cb-comment { color: ${colors.comment}; }
        .cb-string { color: ${colors.string}; }
        .cb-keyword { color: ${colors.keyword}; }
        .cb-type { color: ${colors.type}; }
        .cb-number { color: ${colors.number}; }
        .cb-literal { color: ${colors.literal}; }
        .cb-operator { color: ${colors.operator}; }
        .cb-tag { color: ${colors.tag}; }
        .cb-attribute { color: ${colors.attribute}; }
        .cb-property { color: ${colors.property}; }
      </style>
      <pre class="${showLineNumbers ? 'line-numbers' : ''}">
        ${showLineNumbers ? this.renderLineNumbers(code) : ''}
        <code class="language-${lang}"></code>
      </pre>
    `

    const codeEl = this.shadowRoot.querySelector('code')
    if (codeEl) {
      codeEl.innerHTML = html
    }
  }

  renderLineNumbers(code) {
    const lines = code.split('\n').length || 1
    const spans = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('')
    return `<div class="cb-gutter" aria-hidden="true">${spans}</div>`
  }
}

customElements.define('code-block', CodeBlock)
