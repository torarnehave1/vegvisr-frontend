/**
 * Sample Slideshow Node for Vegvisr Knowledge Graph
 * This script creates sample fulltext nodes with slideshow content that can be tested
 * in the Vegvisr platform. Use this to add slideshow-enabled nodes to your graphs.
 */

// Sample slideshow node based on Nibi Institute presentation
const nibiSlideshowNode = {
  id: 'nibi-slideshow-demo',
  label: 'Nibi Institute - Knowledge Graph Presentation',
  type: 'fulltext',
  color: '#4A90E2',
  info: `# Nibi Institute: Advancing Indigenous Knowledge

This presentation demonstrates the integration of traditional Indigenous knowledge with modern knowledge graph technology.

[SLIDE_META theme="nibi" title="Nibi Institute: Knowledge Systems" subtitle="Bridging Traditional Wisdom and Modern Technology"]

[SLIDE title="Welcome to Nibi Institute"]
## Our Mission
**Nibi Institute** is dedicated to preserving and advancing **Indigenous knowledge systems** through innovative technology.

### Core Values
- **Respect** for traditional wisdom
- **Innovation** in knowledge preservation
- **Community** collaboration
- **Cultural** authenticity

*Nibi means "water" in Anishinaabemowin - the foundation of all life*

[SLIDE title="Knowledge Graph Foundations"]
## What are Knowledge Graphs?

Knowledge graphs are **structured representations** of knowledge that:
- Connect entities through meaningful relationships
- Preserve semantic context and cultural meaning
- Enable complex reasoning and discovery
- Support both traditional and digital knowledge systems

### Key Components
- **Entities**: People, places, concepts, stories
- **Relationships**: How knowledge connects
- **Context**: Cultural and temporal significance

[SLIDE title="Indigenous Knowledge Systems"]
## Traditional Knowledge Architecture

Indigenous knowledge systems have always been **interconnected networks**:

### Oral Traditions
- Stories that encode ecological knowledge
- Genealogies connecting people and places
- Teachings embedded in ceremony and practice

### Land-Based Knowledge
- Seasonal cycles and ecological relationships
- Traditional place names and their meanings
- Sustainable resource management practices

### Community Networks
- Elder-to-youth knowledge transmission
- Inter-tribal knowledge sharing
- Contemporary Indigenous scholarship

[SLIDE title="Digital Preservation Challenges"]
## Protecting Sacred Knowledge

### Cultural Protocols
- **Consent**: Who can access what knowledge?
- **Attribution**: Proper crediting of knowledge holders
- **Context**: Maintaining cultural significance
- **Sovereignty**: Indigenous control over their data

### Technical Solutions
- Granular permission systems
- Cultural metadata frameworks
- Community-controlled databases
- Ethical AI governance

*Technology must serve Indigenous communities, not extract from them*

[SLIDE title="Vegvisr Platform Integration"]
## Knowledge Graph Tools for Indigenous Communities

**Vegvisr** provides culturally-responsive tools:

### Community Features
1. **Collaborative graph building** with cultural protocols
2. **Multi-language support** for Indigenous languages
3. **Rich media integration** for oral traditions
4. **Access controls** respecting cultural boundaries

### Educational Applications
- Language learning networks
- Traditional ecological knowledge mapping
- Cultural curriculum development
- Intergenerational knowledge transfer

[SLIDE title="Case Study: Water Knowledge"]
## Nibi (Water) Knowledge Network

### Traditional Knowledge
- Sacred sites and water ceremonies
- Seasonal fishing and harvesting practices
- Traditional water quality indicators
- Stories and teachings about water spirits

### Scientific Knowledge
- Watershed mapping and hydrology
- Water quality monitoring data
- Climate change impacts
- Conservation strategies

### Integrated Approach
**Bringing together** traditional and scientific knowledge for **comprehensive water stewardship**

[SLIDE title="Community Impact"]
## Real-World Applications

### Language Revitalization
- Connecting words to cultural concepts
- Mapping linguistic relationships
- Supporting immersion programs

### Land Rights Documentation
- Traditional place names and boundaries
- Historical occupation evidence
- Sacred site protection

### Cultural Education
- Interactive learning experiences
- Connecting youth with elders
- Preserving knowledge for future generations

[SLIDE title="Technical Architecture"]
## Building Ethical Knowledge Systems

### Data Sovereignty Principles
- **Indigenous ownership** of Indigenous data
- **Community consent** for all data use
- **Beneficial sharing** that serves communities
- **Cultural protocols** embedded in technology

### Platform Features
- Federated knowledge networks
- Blockchain-based provenance tracking
- AI systems trained on consent-based datasets
- Cultural consultation workflows

[SLIDE title="Future Directions"]
## Expanding Indigenous Knowledge Networks

### Research Partnerships
- Universities and Indigenous communities
- Traditional knowledge and academic research
- Ethical protocols for knowledge sharing

### Technology Development
- Indigenous-led AI research
- Culturally-responsive user interfaces
- Traditional knowledge ontologies

### Global Networks
- International Indigenous knowledge sharing
- Cultural preservation initiatives
- Climate change adaptation strategies

### Community Capacity
- Training Indigenous knowledge keepers
- Supporting tribal data governance
- Building technological sovereignty

[SLIDE title="Join Our Network"]
## Get Involved with Nibi Institute

### For Communities
- **Workshops** on digital knowledge preservation
- **Consultation** on cultural data protocols
- **Training** for community members

### For Researchers
- **Ethical partnerships** with Indigenous communities
- **Collaborative research** opportunities
- **Cultural competency** development

### For Technologists
- **Open source** tools development
- **Cultural protocols** implementation
- **Community-centered** design

### Contact Information
- **Website**: nibi-institute.org
- **Email**: knowledge@nibi-institute.org
- **Community Forums**: Indigenous Knowledge Network

*Miigwech (Thank you) for supporting Indigenous knowledge systems*

[SLIDE title="Questions & Discussion"]
## Continuing the Conversation

### Reflection Questions
- How can technology better serve Indigenous communities?
- What role does traditional knowledge play in addressing modern challenges?
- How do we balance sharing and protecting sacred knowledge?

### Resources
- **Nibi Institute Knowledge Portal**
- **Indigenous Data Sovereignty Research**
- **Traditional Ecological Knowledge Networks**
- **Cultural Protocol Guidelines**

### Next Steps
- Explore Vegvisr platform capabilities
- Connect with Indigenous knowledge networks
- Support community-led initiatives

**The future of knowledge is Indigenous**`,
  bibl: 'Sample slideshow content for Vegvisr Knowledge Graph platform',
  visible: true,
  path: 'nibi-institute/presentations/knowledge-graphs',
}

