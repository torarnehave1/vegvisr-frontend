# Vegvisr.org Graph Node Templates

This document provides detailed descriptions of each node template available in the Vegvisr.org system. It is intended as a reference for developers and AI systems to generate, validate, or suggest nodes for knowledge graphs.

---

## Template Index

- GrokTest
- WorkNote
- BubbleChart
- FullText
- Image
- NotesNode
- TitleNode
- InfoNode
- MultiLineChart
- LineChart
- MapNode
- YouTube
- PortfolioImage
- QuadrantChart
- FlowChart

---

## Template Details

### GrokTest

- **Type:** action_test
- **Purpose:** Integrates external API calls (e.g., Grok, AI Q&A) and displays the result in the graph.
- **Fields:**
  - `id`: Unique node identifier
  - `label`: API endpoint or description
  - `type`: "action_test"
  - `info`: Prompt or question for the AI
  - `color`, `imageWidth`, `imageHeight`, `visible`
- **Example:**
  ```json
  {
    "id": "Node_Grok_Test",
    "label": "https://api.vegvisr.org/groktest",
    "type": "action_test",
    "info": "Tell me a bit about Garbha Gṛuha in the sense of womb chamber like the sanctum of a Hindu temple"
  }
  ```
- **AI Guidance:** Use for nodes that require dynamic answers or knowledge retrieval. The `info` field should contain a clear, concise prompt.

---

### WorkNote

- **Type:** worknote
- **Purpose:** Captures research notes, observations, or ongoing thoughts. Used for collaborative or in-progress annotations.
- **Fields:**
  - `id`, `label`, `type`: "worknote"
  - `info`: Note content (markdown supported)
  - `color`: Background color (e.g., `#FFD580`)
  - `bibl`: Bibliography or sources (array)
  - `imageWidth`, `imageHeight`, `visible`
- **Example:**
  ```json
  {
    "id": "worknote_12345",
    "label": "Work in progress Notes",
    "type": "worknote",
    "info": "Noted on May 13, 2025: ...",
    "color": "#FFD580"
  }
  ```
- **AI Guidance:** Use for summarizing findings, tracking open questions, or leaving comments for collaborators.

---

### BubbleChart

- **Type:** bubblechart
- **Purpose:** Visualizes multi-dimensional data using bubbles sized and colored by data attributes.
- **Fields:**
  - `id`, `label`, `type`: "bubblechart"
  - `info`: `{ data: [{ x, y, size, label, color }], xLabel, yLabel }`
  - `color`, `imageWidth`, `imageHeight`, `visible`
- **Example:**
  ```json
  {
    "id": "bubble1",
    "label": "Country IQ vs Income",
    "type": "bubblechart",
    "info": {
      "data": [
        { "x": 90, "y": 20000, "size": 50, "label": "Country A", "color": "#4a90e2" },
        { "x": 110, "y": 35000, "size": 80, "label": "Country B", "color": "#e94e77" }
      ],
      "xLabel": "IQ (low to high)",
      "yLabel": "Income (low to high)"
    }
  }
  ```
- **AI Guidance:** Use for comparative data with at least three variables (x, y, size). Provide clear axis labels.

---

### FullText

- **Type:** fulltext
- **Purpose:** Stores detailed articles, biographies, or long-form explanations. Supports markdown, sections, and work notes.
- **Fields:**
  - `id`, `label`, `type`: "fulltext"
  - `info`: Main content (markdown, can include custom blocks)
  - `bibl`: Bibliography (array)
  - `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "tilopa_full_biografi",
    "label": "Tilopa: En indisk Mahasiddha og tantrisk mester",
    "type": "fulltext",
    "info": "![Leftside-1|width: 200px; ...](https://vegvisr.imgix.net/tilopa01.jpg) ...",
    "bibl": ["Kilde: GROK – OpenAI Assistant, 2025-05-13"]
  }
  ```
