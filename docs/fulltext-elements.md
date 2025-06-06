# Fulltext Node Elements Documentation

This document describes all the special elements that can be rendered inside a fulltext node in the Vegvisr platform.

## Table of Contents

- [Section](#section)
- [Work Note](#work-note)
- [Quote](#quote)
- [Fancy Title](#fancy-title)
- [Images](#images)
- [YouTube Videos](#youtube-videos)
- [Page Breaks](#page-breaks)

## Section

Sections are used to create visually distinct blocks of content with custom styling.

```markdown
[SECTION | background-color: 'lightyellow'; color: 'black']
Your content here
[END SECTION]
```

### Available Style Properties

- `background-color`: Background color of the section
- `color`: Text color
- Any valid CSS property can be used

## Work Note

Work notes are used to highlight important information or notes with a distinct visual style.

```markdown
[WNOTE | Cited='Author Name']
Your work note content here
[END WNOTE]
```

### Properties

- `Cited`: The author or source of the work note

## Quote

Quotes are used to display quoted text with proper attribution.

```markdown
[QUOTE | Cited='Author Name']
Your quoted text here
[END QUOTE]
```

### Properties

- `Cited`: The author or source of the quote

## Fancy Title

Fancy titles are used to create visually striking headings with custom styling.

```markdown
[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]
Your fancy title here
[END FANCY]
```

### Available Style Properties

- `font-size`: Size of the text
- `color`: Text color
- `background-image`: Background image URL
- `text-align`: Text alignment
- Any valid CSS property can be used

## Images

### Header Image

```markdown
![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)
```

### Right Side Image

```markdown
![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)
```

### Left Side Image

```markdown
![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)
```

### Image Properties

- `height`: Image height
- `width`: Image width
- `object-fit`: How the image fits its container ('cover', 'contain', etc.)
- `object-position`: Image position within its container

## YouTube Videos

YouTube videos can be embedded with a title.

```markdown
![YOUTUBE src=https://www.youtube.com/embed/VIDEO_ID]Video Title[END YOUTUBE]
```

### Properties

- `src`: YouTube embed URL
- Title text between the tags

## Page Breaks

Page breaks can be inserted to force a new page when printing or generating PDFs.

```markdown
[pb]
```

## Best Practices

1. Always close your elements with the corresponding end tag
2. Use consistent styling across similar elements
3. Keep image sizes reasonable for optimal performance
4. Use proper attribution for quotes and work notes
5. Test your content in both preview and print modes

## Examples

### Complete Example with Multiple Elements

```markdown
[FANCY | font-size: 4.5em; color: #2c3e50; text-align: center]
Main Title
[END FANCY]

![Header|height: 200px; object-fit: 'cover'](https://vegvisr.imgix.net/HEADERIMG.png)

[SECTION | background-color: '#f8f9fa'; padding: '20px']

## Introduction

[QUOTE | Cited='John Doe']
This is an important quote about the topic.
[END QUOTE]

![Rightside-1|width: 200px; height: 200px](https://vegvisr.imgix.net/SIDEIMG.png)
Main content goes here...

[WNOTE | Cited='Editor']
Important note about the content.
[END WNOTE]
[END SECTION]

[pb]

## Next Section

...
```
