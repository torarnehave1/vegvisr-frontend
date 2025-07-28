-- SQL to add Email Templates to graphTemplate table
-- Execute these in your database to add the email templates

-- 1. Basic Chat Invitation Template
INSERT INTO graphTemplates (name, nodes, edges, category, ai_instructions) VALUES (
  'Basic Chat Invitation Template',
  '[{"id":"email-template-chat-invitation","type":"email-template","label":"📧 Chat Invitation Email","color":"#4CAF50","info":"{\"templateName\":\"Chat Invitation Template\",\"subject\":\"You are invited to join {roomName}\",\"body\":\"Hello!\\n\\n{senderName} has invited you to join the chat room \\\"{roomName}\\\".\\n\\n{roomDescription}\\n\\nClick the link below to accept the invitation:\\n{invitationLink}\\n\\nThis invitation will expire on {expirationDate}.\\n\\nBest regards,\\nVegvisr Team\",\"recipients\":\"{inviteeEmail}\",\"variables\":{\"roomName\":\"Demo Chat Room\",\"senderName\":\"John Doe\",\"roomDescription\":\"A collaborative space for team discussions and project updates.\",\"inviteeEmail\":\"user@example.com\",\"invitationLink\":\"https://vegvisr.org/chat/join/abc123\",\"expirationDate\":\"July 30, 2025\"}}","bibl":[],"imageWidth":"100%","imageHeight":"100%","visible":true,"path":null}]',
  '[]',
  'Email Templates',
  'Use the AI generator to create professional chat room invitations. The template includes variables for room name, sender details, and invitation links. Click the 🤖 AI button to generate custom variations based on your specific needs.'
);

-- 2. Project Update Notification Template  
INSERT INTO graphTemplates (name, nodes, edges, category, ai_instructions) VALUES (
  'Project Update Notification',
  '[{"id":"email-template-project-update","type":"email-template","label":"📊 Project Update Email","color":"#2196F3","info":"{\"templateName\":\"Project Update Notification\",\"subject\":\"Project Update: {projectName} - {updateType}\",\"body\":\"Hi {recipientName},\\n\\nWe have an important update regarding the {projectName} project.\\n\\n**Update Type:** {updateType}\\n**Status:** {projectStatus}\\n**Next Milestone:** {nextMilestone}\\n\\n**Details:**\\n{updateDetails}\\n\\n**Action Required:**\\n{actionRequired}\\n\\nIf you have any questions, please do not hesitate to reach out.\\n\\nBest regards,\\n{senderName}\\n{senderTitle}\",\"recipients\":\"{teamEmail}\",\"variables\":{\"projectName\":\"Vegvisr Platform\",\"updateType\":\"Weekly Progress Update\",\"projectStatus\":\"On Track\",\"nextMilestone\":\"Beta Release - August 15, 2025\",\"updateDetails\":\"Frontend development is progressing well. Email template system has been successfully implemented.\",\"actionRequired\":\"Please review the latest design mockups in the shared folder.\",\"recipientName\":\"Team Member\",\"teamEmail\":\"team@example.com\",\"senderName\":\"Project Manager\",\"senderTitle\":\"Development Team Lead\"}}","bibl":[],"imageWidth":"100%","imageHeight":"100%","visible":true,"path":null}]',
  '[]', 
  'Email Templates',
  'Perfect for regular project communications. Use the AI generator to create updates for different project phases, milestone announcements, or status reports. Specify your project type and update frequency for customized templates.'
);

-- 3. Simple Welcome Email Template (Bonus)
INSERT INTO graphTemplates (name, nodes, edges, category, ai_instructions) VALUES (
  'Welcome Email Template',
  '[{"id":"email-template-welcome","type":"email-template","label":"🎉 Welcome Email","color":"#FF9800","info":"{\"templateName\":\"Welcome Email Template\",\"subject\":\"Welcome to {platformName}, {userName}!\",\"body\":\"Dear {userName},\\n\\nWelcome to {platformName}! We are excited to have you join our community.\\n\\n**Getting Started:**\\n• Complete your profile: {profileLink}\\n• Explore our features: {featuresLink}\\n• Join the community: {communityLink}\\n\\n**Need Help?**\\nOur support team is here to help at {supportEmail}\\n\\nBest regards,\\n{teamName}\",\"recipients\":\"{userEmail}\",\"variables\":{\"userName\":\"New User\",\"platformName\":\"Vegvisr\",\"userEmail\":\"newuser@example.com\",\"profileLink\":\"https://vegvisr.org/profile\",\"featuresLink\":\"https://vegvisr.org/features\",\"communityLink\":\"https://vegvisr.org/community\",\"supportEmail\":\"support@vegvisr.org\",\"teamName\":\"The Vegvisr Team\"}}","bibl":[],"imageWidth":"100%","imageHeight":"100%","visible":true,"path":null}]',
  '[]',
  'Email Templates',
  'Ideal for onboarding new users. Use the AI generator to create welcome emails for different user types, subscription levels, or platform features. Describe your platform and target audience for personalized welcome messages.'
);

-- Verify the templates were added
SELECT id, name, category FROM graphTemplates WHERE category = 'Email Templates';
