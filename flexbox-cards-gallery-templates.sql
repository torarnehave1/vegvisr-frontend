-- Create FLEXBOX-CARDS Template for Vegvisr Database
-- This template creates working card layouts

INSERT INTO GraphTemplate (id, name, nodes, edges, category)
VALUES (
  '550e8401-e29b-41d4-a716-446655440001',
  'FLEXBOX-CARDS Template',
  '[{
    "id": "flexbox-cards-001",
    "label": "Card Layout",
    "color": "#fff2e6",
    "type": "fulltext",
    "info": "[FLEXBOX-CARDS]\n**Card 1**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://picsum.photos/60/60?random=11)\nDescription for the first card with some text content that explains the topic.\n\n**Card 2**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://picsum.photos/60/60?random=12)\nSecond card with different content and another thumbnail image.\n\n**Card 3**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://picsum.photos/60/60?random=13)\nThird card completing our card layout with more descriptive text.\n[END FLEXBOX]",
    "bibl": ["Template: FLEXBOX-CARDS Layout", "Use: Feature highlights and content cards", "Format: Flexible card grid"],
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
