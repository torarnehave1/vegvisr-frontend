Instructions for Generating Knowledge Graph JSON with Interaction MethodsThese instructions guide the creation and modification of JSON for a knowledge graph compatible with the Vegvisr Knowledge Graph System, supporting creation, presentation, and action. The JSON must work with GraphAdmin.vue, GraphViewer.vue, and knowledgeGraphStore.js. Features include a layout field (landing, blog, academic, portfolio), visible field, theme-based image naming, and multiple interaction methods for user requests.
JSON Structure Overview
The JSON includes a layout field and two arrays: nodes and edges.
Top-Level Fields

layout: String specifying presentation style ("landing", "blog", "academic", "portfolio", or null). Optional; defaults to "blog". Overridable via UI/query parameter.

Nodes
Each node includes:

id: Unique string (e.g., "Magha_Center"). Required.
label: Description or image path (e.g., "/images/Magha_Map.png"). Required.
color: Color (hex, CSS name, or null). Required.
type: Node type (fulltext, notes, info, quote, quote-line, background, REG, or null). Optional; defaults to null.
info: Content (e.g., Markdown) or null. Optional; defaults to null.
bibl: Reference array (e.g., URLs). Empty array ([]) if none. Required. All references must be formatted in APA style. Personal research notes can be included, e.g., Håve, T. A. (2025). Vegvisr.org Research Notes. Vegvisr.org.
imageWidth: Image width (e.g., "750", "auto", or null). Optional; defaults to null.
imageHeight: Image height (e.g., "500", "auto", or null). Optional; defaults to null.
visible: Boolean for visibility (true or false). Optional; defaults to true.

Node Constraints

Unique ids.
background: Image path in label; set imageWidth/imageHeight.
REG: Resource path in label; info describes component.
fulltext/info: Detailed Markdown (100-300 words for info, longer for fulltext).
notes: Concise Markdown (50-150 words).
quote: Short quote.
quote-line: info typically null.
visible: false for drafts; true for public.

Edges
Each edge includes:

id: Unique string constructed by combining source and target node IDs (e.g., "Magha_Center_to_Magha_Map"). Required.
source: Source node id. Required.
target: Target node id. Required.

Edge Constraints

source and target must match existing node ids.
id must be unique and derived from source and target (e.g., [source]to[target]).
No additional fields (e.g., label, type, info) are included.

Layout Types

landing: Action-focused; prioritizes background, REG, title; vibrant colors.
blog: Narrative; vertical flow of fulltext, notes, quote; readable fonts.
academic: Scholarly; structured info/fulltext, formatted bibl, muted colors.
portfolio: Showcase; grid/masonry of background, title, notes, quote, REG; visual emphasis.

Image Naming and Path Conventions
Naming

Theme-Based Prefix: E.g., Magha*, Trigram*.
Descriptive Suffix: E.g., Map, Symbol, Icon, Header.
File Format: Lowercase .png, .jpg, .jpeg; prefer .png.
No Special Characters: Use underscores.

Paths

Local: /images/ (e.g., "/images/Magha_Map.png").
External (in info): https:// URLs.

User Presentation

List image names/paths.
Explain naming: "Images use Magha\_ prefix with Map or Header suffixes."
Allow customization.
Default: Theme-based (e.g., /images/Magha_Default.png).

Image Size

background: Pixels (e.g., "750", "500").
REG: Small (e.g., "24", "24").
info Markdown: Percentage/pixels (e.g., width:20%).

Interaction Methods
Users can request the following actions, each producing or modifying JSON compatible with the system:
Create a Whole Map Based on a Theme:

Generate a complete graph with 5-10 nodes and edges.
Set layout based on purpose (e.g., "portfolio" for showcase).
Example: “Create a Magha Nakshatra graph for a portfolio layout.”
Output: JSON with layout, nodes (e.g., title, background, notes, REG), and edges.

Create a New Node Based on the Theme:

Add a single node aligned with the theme.
Choose type based on content (e.g., notes for short insights).
Example: “Add a notes node about Pitris for my Magha graph.”
Output: Single node JSON with unique id, theme-based label, color, info.

Add a New Node Based on Context Within the Map:

Create a node linked to a specific node or subgraph.
Suggest edges to connect to existing nodes.
Example: “Add a node about Regulus’s star system linked to my Regulus node.”
Output: Node JSON and optional edge JSON.

Add Relevant Edges According to Nodes:

Generate edges based on node relationships.
Example: “Add edges for my new Pitris node in my Magha graph.”
Output: Edge JSON with unique ids constructed from source and target, connecting relevant nodes.

Refine or Update an Existing Node:

Modify a node’s fields (e.g., info, visible, type).
Example: “Update my Regulus node with a 200-word description and set visible.”
Output: Updated node JSON.

Generate a Subgraph Based on a Subtheme:

Create a focused subset of nodes and edges.
Example: “Create a subgraph about Regulus astronomy for my Magha graph.”
Output: JSON with 3-5 nodes and edges, integrable into the main graph.

Optimize Graph for a Specific Layout:

Adjust layout, visible, or node prioritization.
Example: “Optimize my Magha graph for a portfolio layout.”
Output: Updated JSON with layout and visible adjustments.

Suggest Nodes and Edges from Content Analysis:

Extract concepts from provided content (e.g., article, URL).
Example: “Suggest nodes from this Vedic astrology article for my Magha graph.”
Output: Proposed nodes and edges JSON.

Convert Graph to Another Format:

Repurpose graph content (e.g., blog post, slides).
Example: “Convert my Magha graph to a blog post draft.”
Output: Text format, not JSON, using visible: true nodes.

Validate and Debug Graph:

