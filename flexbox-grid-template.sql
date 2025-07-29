-- Create FLEXBOX-GRID Template for Vegvisr Database
-- This template creates a working 3x2 grid layout that renders properly in Vue

INSERT INTO GraphTemplate (id, name, nodes, edges, category)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'FLEXBOX-GRID Template',
  '[{
    "id": "flexbox-grid-001",
    "label": "Image Grid Layout (3x2)",
    "color": "#e8f5e8",
    "type": "fulltext",
    "info": "[FLEXBOX-GRID]\n![Grid Image 1|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=1)\n![Grid Image 2|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=2)\n![Grid Image 3|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=3)\n![Grid Image 4|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=4)\n![Grid Image 5|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=5)\n![Grid Image 6|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=6)\n[END FLEXBOX]",
    "bibl": ["Template: FLEXBOX-GRID Layout", "Use: Image galleries and portfolios", "Format: 3-column grid, 2 rows"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }]',
  '[]',
  'Layout Templates'
);
