# Vegvisr Slideshow System Documentation

## Overview

The Vegvisr Knowledge Graph platform now includes a powerful slideshow system that allows users to create interactive presentations directly from fulltext nodes. This system extends the existing rich markdown capabilities with presentation-specific features.

## Features

### Core Capabilities

- **Interactive Slideshows**: Convert fulltext nodes into full-screen presentations
- **Theme Support**: Multiple visual themes (Nibi, Academic, Business)
- **Keyboard Navigation**: Arrow keys and spacebar for slide control
- **Rich Content**: Full markdown support with Vegvisr special blocks
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Direct Integration**: Seamless connection with existing knowledge graphs

### Technical Implementation

- **Backend**: Cloudflare Workers with slideshow parsing and HTML generation
- **Frontend**: JavaScript-based presentation engine with smooth transitions
- **Content Processing**: Extends existing Vegvisr markdown processing pipeline
- **URL-based Access**: Direct links to slideshow presentations

## Content Format

### Slideshow Metadata

Use the `[SLIDE_META]` block to define presentation settings:

```markdown
[SLIDE_META theme="nibi" title="My Presentation" subtitle="Exploring Knowledge Graphs"]
```

**Supported Attributes:**

- `theme`: Visual theme (`nibi`, `academic`, `business`)
- `title`: Presentation title (overrides node label)
- `subtitle`: Optional subtitle text

### Individual Slides

Define slides using the `[SLIDE]` block:

```markdown
[SLIDE title="Welcome"]

# Introduction to Knowledge Graphs

This slide introduces the basic concepts...

## Key Points

- Networks of connected information
- Semantic relationships
- Machine-readable knowledge

[SLIDE title="Core Components"]
Knowledge graphs consist of:

### Entities (Nodes)

- People, places, concepts
- Unique identifiers
- Rich metadata

### Relationships (Edges)

- Typed connections
- Directional or bidirectional
- Weighted relationships
```

## Visual Themes

### Nibi Theme (`theme="nibi"`)

- **Focus**: Indigenous knowledge and cultural sensitivity
- **Colors**: Earth tones with blue accents
- **Typography**: Clean, accessible fonts
- **Style**: Respectful, community-centered design

### Academic Theme (`theme="academic"`)

- **Focus**: Research presentations and scholarly content
- **Colors**: Professional blues and grays
- **Typography**: Serif fonts for readability
- **Style**: Classic academic presentation format

### Business Theme (`theme="business"`)

- **Focus**: Corporate communications and professional presentations
- **Colors**: Modern corporate palette
- **Typography**: Sans-serif fonts for clarity
- **Style**: Clean, professional design

## Usage Instructions

### Creating Slideshow Content

1. **Create or Edit a Fulltext Node**

   - Use the Vegvisr graph editor
   - Select "fulltext" as the node type
   - Add your slideshow content using the format above

2. **Add Metadata Block**

   ```markdown
   [SLIDE_META theme="nibi" title="Your Presentation Title"]
   ```

3. **Create Slides**

   ```markdown
   [SLIDE title="Slide 1 Title"]
   Your slide content here...

   [SLIDE title="Slide 2 Title"]
   More content...
   ```

4. **Save the Node**
   - The slideshow will be automatically available

### Viewing Slideshows

#### Direct URL Access

Navigate to the slideshow using this URL format:

```
https://knowledge.vegvisr.org/slideshow?graphId=YOUR_GRAPH_ID&nodeId=YOUR_NODE_ID&theme=THEME_NAME
```

**Parameters:**

- `graphId`: The ID of your knowledge graph
- `nodeId`: The ID of the fulltext node containing slideshow content
- `theme`: Optional theme override (`nibi`, `academic`, `business`)

#### From Graph Viewer

- Click on a fulltext node with slideshow content
- Look for the "Show as Slideshow" button in the node details
- Click to open the slideshow in a new window

### Navigation Controls

#### Keyboard Navigation

- **Arrow Right** or **Spacebar**: Next slide
- **Arrow Left**: Previous slide
- **Escape**: Exit fullscreen (if supported)

#### Mouse/Touch Controls

- **Click "Next"/"Previous" buttons**: Navigate slides
- **Touch/swipe**: On mobile devices (if enabled)

## Content Integration

### Markdown Support

All standard markdown formatting is supported:

- **Bold** and _italic_ text
- Headers (H1-H6)
- Lists (ordered and unordered)
- Links and images
- Code blocks and inline code

### Vegvisr Special Blocks

Existing special blocks work within slides:

```markdown
[SLIDE title="Special Content"]
[SECTION]
This content will be styled as a special section
[END SECTION]

[QUOTE]
"Knowledge graphs represent a fundamental shift in how we organize information"
[END QUOTE]

[FANCY]
This will be displayed with enhanced visual styling
[END FANCY]
```

### Image Integration

Include images using standard markdown or Vegvisr image syntax:

```markdown
[SLIDE title="Visual Content"]
![Alt text](image-url.jpg)

Or with Vegvisr sizing:
![Alt text|width:400](image-url.jpg)
```

## API Reference

### Slideshow Endpoint

**GET** `/slideshow`

