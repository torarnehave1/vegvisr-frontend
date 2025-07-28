-- Email Templates SQL for graphTemplates table
-- These templates match the exact structure of existing templates in the database

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
) VALUES 
-- Chat Invitation Template
(
    '4f8e7a6b-2c1d-4e3a-8b9c-5d2f1e0a3b4c',
    'Chat Invitation Template',
    '[{"id": "email_invitation_001", "type": "email-template", "label": "Chat Invitation", "color": "#4A90E2", "info": "{\"templateType\": \"chat-invitation\", \"subject\": \"You''re invited to join our chat room!\", \"emailBody\": \"Hi {{recipientName}},\\n\\nYou''ve been invited to join our exclusive chat room ''{{chatRoomName}}''. This is a great place to connect with like-minded professionals and share insights.\\n\\nClick the link below to join:\\n{{inviteLink}}\\n\\nLooking forward to seeing you there!\\n\\nBest regards,\\n{{senderName}}\", \"variables\": [{\"name\": \"recipientName\", \"label\": \"Recipient Name\", \"defaultValue\": \"John Doe\"}, {\"name\": \"chatRoomName\", \"label\": \"Chat Room Name\", \"defaultValue\": \"Professional Network\"}, {\"name\": \"inviteLink\", \"label\": \"Invitation Link\", \"defaultValue\": \"https://vegvisr.org/join/room123\"}, {\"name\": \"senderName\", \"label\": \"Sender Name\", \"defaultValue\": \"Your Name\"}]}", "x": 400, "y": 300}]',
    '[]',
    datetime('now'),
    datetime('now'),
    'Use this template to create professional chat room invitations. Customize the variables to match your specific chat room and recipient details.',
    'Communication',
    NULL,
    'How can I invite someone to join our chat room?'
),

-- Project Update Template  
(
    '3a7f2b8e-5d9c-4f1a-8e6b-2c3d4a5b6c7d',
    'Project Update Template',
    '[{"id": "email_project_update_002", "type": "email-template", "label": "Project Update", "color": "#50C878", "info": "{\"templateType\": \"project-update\", \"subject\": \"{{projectName}} - Weekly Update\", \"emailBody\": \"Hi {{teamMember}},\\n\\nHere''s this week''s update for {{projectName}}:\\n\\n**Progress This Week:**\\n- {{achievement1}}\\n- {{achievement2}}\\n- {{achievement3}}\\n\\n**Next Week''s Goals:**\\n- {{goal1}}\\n- {{goal2}}\\n\\n**Blockers/Issues:**\\n{{blockers}}\\n\\n**Overall Status:** {{projectStatus}}\\n\\nPlease let me know if you have any questions or concerns.\\n\\nBest regards,\\n{{projectManager}}\", \"variables\": [{\"name\": \"teamMember\", \"label\": \"Team Member Name\", \"defaultValue\": \"Team Member\"}, {\"name\": \"projectName\", \"label\": \"Project Name\", \"defaultValue\": \"Project Alpha\"}, {\"name\": \"achievement1\", \"label\": \"Achievement 1\", \"defaultValue\": \"Completed user authentication\"}, {\"name\": \"achievement2\", \"label\": \"Achievement 2\", \"defaultValue\": \"Fixed database optimization\"}, {\"name\": \"achievement3\", \"label\": \"Achievement 3\", \"defaultValue\": \"Updated documentation\"}, {\"name\": \"goal1\", \"label\": \"Goal 1\", \"defaultValue\": \"Implement payment system\"}, {\"name\": \"goal2\", \"label\": \"Goal 2\", \"defaultValue\": \"Begin testing phase\"}, {\"name\": \"blockers\", \"label\": \"Current Blockers\", \"defaultValue\": \"None at this time\"}, {\"name\": \"projectStatus\", \"label\": \"Project Status\", \"defaultValue\": \"On Track\"}, {\"name\": \"projectManager\", \"label\": \"Project Manager\", \"defaultValue\": \"Your Name\"}]}", "x": 600, "y": 300}]',
    '[]',
    datetime('now'),
    datetime('now'),
    'Use this template for regular project status updates to team members and stakeholders. Include progress, upcoming goals, and any blockers.',
    'Business',
    NULL,
    'How can I send a project update to my team?'
),

-- Welcome Email Template
(
    '8e2a5f7b-9c4d-4a1f-6b8e-3d2a5c7f9b1e',
    'Welcome Email Template', 
    '[{"id": "email_welcome_003", "type": "email-template", "label": "Welcome Email", "color": "#FF6B6B", "info": "{\"templateType\": \"welcome-email\", \"subject\": \"Welcome to {{companyName}}!\", \"emailBody\": \"Dear {{newUserName}},\\n\\nWelcome to {{companyName}}! We''re thrilled to have you join our community.\\n\\n**Getting Started:**\\n1. Complete your profile at {{profileLink}}\\n2. Explore our {{platformFeature}} feature\\n3. Join our community chat at {{communityLink}}\\n\\n**Need Help?**\\nOur support team is available 24/7 at {{supportEmail}}\\n\\n**Quick Tips:**\\n- {{tip1}}\\n- {{tip2}}\\n- {{tip3}}\\n\\nWe''re excited to see what you''ll accomplish with {{companyName}}!\\n\\nWarm regards,\\n{{senderName}}\\n{{senderTitle}}\", \"variables\": [{\"name\": \"newUserName\", \"label\": \"New User Name\", \"defaultValue\": \"Alex\"}, {\"name\": \"companyName\", \"label\": \"Company Name\", \"defaultValue\": \"Vegvisr\"}, {\"name\": \"profileLink\", \"label\": \"Profile Setup Link\", \"defaultValue\": \"https://vegvisr.org/profile\"}, {\"name\": \"platformFeature\", \"label\": \"Key Platform Feature\", \"defaultValue\": \"Knowledge Graph\"}, {\"name\": \"communityLink\", \"label\": \"Community Link\", \"defaultValue\": \"https://vegvisr.org/chat\"}, {\"name\": \"supportEmail\", \"label\": \"Support Email\", \"defaultValue\": \"support@vegvisr.org\"}, {\"name\": \"tip1\", \"label\": \"Tip 1\", \"defaultValue\": \"Use the search function to find relevant content quickly\"}, {\"name\": \"tip2\", \"label\": \"Tip 2\", \"defaultValue\": \"Connect with other users in your field\"}, {\"name\": \"tip3\", \"label\": \"Tip 3\", \"defaultValue\": \"Check out our tutorial videos\"}, {\"name\": \"senderName\", \"label\": \"Sender Name\", \"defaultValue\": \"The Vegvisr Team\"}, {\"name\": \"senderTitle\", \"label\": \"Sender Title\", \"defaultValue\": \"Customer Success\"}]}", "x": 800, "y": 300}]',
    '[]',
    datetime('now'),
    datetime('now'),
    'Use this template to welcome new users to your platform or service. Customize it with your company details and onboarding steps.',
    'Communication',
    NULL,
    'How can I welcome new users to our platform?'
);