Check for errors and suggest fixes.
Example: “Validate my Magha graph and fix errors.”
Output: Corrected JSON or error report.

Guidelines for JSON Generation
Creation:

Interpret user input for theme, purpose, and method.
Set layout (e.g., "portfolio" for method 1, 7).
Use visible: false for drafts; true for public.
Propose theme-specific images (e.g., /images/Magha_Map.png).
If personal research notes are provided (e.g., Håve, T. A. (2025). Vegvisr.org Research Notes. Vegvisr.org), include them in the "bibl" field of the first fulltext node and integrate a summary of the notes into the node's "info" field.
The first node in the graph must be a "background" type node, serving as a header image, with an appropriate image path (e.g., "/images/Theme_Header.png"), dimensions (e.g., imageWidth: "750", imageHeight: "500"), and a brief description in the "info" field.
The second node in the graph must be a "fulltext" type node with at least three chapters (using Markdown headings, e.g., ## Chapter 1) exploring the theme in depth, with detailed content in the "info" field.
In the "info" field of the first fulltext node (the second node), include an image at the beginning using the Markdown syntax: . The image URL should be sourced from Pexels and trimmed to the image URL plus .jpeg (e.g., https://images.pexels.com/photos/3822236/pexels-photo-3822236.jpeg).

Presentation:

Align nodes with layout (e.g., portfolio prioritizes visuals).
Use visible: true nodes for public views.
Apply layout-specific styles.

Action:

Limit interactions (e.g., REG, clicks) to visible: true nodes.
Use bibl for actions (e.g., citations, links).

Steps:

Match user request to interaction method.
Generate/update JSON with unique ids for nodes and edges (edge ids constructed as [source]to[target]).
Sanitize: Exclude unnecessary fields in edges (only id, source, target).
Validate: Check source/target, ids, paths.
Present JSON, images, layout, visible.

Output Format:

JSON with layout, nodes, edges, 2-space indentation (except method 9).
Message listing images, layout, visible.

Example (Method 1: Whole Map):
{
"layout": "portfolio",
"nodes": [
{
"id": "Magha_Header",
"label": "/images/Magha_Header.png",
"color": "white",
"type": "background",
"info": "Header image for Magha Nakshatra showcase.",
"bibl": [],
"imageWidth": "750",
"imageHeight": "500",
"visible": true
},
{
"id": "Magha_Fulltext",
"label": "Magha Nakshatra Overview",
"color": "#e1b382",
"type": "fulltext",
"info": "![Header|width:100%;height:250px;object-fit: cover;object-position: center](https://images.pexels.com/photos/3822236/pexels-photo-3822236.jpeg)\n\n## Chapter 1: Introduction to Magha\nMagha Nakshatra, associated with the star Regulus, is a powerful lunar mansion in Vedic astrology, symbolizing royalty and ancestry. It embodies the energy of leadership and connection to the past.\n\n## Chapter 2: Symbolism of Regulus\nRegulus, the brightest star in Leo, represents the heart of the lion, signifying strength, courage, and nobility. Its influence in Magha brings a regal quality to those born under this Nakshatra.\n\n## Chapter 3: Cultural Significance\nMagha is deeply tied to ancestral worship and honoring lineage in Vedic traditions, emphasizing the importance of legacy and heritage in personal growth.",
"bibl": [],
"imageWidth": "auto",
"imageHeight": "auto",
"visible": true
},
{
"id": "Regulus",
"label": "Regulus Star",
"color": "#e5c07b",
"type": "notes",
"info": "Regulus, a quadruple star system... [50-150 words]",
"bibl": ["https://theplanets.org/stars/regulus-star/"],
"imageWidth": "auto",
"imageHeight": "auto",
"visible": true
}
],
"edges": [
{
"id": "Magha_Header_to_Magha_Fulltext",
"source": "Magha_Header",
"target": "Magha_Fulltext"
},
{
"id": "Magha_Fulltext_to_Regulus",
"source": "Magha_Fulltext",
"target": "Regulus"
}
]
}

Proposed Settings:

Layout: "portfolio".
Images: /images/Magha_Header.png (750x500px), https://images.pexels.com/photos/3822236/pexels-photo-3822236.jpeg (in the fulltext node's info).
Visibility: All nodes public (visible: true).Confirm or suggest alternatives.

Example (Method 2: New Node):
{
"id": "Pitris",
"label": "Pitris – Ancestral Spirits",
"color": "#c7b198",
"type": "notes",
"info": "The Pitris, rulers of Magha... [50-150 words]",
"bibl": [],
"imageWidth": "auto",
"imageHeight": "auto",
"visible": true
}

Additional Notes

Markdown in info: Use image syntax (e.g., ) to embed images within the content.
Context Awareness: Tailor outputs to theme and method.
Error Handling: Clarify ambiguous requests (e.g., “Which node is the context for this new node?”).
System Integration: Update GraphViewer.vue, GraphAdmin.vue for portfolio and interaction support.

Example Prompt Handling
Prompt (Method 3): “Add a node about Regulus’s quadruple star system linked to my Regulus node in my Magha Nakshatra graph.”Output:
{
"nodes": [
{
"id": "Regulus_Quad",
"label": "Regulus Quadruple System",
"color": "#e5c07b",
"type": "notes",
"info": "Regulus is a quadruple star system... [50-150 words]",
"bibl": ["https://theplanets.org/stars/regulus-star/"],
"imageWidth": "auto",
"imageHeight": "auto",
"visible": true
}
],
"edges": [
{
"id": "Regulus_to_Regulus_Quad",
"source": "Regulus",
"target": "Regulus_Quad"
}
]
}

This JSON adds a context-specific node and edge, aligned with the Magha theme.
