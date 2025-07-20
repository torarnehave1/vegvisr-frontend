-- Image Analysis Template for graphTemplates table (SQLite D1 Compatible)
-- Add this to your Cloudflare D1 database: npx wrangler d1 execute vegvisr_org --remote --file=image-analysis-template.sql

INSERT INTO graphTemplates (
    id,
    name,
    nodes,
    edges,
    created_at,
    updated_at,
    ai_instructions,
    category,
    thumbnail_path,
    standard_question
) VALUES (
    'a7f3d9e2-8b4c-4d5e-9f1a-3c6b7d8e9f0a',
    'Image Analysis',
    '[{\"id\":\"image-analysis-001\",\"label\":\"🔍 Image Analysis\",\"type\":\"image-analysis\",\"info\":\"Upload an image to analyze with AI vision models. Supports multiple input methods: file upload, image URL, or paste from clipboard. Choose from various analysis types including general description, object detection, OCR text extraction, medical analysis, technical analysis, and artistic analysis.\",\"color\":\"#e8f5e8\",\"bibl\":[],\"imageWidth\":\"100%\",\"imageHeight\":\"100%\",\"visible\":true,\"path\":null}]',
    '[]',
    datetime('now'),
    datetime('now'),
    '{\"format\":{\"nodeType\":\"image-analysis\",\"inputMethods\":[\"file_upload\",\"image_url\",\"paste_clipboard\"],\"analysisTypes\":[\"general\",\"detailed\",\"objects\",\"text\",\"medical\",\"technical\",\"artistic\",\"custom\"],\"models\":[\"gpt-4o\",\"gpt-4o-mini\"]},\"validation\":{\"image\":{\"formats\":[\"JPEG\",\"PNG\",\"GIF\",\"WebP\"],\"maxSize\":\"5MB\",\"message\":\"Image must be in JPEG, PNG, GIF, or WebP format and under 5MB\"},\"analysisPrompt\":{\"minLength\":10,\"maxLength\":1000,\"message\":\"Analysis prompt must be between 10 and 1000 characters\"},\"maxTokens\":{\"min\":100,\"max\":4096,\"default\":1024,\"message\":\"Max tokens must be between 100 and 4096\"}},\"nodeStructure\":{\"type\":\"image-analysis\",\"color\":\"#e8f5e8\",\"imageWidth\":\"100%\",\"imageHeight\":\"100%\",\"visible\":true,\"path\":null},\"apiIntegration\":{\"endpoint\":\"https://image-analysis-worker.torarnehave.workers.dev/analyze-image\",\"method\":\"POST\",\"headers\":[\"Content-Type: application/json\"],\"supportedModels\":[{\"name\":\"gpt-4o\",\"description\":\"Most capable vision model\"},{\"name\":\"gpt-4o-mini\",\"description\":\"Cost-effective vision model\"}]},\"analysisPrompts\":{\"general\":\"Describe this image in detail. What do you see?\",\"detailed\":\"Provide a comprehensive analysis of this image. Include details about objects, people, setting, mood, colors, composition, and any notable features.\",\"objects\":\"Identify and list all objects visible in this image. Describe their locations, sizes, and relationships to each other.\",\"text\":\"Extract and transcribe all text visible in this image. Preserve the original formatting and structure as much as possible.\",\"medical\":\"Analyze this medical image. Describe any visible anatomical structures, potential abnormalities, or clinically relevant findings. Note: This is for educational purposes only.\",\"technical\":\"Provide a technical analysis of this image. Focus on technical aspects, components, measurements, or engineering details visible.\",\"artistic\":\"Analyze this image from an artistic perspective. Comment on composition, color theory, style, technique, and aesthetic qualities.\"},\"features\":[\"Multiple image input methods (upload, URL, paste)\",\"8 predefined analysis types plus custom prompts\",\"OpenAI GPT-4o and GPT-4o-mini model support\",\"Configurable token limits (100-4096)\",\"Real-time image preview\",\"Drag & drop file support\",\"Automatic result node creation\",\"Copy results to clipboard\",\"Comprehensive error handling\",\"Loading states and progress indicators\"],\"requirements\":[\"OpenAI API key configured in image-analysis-worker\",\"Image file under 5MB or valid image URL\",\"Analysis prompt (custom or predefined type)\",\"Network connection to image-analysis-worker.torarnehave.workers.dev\"],\"outputFormat\":{\"success\":{\"analysis\":\"string - AI analysis result\",\"metadata\":{\"model\":\"string - model used\",\"analysisType\":\"string - type of analysis\",\"usage\":\"object - token usage statistics\",\"timestamp\":\"string - ISO timestamp\"}},\"error\":{\"message\":\"string - error description\",\"code\":\"number - error code\"}},\"useCases\":[\"Document and form analysis (OCR)\",\"Art and image critique\",\"Medical image interpretation (educational)\",\"Technical diagram analysis\",\"Object identification and cataloging\",\"Accessibility descriptions for visually impaired\",\"Content moderation and analysis\",\"Research and academic documentation\"]}',
    'Interactive',
    NULL,
    'Analyze an image with AI vision models'
);

-- Verify the insertion
SELECT id, name, category FROM graphTemplates WHERE name = 'Image Analysis'; 