# Fulltext Node AI Instruction Template

## Purpose

This template guides the AI in generating well-structured fulltext nodes with proper formatting and styling.

## Structure

```json
{
  "instruction": "Create a fulltext node about [TOPIC]",
  "format": {
    "type": "fulltext",
    "required_elements": ["fancy_title", "header_image", "sections", "content"],
    "optional_elements": ["quotes", "work_notes", "side_images", "youtube_videos", "page_breaks"]
  },
  "style_guide": {
    "fancy_title": {
      "font_family": "Arial, sans-serif",
      "font_size": "4.5em",
      "color": "#2c3e50",
      "text_align": "center"
    },
    "sections": {
      "background_colors": ["#FFFBE6", "#E7F7F7", "#F0F0F0", "#FDF3E7"],
      "text_colors": ["#000", "#111", "#222"]
    },
    "images": {
      "header": {
        "height": "200px",
        "object_fit": "cover",
        "object_position": "center"
      },
      "side": {
        "width": "200px",
        "height": "200px",
        "object_fit": "cover",
        "object_position": "center"
      }
    }
  },
  "content_structure": {
    "introduction": {
      "required": true,
      "elements": ["fancy_title", "header_image", "brief_overview"]
    },
    "main_content": {
      "required": true,
      "elements": ["sections", "side_images", "quotes"]
    },
    "conclusion": {
      "required": true,
      "elements": ["summary", "page_break"]
    }
  },
  "markdown_formatting": {
    "headings": "Use ## for section headings",
    "emphasis": "Use **bold** and *italic* for emphasis",
    "lists": "Use - for unordered lists and 1. for ordered lists",
    "code": "Use `backticks` for inline code"
  }
}
```

## Example Usage

```json
{
  "instruction": "Create a fulltext node about the history of artificial intelligence",
  "format": {
    "type": "fulltext",
    "required_elements": ["fancy_title", "header_image", "sections", "content"]
  },
  "style_guide": {
    "fancy_title": {
      "font_family": "Arial, sans-serif",
      "font_size": "4.5em",
      "color": "#2c3e50",
      "text_align": "center"
    }
  }
}
```

## Response Format

The AI should respond with a complete fulltext node in the following format:

```json
[
  {
    "id": "unique_id",
    "label": "Main Title",
    "color": "#D2691E",
    "type": "fulltext",
    "info": "[FANCY | font-family: 'Arial, sans-serif'; font-size: 4.5em; color: #2c3e50; text-align: center]\nMain Title\n[END FANCY]\n\n![Header|height: 200px; object-fit: 'cover'](https://vegvisr.imgix.net/HEADERIMG.png)\n\n[SECTION | background-color:'#FFFBE6'; color:'#000']\n## Introduction\n\nContent here...\n[END SECTION]\n\n...",
    "bibl": ["Source: [SOURCE]"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }
]
```

## Guidelines

1. Always include a fancy title at the beginning
2. Use appropriate section backgrounds and text colors
3. Include relevant images with proper formatting
4. Use quotes and work notes where appropriate
5. Structure content with clear headings
6. Include proper citations in the bibl field
7. Ensure all elements are properly closed
8. Test the markdown rendering before finalizing

## Best Practices

1. Keep sections focused and well-organized
2. Use consistent styling throughout
3. Ensure proper spacing between elements
4. Include relevant images with proper attribution
5. Use quotes to highlight important information
6. Add work notes for editorial comments
7. Use page breaks for better print layout
8. Maintain proper markdown formatting
