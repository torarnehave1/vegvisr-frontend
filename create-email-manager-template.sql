-- Email Manager GraphTemplate Creation
-- Creates a template that adds an email manager node to knowledge graphs

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
    'email-manager-template-001',
    'Email Manager',
    '[{
        "id": "email-manager-node",
        "label": "📧 Email Templates Manager",
        "color": "#667eea",
        "type": "email-manager",
        "info": "Comprehensive email template management system with CRUD operations for all email templates stored in the email_templates database table.",
        "bibl": [],
        "imageWidth": "100%",
        "imageHeight": "100%",
        "visible": true,
        "path": null
    }]',
    '[]',
    datetime('now'),
    datetime('now'),
    'This template creates an Email Manager node that provides a complete interface for managing email templates. The node connects to the email_templates database table and allows administrators to create, read, update, and delete email templates. It includes features like template categorization, search and filtering, inline editing, duplication, and variable management.',
    'Management',
    null,
    'How can I manage my email templates efficiently?'
);