// Additional sample slideshow - Technical overview
const technicalSlideshowNode = {
  id: 'vegvisr-technical-overview',
  label: 'Vegvisr Platform - Technical Overview',
  type: 'fulltext',
  color: '#2E8B57',
  info: `# Vegvisr Platform Technical Overview

A comprehensive look at the technical architecture and capabilities of the Vegvisr knowledge graph platform.

[SLIDE_META theme="academic" title="Vegvisr Platform Architecture" subtitle="Technical Deep Dive"]

[SLIDE title="Platform Overview"]
## Vegvisr Knowledge Graph Platform

### Core Technologies
- **Frontend**: Vue.js with Cytoscape.js visualization
- **Backend**: Cloudflare Workers with D1 database
- **Storage**: Distributed graph data with metadata
- **API**: RESTful endpoints for graph operations

### Key Features
- Real-time collaborative editing
- Rich content nodes with markdown support
- Visual graph exploration and manipulation
- Template system for rapid graph creation
- Version control and history tracking

[SLIDE title="Database Architecture"]
## Data Storage and Schema

### Primary Tables
- **graphs**: Main graph storage with nodes/edges JSON
- **graphTemplates**: Reusable graph patterns
- **graphWorkNotes**: Collaborative annotations
- **graphHistory**: Version control and tracking

### Node Types
- **fulltext**: Rich markdown content with special blocks
- **notes**: Simple text notes and observations
- **worknote**: Collaborative workspace notes
- **bubblechart**: Quantitative data visualizations
- **markdown-image**: Image nodes with metadata

[SLIDE title="Content Processing"]
## Rich Markdown System

### Special Blocks
- **[SECTION]**: Styled content sections
- **[QUOTE]**: Highlighted quotations
- **[FANCY]**: Enhanced visual styling
- **[WNOTE]**: Work notes integration
- **[SLIDE]**: Slideshow content (new!)

### Media Support
- Embedded images with sizing controls
- YouTube video integration
- External link management
- File attachments and references

[SLIDE title="API Endpoints"]
## Core Platform APIs

### Graph Operations
- **GET /getknowgraph**: Retrieve graph data
- **POST /saveknowgraph**: Save graph changes
- **POST /updateknowgraph**: Update specific elements
- **GET /getknowgraphs**: List user graphs

### Template System
- **GET /getTemplates**: Retrieve available templates
- **POST /addTemplate**: Create new templates

### New Slideshow Features
- **GET /slideshow**: Generate HTML slideshow from node
- Support for theme-based styling
- Keyboard navigation and controls

[SLIDE title="Frontend Architecture"]
## Vue.js Application Structure

### Core Components
- **GraphViewer**: Main graph visualization
- **NodeEditor**: Rich content editing interface
- **TemplateSelector**: Template browsing and selection
- **CollaborationPanel**: Real-time collaboration tools

### Cytoscape.js Integration
- Interactive node and edge manipulation
- Dynamic layout algorithms
- Custom styling and theming
- Event handling for user interactions

[SLIDE title="Slideshow System"]
## New Presentation Capabilities

### Content Format
- **[SLIDE_META]**: Presentation metadata and theming
- **[SLIDE title="..."]**: Individual slide definitions
- Markdown content with full formatting support
- Integration with existing special blocks

### Themes
- **Nibi**: Indigenous knowledge focus
- **Academic**: Research presentation style
- **Business**: Corporate communication design
- **Custom**: User-defined styling

### Controls
- Keyboard navigation (arrow keys, spacebar)
- Mouse/touch controls
- Fullscreen presentation mode
- Progress indicators

[SLIDE title="Thank You"]
## Questions & Discussion

### Resources
- **Platform Documentation**: docs.vegvisr.org
- **API Reference**: api.vegvisr.org
- **Community Forum**: community.vegvisr.org
- **Source Code**: github.com/vegvisr

### Contact
- **Technical Support**: tech@vegvisr.org
- **Community**: Join our Slack workspace
- **Contributions**: Welcome on GitHub

*Built with ❤️ for the knowledge graph community*`,
  bibl: 'Technical documentation for Vegvisr platform capabilities',
  visible: true,
  path: 'vegvisr/documentation/technical-overview',
}

console.log('=== Sample Slideshow Nodes for Vegvisr ===')
console.log('\n1. Nibi Institute Presentation')
console.log(`Node ID: ${nibiSlideshowNode.id}`)
console.log(`Label: ${nibiSlideshowNode.label}`)
console.log(`Content length: ${nibiSlideshowNode.info.length} characters`)

console.log('\n2. Technical Overview Presentation')
console.log(`Node ID: ${technicalSlideshowNode.id}`)
console.log(`Label: ${technicalSlideshowNode.label}`)
console.log(`Content length: ${technicalSlideshowNode.info.length} characters`)

// Export nodes for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    nibiSlideshowNode,
    technicalSlideshowNode,
  }
}

console.log('\n=== Integration Instructions ===')
console.log('1. Add these nodes to your Vegvisr graph using the graph editor')
console.log('2. Test slideshow generation with URLs like:')
console.log(
  '   https://knowledge.vegvisr.org/slideshow?graphId=YOUR_GRAPH&nodeId=nibi-slideshow-demo&theme=nibi',
)
console.log('3. Experiment with different themes: nibi, academic, business')
console.log('4. Use as templates for creating your own slideshow content')

console.log('\n✅ Sample slideshow nodes ready for Vegvisr platform!')
