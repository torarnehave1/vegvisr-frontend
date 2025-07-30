-- Create FLEXBOX-CARDS Template for Vegvisr Database
-- This template creates working card layouts with column control

INSERT INTO GraphTemplate (id, name, nodes, edges, category)
VALUES (
  '550e8401-e29b-41d4-a716-446655440001',
  'FLEXBOX-CARDS Template (3 Columns)',
  '[{
    "id": "flexbox-cards-001",
    "label": "Card Layout - 3 Columns",
    "color": "#fff2e6",
    "type": "fulltext",
    "info": "[FLEXBOX-CARDS-3]\n**Card 1**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://picsum.photos/60/60?random=11)\nDescription for the first card with some text content that explains the topic.\n\n**Card 2**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://picsum.photos/60/60?random=12)\nSecond card with different content and another thumbnail image.\n\n**Card 3**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://picsum.photos/60/60?random=13)\nThird card completing our card layout with more descriptive text.\n[END FLEXBOX]",
    "bibl": ["Template: FLEXBOX-CARDS Layout", "Use: Feature highlights and content cards", "Format: 3-column grid", "Syntax: [FLEXBOX-CARDS-3] for 3 columns"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }]',
  '[]',
  'Layout Templates'
);

-- Create additional FLEXBOX-CARDS templates for different column counts
INSERT INTO GraphTemplate (id, name, nodes, edges, category)
VALUES (
  '550e8403-e29b-41d4-a716-446655440003',
  'FLEXBOX-CARDS Template (2 Columns)',
  '[{
    "id": "flexbox-cards-002",
    "label": "Card Layout - 2 Columns",
    "color": "#e8f4ff",
    "type": "fulltext",
    "info": "[FLEXBOX-CARDS-2]\n**Feature A**\n![Icon A|width: 80px; height: 80px; border-radius: 50%](https://picsum.photos/80/80?random=21)\nDetailed description of the first feature with comprehensive explanation.\n\n**Feature B**\n![Icon B|width: 80px; height: 80px; border-radius: 50%](https://picsum.photos/80/80?random=22)\nDetailed description of the second feature with comprehensive explanation.\n[END FLEXBOX]",
    "bibl": ["Template: FLEXBOX-CARDS Layout", "Use: Two-column comparisons", "Format: 2-column grid", "Syntax: [FLEXBOX-CARDS-2] for 2 columns"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }]',
  '[]',
  'Layout Templates'
);

INSERT INTO GraphTemplate (id, name, nodes, edges, category)
VALUES (
  '550e8404-e29b-41d4-a716-446655440004',
  'FLEXBOX-CARDS Template (4 Columns)',
  '[{
    "id": "flexbox-cards-004",
    "label": "Card Layout - 4 Columns",
    "color": "#f0fff0",
    "type": "fulltext",
    "info": "[FLEXBOX-CARDS-4]\n**Step 1**\n![Step 1|width: 50px; height: 50px; border-radius: 50%](https://picsum.photos/50/50?random=31)\nFirst step in the process.\n\n**Step 2**\n![Step 2|width: 50px; height: 50px; border-radius: 50%](https://picsum.photos/50/50?random=32)\nSecond step in the process.\n\n**Step 3**\n![Step 3|width: 50px; height: 50px; border-radius: 50%](https://picsum.photos/50/50?random=33)\nThird step in the process.\n\n**Step 4**\n![Step 4|width: 50px; height: 50px; border-radius: 50%](https://picsum.photos/50/50?random=34)\nFinal step in the process.\n[END FLEXBOX]",
    "bibl": ["Template: FLEXBOX-CARDS Layout", "Use: Process steps or small cards", "Format: 4-column grid", "Syntax: [FLEXBOX-CARDS-4] for 4 columns"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }]',
  '[]',
  'Layout Templates'
);

-- Create FLEXBOX-GALLERY Template for Vegvisr Database
-- This template creates working gallery layouts

INSERT INTO GraphTemplate (id, name, nodes, edges, category)
VALUES (
  '550e8402-e29b-41d4-a716-446655440002',
  'FLEXBOX-GALLERY Template',
  '[{
    "id": "flexbox-gallery-001",
    "label": "Image Gallery",
    "color": "#f0f8ff",
    "type": "fulltext",
    "info": "[FLEXBOX-GALLERY]\n![Gallery Image 1|width: 150px; height: 100px; object-fit: cover; border-radius: 8px](https://picsum.photos/150/100?random=21)\n![Gallery Image 2|width: 150px; height: 100px; object-fit: cover; border-radius: 8px](https://picsum.photos/150/100?random=22)\n![Gallery Image 3|width: 150px; height: 100px; object-fit: cover; border-radius: 8px](https://picsum.photos/150/100?random=23)\n![Gallery Image 4|width: 150px; height: 100px; object-fit: cover; border-radius: 8px](https://picsum.photos/150/100?random=24)\n![Gallery Image 5|width: 150px; height: 100px; object-fit: cover; border-radius: 8px](https://picsum.photos/150/100?random=25)\n[END FLEXBOX]",
    "bibl": ["Template: FLEXBOX-GALLERY Layout", "Use: Image galleries and portfolios", "Format: Flexible image grid"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }]',
  '[]',
  'Layout Templates'
);