- **AI Guidance:** Use for nodes that require rich, structured content. Support for sections, images, and citations is recommended.

---

### Image

- **Type:** markdown-image
- **Purpose:** Displays a single image with customizable size and layout.
- **Fields:**
  - `id`, `label`: Markdown image string (with style)
  - `type`: "markdown-image"
  - `info`: Optional description
  - `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "image_key",
    "label": "![Header|width:1536px;height:1024px;object-fit: cover;object-position: center](https://vegvisr.imgix.net/HEADERIMG.png)",
    "type": "markdown-image"
  }
  ```
- **AI Guidance:** Use for visual assets, headers, or illustrative content. The `label` should be a valid markdown image string.

---

### NotesNode

- **Type:** notes
- **Purpose:** Captures concise notes, insights, or key ideas. Supports bibliographic references.
- **Fields:**
  - `id`, `label`, `type`: "notes"
  - `info`: Note content (markdown)
  - `bibl`: Bibliography (array)
  - `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "c3988290-4c89-4f85-849d-fb0c6a04e5ak",
    "label": "New Notes Node",
    "type": "notes",
    "info": "Provide a concise note or insight ...",
    "bibl": ["[Author Last Name, First Initial. (Year). Title of the work. Publisher. DOI/URL]"]
  }
  ```
- **AI Guidance:** Use for short, focused content. Include sources if available.

---

### TitleNode

- **Type:** title
- **Purpose:** Provides a title or section heading within a graph.
- **Fields:**
  - `id`, `label`, `type`: "title"
  - `info`: Optional description
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "ae5bc67e-7638-4d40-83ba-3a72a8a45ab1",
    "label": "This is the title",
    "type": "title"
  }
  ```
- **AI Guidance:** Use for organizing graph content. Keep the label concise.

---

### InfoNode

- **Type:** text
- **Purpose:** Provides explanatory or contextual information, often with section formatting and references.
- **Fields:**
  - `id`, `label`, `type`: "text"
  - `info`: Main content (markdown)
  - `bibl`: Bibliography (array)
  - `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "tilopa_mahasiddha_fisk",
    "label": "Tilopa – Mahasiddhaen med Fisken",
    "type": "text",
    "info": "[SECTION | background-color:'#FFF5E5'; color:'#222'] ...",
    "bibl": ["https://en.wikipedia.org/wiki/Tilopa"]
  }
  ```
- **AI Guidance:** Use for background, definitions, or supporting details. Support for section formatting is recommended.

---

### MultiLineChart

- **Type:** linechart
- **Purpose:** Visualizes multiple data series as line charts for trend comparison.
- **Fields:**
  - `id`, `label`, `type`: "linechart"
  - `info`: `{ data: [{ label, color, points: [{ x, y }] }], xLabel, yLabel }`
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "linechart2",
    "label": "Multi-Series Line Chart",
    "type": "linechart",
    "info": {
      "data": [
        { "label": "Series A", "color": "#4a90e2", "points": [{ "x": 1, "y": 10 }, ...] },
        { "label": "Series B", "color": "#e94e77", "points": [{ "x": 1, "y": 7 }, ...] }
      ],
      "xLabel": "Time (s)",
      "yLabel": "Value"
    }
  }
  ```
- **AI Guidance:** Use for comparing trends across multiple series. Provide clear axis labels and color coding.

---

### LineChart

