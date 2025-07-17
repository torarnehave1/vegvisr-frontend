-- Insert the Learning Content Creator template into graphTemplates table
-- This template creates a generator node that produces YouTube scripts from markdown documentation
-- Run with: npx wrangler d1 execute vegvisr_org --remote --file=database/learning-content-template.sql

INSERT INTO graphTemplates (
    id,
    name,
    nodes,
    edges,
    ai_instructions,
    category,
    thumbnail_path,
    standard_question
) VALUES (
    'learning-content-creator-001',
    'Learning Content Creator',
    '[
        {
            "id": "learning-creator-001",
            "label": "🎓 Learning Content Creator",
            "type": "learn-script",
            "info": "{\"name\": \"New Learning Content\", \"description\": \"Generate YouTube script from markdown documentation\", \"markdown\": \"\", \"youtubeUrl\": \"\", \"aiProvider\": \"api-worker\", \"scriptStyle\": \"tutorial\", \"targetDuration\": \"5-10 minutes\", \"includeTimestamps\": true, \"includeEngagement\": true}",
            "color": "#e8f5e8",
            "bibl": [],
            "imageWidth": "100%",
            "imageHeight": "100%",
            "visible": true,
            "path": null
        }
    ]',
    '[]',
    'Generate professional YouTube scripts from markdown documentation. This template creates a generator node that takes markdown content and produces engaging educational video scripts with timestamps, engagement elements, and professional formatting. Can use either API-worker (GPT-4/Grok-3) or dev-worker (Cloudflare AI) for generation. Automatically creates both a fulltext script node and optional YouTube video node.',
    'Learning Content',
    null,
    'Generate a YouTube script from documentation'
);

-- Verify the insertion
SELECT id, name, category FROM graphTemplates WHERE name = 'Learning Content Creator'; 