-- Email Templates Migration SQL
-- Migrating templates from graphTemplates to email_templates

-- Template 1: Chat Invitation
INSERT INTO email_templates (
  id, 
  template_name, 
  template_type, 
  language_code, 
  subject, 
  body, 
  variables, 
  is_default, 
  created_by, 
  is_active
) VALUES (
  'migrated_basic_chat_invitation_template',
  'Chat Invitation Template',
  'chat_invitation',
  'en',
  'You are invited to join {roomName}',
  'Hello!

{senderName} has invited you to join the chat room "{roomName}".

{roomDescription}

Click the link below to accept the invitation:
{invitationLink}

This invitation will expire on {expirationDate}.

Best regards,
Vegvisr Team',
  '["roomName","senderName","roomDescription","inviteeEmail","invitationLink","expirationDate"]',
  1,
  'migration_script',
  1
);

-- Template 2: Project Update
INSERT INTO email_templates (
  id, 
  template_name, 
  template_type, 
  language_code, 
  subject, 
  body, 
  variables, 
  is_default, 
  created_by, 
  is_active
) VALUES (
  'migrated_project_update_notification',
  'Project Update Notification',
  'project_update',
  'en',
  'Project Update: {projectName} - {updateType}',
  'Hi {recipientName},

We have an important update regarding the {projectName} project.

**Update Type:** {updateType}
**Status:** {projectStatus}
**Next Milestone:** {nextMilestone}

**Details:**
{updateDetails}

**Action Required:**
{actionRequired}

If you have any questions, please do not hesitate to reach out.

Best regards,
{senderName}
{senderTitle}',
  '["projectName","updateType","projectStatus","nextMilestone","updateDetails","actionRequired","recipientName","teamEmail","senderName","senderTitle"]',
  1,
  'migration_script',
  1
);

-- Template 3: Welcome Email
INSERT INTO email_templates (
  id, 
  template_name, 
  template_type, 
  language_code, 
  subject, 
  body, 
  variables, 
  is_default, 
  created_by, 
  is_active
) VALUES (
  'migrated_welcome_email_template',
  'Welcome Email Template',
  'welcome',
  'en',
  'Welcome to {platformName}, {userName}!',
  'Dear {userName},

Welcome to {platformName}! We are excited to have you join our community.

**Getting Started:**
• Complete your profile: {profileLink}
• Explore our features: {featuresLink}
• Join the community: {communityLink}

**Need Help?**
Our support team is here to help at {supportEmail}

Best regards,
{teamName}',
  '["userName","platformName","userEmail","profileLink","featuresLink","communityLink","supportEmail","teamName"]',
  1,
  'migration_script',
  1
);
