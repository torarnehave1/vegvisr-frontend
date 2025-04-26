# Action Node Types

This document outlines the various types of `action` nodes available in the application and their purposes.

## 1. `action_txt`

- **Purpose**: Upload and attach text files (e.g., `.txt`, `.md`) to the graph.
- **Use Case**: A user uploads a text file, and its content is added as a new node or linked to an existing node.

## 2. `action_img`

- **Purpose**: Upload and attach images to the graph.
- **Use Case**: A user uploads an image, and it is displayed as a background or linked to a node.

## 3. `action_link`

- **Purpose**: Add or associate external links to the graph.
- **Use Case**: A user inputs a URL, which is added as a new node or linked to an existing node.

## 4. `action_note`

- **Purpose**: Add text notes or annotations to nodes or edges.
- **Use Case**: A user adds a note to provide additional context or explanation.

## 5. `action_search`

- **Purpose**: Perform a search within the graph or external resources.
- **Use Case**: A user searches for specific nodes or edges, or fetches related data from an API.

## 6. `action_import`

- **Purpose**: Import data (e.g., JSON, CSV, XML) into the graph.
- **Use Case**: A user uploads a file, and its content is parsed to create nodes and edges.

## 7. `action_export`

- **Purpose**: Export the current graph or a subset of it.
- **Use Case**: A user downloads the graph in a specific format (e.g., JSON, PNG, PDF).

## 8. `action_api`

- **Purpose**: Trigger an API call to fetch or update data.
- **Use Case**: A user triggers an API request to dynamically update the graph.

## 9. `action_toggle`

- **Purpose**: Toggle the visibility or state of specific nodes or edges.
- **Use Case**: A user hides or shows a group of related nodes or edges.

## 10. `action_calculate`

- **Purpose**: Perform calculations or analytics on the graph.
- **Use Case**: A user calculates metrics like centrality, shortest paths, or clustering coefficients.

## 11. `action_style`

- **Purpose**: Change the style or layout of the graph.
- **Use Case**: A user applies a specific layout (e.g., grid, circular) or changes the color scheme.

## 12. `action_merge`

- **Purpose**: Merge multiple nodes or edges into a single entity.
- **Use Case**: A user combines duplicate nodes or consolidates related edges.

## 13. `action_split`

- **Purpose**: Split a node into multiple nodes based on its metadata.
- **Use Case**: A user breaks a node into smaller nodes, each representing a subset of its data.

## 14. `action_upload_doc`

- **Purpose**: Upload and process documents (e.g., PDFs, Word files).
- **Use Case**: A user uploads a document, and its text or metadata is extracted to create new nodes.

## 15. `action_translate`

- **Purpose**: Translate text content in the graph to another language.
- **Use Case**: A user translates a node's label or metadata into a selected language.

## 16. `action_generate`

- **Purpose**: Generate new content or nodes using AI (e.g., GPT).
- **Use Case**: A user generates summaries, insights, or related concepts based on existing graph data.

## 17. `action_delete`

- **Purpose**: Delete a specific node, edge, or group of elements.
- **Use Case**: A user removes unwanted elements from the graph.

## 18. `action_group`

- **Purpose**: Group multiple nodes into a cluster or category.
- **Use Case**: A user creates a visual group or category for related nodes.

## 19. `action_filter`

- **Purpose**: Apply filters to the graph to show or hide specific elements.
- **Use Case**: A user filters nodes by type, metadata, or other criteria.

## 20. `action_snapshot`

- **Purpose**: Take a snapshot of the current graph state.
- **Use Case**: A user saves the current graph view as an image or saves its state for later restoration.

## 21. `action_comment`

- **Purpose**: Add comments or feedback to a node or edge.
- **Use Case**: A user leaves a comment, which is stored as metadata or displayed in a sidebar.

## 22. `action_analyze`

- **Purpose**: Perform semantic or structural analysis on the graph.
- **Use Case**: A user analyzes relationships, detects patterns, or identifies anomalies.

---

These `action` node types provide flexibility and functionality to enhance the user experience and enable dynamic interactions with the graph.