- **Type:** linechart
- **Purpose:** Visualizes a single data series as a line chart.
- **Fields:**
  - `id`, `label`, `type`: "linechart"
  - `info`: `{ data: [{ x, y }], xLabel, yLabel }`
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "linechart1",
    "label": "Sample Line Chart",
    "type": "linechart",
    "info": {
      "data": [
        { "x": 1, "y": 10 },
        { "x": 2, "y": 15 }
      ],
      "xLabel": "Time (s)",
      "yLabel": "Value"
    }
  }
  ```
- **AI Guidance:** Use for single-variable trend visualization. Keep data points and labels clear.

---

### MapNode

- **Type:** map
- **Purpose:** Displays geographic data, KML overlays, or highlights locations relevant to the graph's topic.
- **Fields:**
  - `id`, `label`, `type`: "map"
  - `info`: Description or context
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`: KML file or map resource
- **Example:**
  ```json
  {
    "id": "c3988290-4c89-4f85-849d-fb0c6a04e5ae",
    "label": "Ancient Sites of Anatolia and Beyond",
    "type": "map",
    "info": "This map highlights ancient sites ...",
    "path": "https://klm.vegvisr.org/Vegvisr.org.kml"
  }
  ```
- **AI Guidance:** Use for spatial context, mapping, or location-based insights. Include a valid KML or map resource if possible.

---

### YouTube

- **Type:** youtube-video
- **Purpose:** Embeds a YouTube video with a title and supporting information.
- **Fields:**
  - `id`, `label`: Markdown YouTube embed string
  - `type`: "youtube-video"
  - `info`: Description or context
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "youtube_jehga_fish_symbolism",
    "label": "![YOUTUBE src=https://www.youtube.com/embed/ofPm6u79Fh8]Ancient Secret Code Behind the "Jesus Fish"[END YOUTUBE]",
    "type": "youtube-video",
    "info": "[SECTION | background-color:'#FFF'; color:'#333'] ..."
  }
  ```
- **AI Guidance:** Use for multimedia integration. The `label` should be a valid YouTube embed markdown string.

---

### PortfolioImage

- **Type:** portfolio-image
- **Purpose:** Displays a portfolio image, typically for galleries or visual showcases.
- **Fields:**
  - `id`, `label`, `type`: "portfolio-image"
  - `info`: Optional description
  - `imageWidth`, `imageHeight`, `visible`, `path`: Image URL
- **Example:**
  ```json
  {
    "id": "portfolio-sample-1",
    "label": "My Portfolio Image",
    "type": "portfolio-image",
    "path": "https://vegvisr.imgix.net/tilopa01.jpg"
  }
  ```
- **AI Guidance:** Use for visual galleries or portfolios. The `path` should be a valid image URL.

---

### QuadrantChart

- **Type:** mermaid-diagram
- **Purpose:** Visualizes data across four quadrants (e.g., reach vs. engagement) using Mermaid syntax.
- **Fields:**
  - `id`, `label`, `type`: "mermaid-diagram"
  - `info`: Mermaid quadrant chart code
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "1e9a150a-bb67-47e6-8232-29bb9e62eefa3",
    "label": "Campaign Quadrant Chart",
    "type": "mermaid-diagram",
    "info": "quadrantChart\n    title Reach and engagement of campaigns\n    x-axis Low Reach --> High Reach\n    y-axis Low Engagement --> High Engagement\n    quadrant-1 We should expand\n    quadrant-2 Need to promote\n    quadrant-3 Re-evaluate\n    quadrant-4 May be improved\n    Campaign A: [0.3, 0.6] ..."
  }
  ```
- **AI Guidance:** Use for strategic analysis and campaign planning. The `info` field should be valid Mermaid quadrant chart code.

---

### FlowChart

- **Type:** mermaid-diagram
- **Purpose:** Embeds Mermaid-based flow diagrams for visualizing processes, system flows, or relationships.
- **Fields:**
  - `id`, `label`, `type`: "mermaid-diagram"
  - `info`: Mermaid flowchart code
  - `bibl`, `imageWidth`, `imageHeight`, `visible`, `path`
- **Example:**
  ```json
  {
    "id": "system-flow",
    "label": "System Flow Diagram",
    "type": "mermaid-diagram",
    "info": "graph TD\nA[Vegvisr.org System Flow] --> B[Feature: Personal Playground] ..."
  }
  ```
- **AI Guidance:** Use for process or relationship visualization. The `info` field should be valid Mermaid flowchart code.