**Parameters:**

- `graphId` (required): Knowledge graph identifier
- `nodeId` (required): Fulltext node identifier
- `theme` (optional): Theme override

**Response:** HTML slideshow page

**Example:**

```
GET /slideshow?graphId=abc123&nodeId=xyz789&theme=academic
```

### Integration Functions

#### Backend (dev-worker/index.js)

- `parseSlideshowFromFulltext(content)`: Parses slideshow from markdown
- `generateSlideshowHtml(slideshowData, theme, title)`: Generates HTML

#### Data Structure

```javascript
{
  metadata: {
    theme: "nibi",
    title: "Presentation Title",
    subtitle: "Optional Subtitle"
  },
  slides: [
    {
      title: "Slide Title",
      content: "Processed markdown content"
    }
  ]
}
```

## Best Practices

### Content Organization

1. **Start with Overview**: First slide should introduce the topic
2. **Logical Flow**: Arrange slides in a logical progression
3. **Consistent Structure**: Use similar slide formats throughout
4. **Clear Titles**: Each slide should have a descriptive title
5. **Concise Content**: Keep slide content focused and readable

### Cultural Sensitivity (Nibi Theme)

1. **Respect Protocols**: Follow Indigenous data sovereignty principles
2. **Proper Attribution**: Credit knowledge holders appropriately
3. **Cultural Context**: Maintain cultural significance in content
4. **Community Consent**: Ensure appropriate permissions for shared knowledge

### Technical Considerations

1. **Content Length**: Keep slides readable - avoid information overload
2. **Image Optimization**: Use appropriately sized images for web delivery
3. **Link Testing**: Verify all external links work correctly
4. **Browser Compatibility**: Test across different browsers and devices

## Troubleshooting

### Common Issues

#### "No slideshow content found"

- Ensure you have `[SLIDE]` blocks in your fulltext node
- Check that slide blocks are properly formatted
- Verify the node type is "fulltext"

#### Missing slide titles

- Add `title="Your Title"` to each `[SLIDE]` block
- Check for proper quote formatting

#### Theme not applying

- Verify theme name is correct (`nibi`, `academic`, `business`)
- Check URL parameter formatting
- Ensure theme is specified in `[SLIDE_META]` or URL

#### Navigation not working

- Clear browser cache and reload
- Check JavaScript console for errors
- Verify slideshow loaded completely

### Error Messages

- **"Graph not found"**: Check graphId parameter
- **"Node not found"**: Verify nodeId exists in the graph
- **"Node is not a fulltext node"**: Ensure node type is "fulltext"
- **"Server error"**: Check network connection and try again

## Examples

### Simple Slideshow

```markdown
[SLIDE_META theme="academic" title="Introduction to Knowledge Graphs"]

[SLIDE title="What are Knowledge Graphs?"]
Knowledge graphs are structured representations of knowledge that connect entities through relationships.

Key benefits:

- Semantic understanding
- Complex reasoning
- Data integration

[SLIDE title="Applications"]
Common uses include:

- Search enhancement
- Recommendation systems
- Scientific research
- Business intelligence

[SLIDE title="Thank You"]
Questions and discussion
```

### Advanced Slideshow

```markdown
[SLIDE_META theme="nibi" title="Traditional Ecological Knowledge" subtitle="Indigenous Wisdom in Modern Context"]

[SLIDE title="Welcome"]
[SECTION]
Exploring the intersection of traditional knowledge and contemporary science
[END SECTION]

Traditional Ecological Knowledge (TEK) represents thousands of years of accumulated wisdom about environmental relationships.

[SLIDE title="Core Principles"]
[FANCY]
TEK is based on:

- Direct observation of natural phenomena
- Multigenerational knowledge transmission
- Holistic understanding of ecosystems
- Cultural and spiritual connections to land
  [END FANCY]

[SLIDE title="Modern Applications"]
Today, TEK contributes to:

### Climate Science

- Long-term environmental observations
- Species behavior patterns
- Seasonal variation understanding

### Conservation

- Sustainable resource management
- Biodiversity protection strategies
- Ecosystem restoration practices

[SLIDE title="Integration Challenges"]
[QUOTE]
"The challenge is not choosing between traditional and scientific knowledge, but finding ways to bring them together respectfully and effectively."
[END QUOTE]

Key considerations:

- Cultural protocols and sovereignty
- Knowledge attribution and consent
- Maintaining cultural context
- Collaborative research approaches
```

## Support and Contributing

### Getting Help

- **Documentation**: Visit docs.vegvisr.org
- **Community Forum**: community.vegvisr.org
- **Technical Support**: tech@vegvisr.org

### Contributing

- **Source Code**: github.com/vegvisr
- **Feature Requests**: Use GitHub issues
- **Bug Reports**: Include detailed reproduction steps
- **Documentation**: Help improve these docs

### Roadmap

Planned future features:

- Additional visual themes
- Animation and transition effects
- Audio narration support
- Collaborative presentation editing
- Export to PDF/PowerPoint
- Presenter notes and timing
- Interactive slide elements

---

_The Vegvisr slideshow system is designed to enhance knowledge sharing while respecting cultural protocols and community values._
