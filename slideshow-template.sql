-- Slideshow Node Template for GraphTemplate Database
-- This creates a specialized node type for slideshow presentations

INSERT INTO graphTemplates (id, name, nodes, edges, category) VALUES (
    (SELECT COALESCE(MAX(id), 0) + 1 FROM graphTemplates),
    'SlideShow Node Template',
    '[{
        "id": "slideshow_default",
        "label": "New Slideshow",
        "color": "#e6f3ff",
        "type": "slideshow",
        "info": "# Slide 1: Welcome\nThis is the first slide of your presentation.\n\n[FANCY | font-size: 2.5em; color: #007bff; text-align: center; background: linear-gradient(135deg, #e3f2fd, #bbdefb)]\nWelcome to Our Presentation!\n[END FANCY]\n\n[SECTION | background-color: 'lightblue'; color: 'black'; text-align: 'center'; font-size: '1.1em']\nYour content here with **enhanced formatting**\n[END SECTION]\n\n---\n\n# Slide 2: Main Content\nAdd your main content here.\n\n[FANCY | font-size: 1.8em; color: #28a745; text-shadow: 2px 2px 4px rgba(0,0,0,0.3)]\nKey Points:\n[END FANCY]\n\n- Point 1\n- Point 2\n- Point 3\n\n[QUOTE | cited: 'Knowledge Expert']\nThis is an important quote that emphasizes key concepts in your presentation.\n[END QUOTE]\n\n---\n\n# Slide 3: Conclusion\nThank you for viewing this slideshow!\n\n[FANCY | font-size: 3em; color: #fd7e14; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nThank You!\n[END FANCY]\n\n[SECTION | background-color: '#e8f5e8'; border: '2px solid #28a745'; text-align: 'center']\n**Questions and discussion welcome.**\n\nContact us for more information.\n[END SECTION]",
        "bibl": ["Source: Created with Vegvisr Slideshow System"],
        "imageWidth": "auto",
        "imageHeight": "auto",
        "visible": true
    }]',
    '[]',
    'Presentation'
);
