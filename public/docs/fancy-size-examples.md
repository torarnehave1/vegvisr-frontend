# FANCY Element Size Control Examples

You can now control the width and height of FANCY elements by adding `width` and `height` attributes to the style declaration. This is perfect for controlling the size of background images.

## Basic Size Control

### Fixed Width and Height

```markdown
[FANCY | font-size: 3.5em; color: lightblue; background-image: url('https://images.pexels.com/photos/163142/glasses-notebook-wooden-business-163142.jpeg?auto=compress&cs=tinysrgb&h=350'); text-align: center; width: 600px; height: 300px]
Hvordan se dette ut på facebook da ?
[END FANCY]
```

### Width Only (Height Auto)

```markdown
[FANCY | font-size: 4em; color: white; background-image: url('https://images.pexels.com/photos/163142/glasses-notebook-wooden-business-163142.jpeg?auto=compress&cs=tinysrgb&h=350'); text-align: center; width: 800px]
Custom Width Example
[END FANCY]
```

### Height Only (Width Auto)

```markdown
[FANCY | font-size: 2.5em; color: lightblue; background-image: url('https://images.pexels.com/photos/163142/glasses-notebook-wooden-business-163142.jpeg?auto=compress&cs=tinysrgb&h=350'); text-align: center; height: 400px]
Custom Height Example
[END FANCY]
```

## Different Size Units

### Pixels (Recommended)

```markdown
[FANCY | font-size: 3em; color: white; background-image: url('https://example.com/image.jpg'); width: 500px; height: 250px]
Pixel-based sizing
[END FANCY]
```

### Percentages

```markdown
[FANCY | font-size: 3em; color: white; background-image: url('https://example.com/image.jpg'); width: 80%; height: 200px]
Percentage width with fixed height
[END FANCY]
```

### Viewport Units

```markdown
[FANCY | font-size: 4em; color: white; background-image: url('https://example.com/image.jpg'); width: 50vw; height: 30vh]
Viewport-based sizing
[END FANCY]
```

## Responsive Design Examples

### Small Mobile-Friendly Banner

```markdown
[FANCY | font-size: 2em; color: white; background-image: url('https://example.com/image.jpg'); width: 100%; height: 150px; text-align: center]
Mobile Banner
[END FANCY]
```

### Medium Desktop Banner

```markdown
[FANCY | font-size: 3.5em; color: lightblue; background-image: url('https://example.com/image.jpg'); width: 700px; height: 300px; text-align: center]
Desktop Banner
[END FANCY]
```

### Large Hero Banner

```markdown
[FANCY | font-size: 5em; color: white; background-image: url('https://example.com/image.jpg'); width: 100%; height: 500px; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.8)]
Hero Section
[END FANCY]
```

## Best Practices

1. **Use pixels for precise control**: When you need exact dimensions, use pixel values
2. **Combine with percentages**: Use percentage width with fixed pixel height for responsive designs
3. **Consider text readability**: Ensure sufficient contrast between text and background image
4. **Test different sizes**: Preview your content at different screen sizes
5. **Aspect ratios**: Maintain good aspect ratios for your background images

## Important Notes

- **Units are required**: Always specify units (px, %, em, rem, vw, vh)
- **Numbers without units**: If you specify just a number (e.g., `width: 600`), it will automatically be converted to pixels (`width: 600px`)
- **Background image sizing**: The background image will automatically scale to cover the entire element
- **Text positioning**: Use `text-align`, `padding`, and other CSS properties to position your text within the sized element

## Example Use Cases

### Advertisement Banners

Perfect for creating consistently-sized advertisement banners that maintain their proportions across different content.

### Social Media Preview Cards

Create preview cards that match social media platform dimensions.

### Image Overlays

Control the exact size of text overlays on background images for professional presentations.
