/**
 * Email Templates Migration Script
 * Migrates email templates from graphTemplates to email_templates table
 */

// Migration data extracted from graphTemplates
const emailTemplatesMigrationData = [
  {
    name: "Basic Chat Invitation Template",
    data: {
      "templateName": "Chat Invitation Template",
      "subject": "You are invited to join {roomName}",
      "body": "Hello!\n\n{senderName} has invited you to join the chat room \"{roomName}\".\n\n{roomDescription}\n\nClick the link below to accept the invitation:\n{invitationLink}\n\nThis invitation will expire on {expirationDate}.\n\nBest regards,\nVegvisr Team",
      "recipients": "{inviteeEmail}",
      "variables": {
        "roomName": "Demo Chat Room",
        "senderName": "John Doe",
        "roomDescription": "A collaborative space for team discussions and project updates.",
        "inviteeEmail": "user@example.com",
        "invitationLink": "https://vegvisr.org/chat/join/abc123",
        "expirationDate": "July 30, 2025"
      }
    }
  },
  {
    name: "Project Update Notification",
    data: {
      "templateName": "Project Update Notification",
      "subject": "Project Update: {projectName} - {updateType}",
      "body": "Hi {recipientName},\n\nWe have an important update regarding the {projectName} project.\n\n**Update Type:** {updateType}\n**Status:** {projectStatus}\n**Next Milestone:** {nextMilestone}\n\n**Details:**\n{updateDetails}\n\n**Action Required:**\n{actionRequired}\n\nIf you have any questions, please do not hesitate to reach out.\n\nBest regards,\n{senderName}\n{senderTitle}",
      "recipients": "{teamEmail}",
      "variables": {
        "projectName": "Vegvisr Platform",
        "updateType": "Weekly Progress Update",
        "projectStatus": "On Track",
        "nextMilestone": "Beta Release - August 15, 2025",
        "updateDetails": "Frontend development is progressing well. Email template system has been successfully implemented.",
        "actionRequired": "Please review the latest design mockups in the shared folder.",
        "recipientName": "Team Member",
        "teamEmail": "team@example.com",
        "senderName": "Project Manager",
        "senderTitle": "Development Team Lead"
      }
    }
  },
  {
    name: "Welcome Email Template",
    data: {
      "templateName": "Welcome Email Template",
      "subject": "Welcome to {platformName}, {userName}!",
      "body": "Dear {userName},\n\nWelcome to {platformName}! We are excited to have you join our community.\n\n**Getting Started:**\n• Complete your profile: {profileLink}\n• Explore our features: {featuresLink}\n• Join the community: {communityLink}\n\n**Need Help?**\nOur support team is here to help at {supportEmail}\n\nBest regards,\n{teamName}",
      "recipients": "{userEmail}",
      "variables": {
        "userName": "New User",
        "platformName": "Vegvisr",
        "userEmail": "newuser@example.com",
        "profileLink": "https://vegvisr.org/profile",
        "featuresLink": "https://vegvisr.org/features",
        "communityLink": "https://vegvisr.org/community",
        "supportEmail": "support@vegvisr.org",
        "teamName": "The Vegvisr Team"
      }
    }
  }
];

// Generate SQL commands for migration
function generateMigrationSQL() {
  const insertCommands = [];
  const deleteCommands = [];

  emailTemplatesMigrationData.forEach((template, index) => {
    const data = template.data;

    // Generate unique ID
    const id = `migrated_${template.name.toLowerCase().replace(/\s+/g, '_')}`;

    // Extract template type from name
    let templateType = 'general';
    if (template.name.includes('Chat Invitation')) templateType = 'chat_invitation';
    if (template.name.includes('Project Update')) templateType = 'project_update';
    if (template.name.includes('Welcome')) templateType = 'welcome';

    // Extract variable names from the variables object
    const variableNames = Object.keys(data.variables);

    // Create INSERT command for email_templates
    const insertSQL = `INSERT INTO email_templates (
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
      '${id}',
      '${data.templateName}',
      '${templateType}',
      'en',
      '${data.subject.replace(/'/g, "''")}',
      '${data.body.replace(/'/g, "''").replace(/\n/g, '\\n')}',
      '${JSON.stringify(variableNames).replace(/'/g, "''")}',
      1,
      'migration_script',
      1
    );`;

    insertCommands.push(insertSQL);
  });

  // Delete commands for graphTemplates cleanup
  deleteCommands.push(`DELETE FROM graphTemplates WHERE category = 'Email Templates';`);

  return { insertCommands, deleteCommands };
}

// Generate and display the SQL commands
const { insertCommands, deleteCommands } = generateMigrationSQL();

console.log('=== EMAIL TEMPLATES MIGRATION ===\n');

console.log('1. INSERT COMMANDS FOR email_templates:');
console.log('=====================================');
insertCommands.forEach((cmd, index) => {
  console.log(`-- Template ${index + 1}`);
  console.log(cmd);
  console.log('');
});

console.log('\n2. CLEANUP COMMANDS FOR graphTemplates:');
console.log('=======================================');
deleteCommands.forEach(cmd => {
  console.log(cmd);
});

console.log('\n=== MIGRATION COMPLETE ===');
