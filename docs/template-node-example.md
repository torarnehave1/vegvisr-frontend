# Template Node Example

This is a template node that demonstrates all available fulltext elements. You can use this as a reference when creating new nodes.

```json
[
  {
    "id": "template_fulltext_node",
    "label": "Template: Fulltext Node Example",
    "color": "#D2691E",
    "type": "fulltext",
    "info": "[FANCY | font-size: 4.5em; color: #2c3e50; text-align: center]\nTemplate Node Title\n[END FANCY]\n\n![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)\n\n[SECTION | background-color:'#FFFBE6'; color:'#000']\n## Introduction\n\nThis is an example of a section with custom background color and text color. Sections are great for organizing content into visually distinct blocks.\n\n[QUOTE | Cited='Author Name']\nThis is an example of a quote block. Use it to highlight important statements or citations.\n[END QUOTE]\n\n![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)\n\nMain content goes here. You can include regular markdown formatting like **bold**, *italic*, and `code`.\n[END SECTION]\n\n[SECTION | background-color:'#E7F7F7'; color:'#111']\n## Key Features\n\nThis section demonstrates different content elements:\n\n1. **Lists** - Like this numbered list\n2. **Formatting** - Various text styles\n3. **Images** - Different image placements\n\n![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)\n\n[WNOTE | Cited='Editor']\nThis is a work note. Use it to highlight important information or editorial comments.\n[END WNOTE]\n[END SECTION]\n\n[SECTION | background-color:'#F0F0F0'; color:'#000']\n## Media Integration\n\n### YouTube Video Example\n\n![YOUTUBE src=https://www.youtube.com/embed/VIDEO_ID]Video Title[END YOUTUBE]\n\nThis section shows how to integrate different types of media.\n[END SECTION]\n\n[SECTION | background-color:'#FDF3E7'; color:'#222']\n## Conclusion\n\nThis is the final section. You can use page breaks to separate content when printing or generating PDFs.\n\n[pb]\n\n## Next Section\n\nContent continues after the page break...\n[END SECTION]",
    "bibl": ["Source: Template Example"],
    "imageWidth": "100%",
    "imageHeight": "100%",
    "visible": true,
    "path": null
  }
]
```

## Elements Used in This Template

1. **Fancy Title**

   - Used at the beginning for the main title
   - Custom styling with font size and colors

2. **Header Image**

   - Full-width image at the top
   - Custom height and object-fit properties

3. **Sections**

   - Multiple sections with different background colors
   - Custom text colors
   - Organized content structure

4. **Quote Block**

   - Example of a quoted text with attribution
   - Used within a section

5. **Side Images**

   - Both left and right side images
   - Custom width, height, and positioning

6. **Work Note**

   - Example of an editorial note
   - Used within a section

7. **YouTube Video**

   - Example of video embedding
   - Custom title and source

8. **Page Break**
   - Example of a page break for printing/PDF

## Usage Notes

1. Copy the JSON structure and modify the content as needed
2. Maintain the same structure but replace the content with your own
3. You can mix and match different elements within sections
4. Remember to close all elements with their corresponding end tags
5. Test the rendering in both preview and print modes
