<template>
  <section class="frontpage">
    <div class="hero">
      <h1>Turn Your Knowledge Into Beautiful, Shareable Graphs Instantly</h1>
      <p class="subheadline">
        Create, visualize, and publish knowledge graphs with AI-powered formatting and one-click web
        publishing.
      </p>
      <div class="cta-buttons">
        <router-link to="/graph-admin" class="cta primary">Start a New Graph</router-link>
        <router-link to="/graph-canvas" class="cta canvas">🎨 Graph Canvas</router-link>
        <router-link to="/graph-portfolio" class="cta secondary">See Example Graphs</router-link>
      </div>
    </div>

    <section class="features">
      <h2>Why Vegvisr?</h2>
      <ul>
        <li>
          <strong>AI-Enhanced Formatting:</strong> Instantly transform your notes into stunning,
          professional graphs.
        </li>
        <li>
          <strong>One-Click Web Publishing:</strong> Share your knowledge as a beautiful website—no
          coding required.
        </li>
        <li>
          <strong>Custom Branding & Themes:</strong> Make it yours with logos, colors, and custom
          domains.
        </li>
        <li><strong>Export & Share:</strong> Download, print, or embed your graphs anywhere.</li>
      </ul>
    </section>

    <section class="use-cases">
      <h2>Who Uses Vegvisr?</h2>
      <ul>
        <li><strong>Educators:</strong> Visualize complex topics for students.</li>
        <li><strong>Researchers:</strong> Organize and share findings.</li>
        <li><strong>Teams:</strong> Collaborate on knowledge and insights.</li>
      </ul>
    </section>

    <section class="testimonials">
      <h2>What Our Users Say</h2>
      <blockquote>
        "Vegvisr made it so easy to turn my research into a shareable website!"
        <footer>— Dr. Jane Smith, University of Oslo</footer>
      </blockquote>
      <blockquote>
        "The AI formatting is a game changer for my teaching materials."
        <footer>— Prof. Lars Nilsen, NTNU</footer>
      </blockquote>
    </section>

    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item">
        <strong>What is Vegvisr?</strong>
        <p>
          Vegvisr is a platform that lets you create, visualize, and publish knowledge graphs with
          professional design and AI-powered enhancements.
        </p>
      </div>
      <div class="faq-item">
        <strong>Is it free to use?</strong>
        <p>
          Yes! Get started for free. Upgrade for custom branding, more graphs, and advanced
          features.
        </p>
      </div>
      <div class="faq-item">
        <strong>How do I publish my graph?</strong>
        <p>With one click, you can publish your graph as a beautiful, shareable web page.</p>
      </div>
      <div class="faq-item">
        <strong>Can I use my own branding?</strong>
        <p>Yes, paid plans let you add your logo, colors, and even use your own domain.</p>
      </div>
    </section>

    <div class="cta-footer">
      <router-link to="/register" class="cta primary">Get Started Free</router-link>
      <router-link to="/contact" class="cta secondary">Contact Support</router-link>
    </div>

    <footer class="trusted">
      <em>Trusted by educators, researchers, and creators worldwide.</em>
    </footer>
  </section>
</template>

<script>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBranding } from '@/composables/useBranding'

export default {
  name: 'FrontPage',
  setup() {
    const router = useRouter()
    const { currentFrontPage, isCustomDomain } = useBranding()

    onMounted(async () => {
      // Wait a bit for branding initialization
      setTimeout(() => {
        const frontPagePath = currentFrontPage.value
        console.log('FrontPage: Checking for custom front page:', frontPagePath)
        console.log('FrontPage: Is custom domain:', isCustomDomain.value)

        if (isCustomDomain.value && frontPagePath && frontPagePath !== '/') {
          console.log('FrontPage: Redirecting to custom front page:', frontPagePath)

          // Handle different front page formats
          if (frontPagePath.includes('graphId')) {
            // It's already a full path like /graph-viewer?graphId=...
            router.push(frontPagePath)
          } else if (!frontPagePath.startsWith('/') && !frontPagePath.includes('?')) {
            // It's just a graph ID, convert to full path
            const fullPath = `/graph-viewer?graphId=${frontPagePath}&template=Frontpage`
            console.log('FrontPage: Normalized path:', fullPath)
            router.push(fullPath)
          } else {
            // Use as-is
            router.push(frontPagePath)
          }
        } else {
          console.log('FrontPage: Using default front page (no custom domain or front page)')
        }
      }, 1000) // Give time for branding initialization
    })

    return {}
  },
}
</script>

<style scoped>
.frontpage {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem 1rem;
  font-family: 'Inter', Arial, sans-serif;
  color: #2c3e50;
}
.hero {
  text-align: center;
  margin-bottom: 2.5rem;
}
.hero h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
.subheadline {
  font-size: 1.25rem;
  color: #6b4c6b;
  margin-bottom: 1.5rem;
}
.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.cta {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition:
    background 0.2s,
    color 0.2s;
}
.cta.primary {
  background: #8b5a8c;
  color: #fff;
}
.cta.primary:hover {
  background: #6b4c6b;
}
.cta.secondary {
  background: #f0e8f0;
  color: #8b5a8c;
  border: 1px solid #8b5a8c;
}
.cta.secondary:hover {
  background: #e8d8e8;
}
.cta.canvas {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
.cta.canvas:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
}
.features,
.use-cases,
.testimonials,
.faq {
  margin-bottom: 2rem;
}
.features ul,
.use-cases ul {
  list-style: none;
  padding: 0;
}
.features li,
.use-cases li {
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
}
.testimonials blockquote {
  background: #f8f5f8;
  border-left: 4px solid #8b5a8c;
  margin: 1rem 0;
  padding: 1rem 1.5rem;
  font-style: italic;
  color: #6b4c6b;
  border-radius: 6px;
}
.testimonials footer {
  font-size: 0.95rem;
  color: #8b5a8c;
  margin-top: 0.5rem;
}
.faq-item {
  margin-bottom: 1.25rem;
}
.faq-item strong {
  display: block;
  margin-bottom: 0.25rem;
  color: #8b5a8c;
}
.cta-footer {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
}
.trusted {
  text-align: center;
  color: #6b4c6b;
  font-size: 1.1rem;
  margin-top: 2rem;
}
</style>
