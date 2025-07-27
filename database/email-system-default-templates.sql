-- Email System Default Templates
-- Phase 1: Core Infrastructure
-- Rollback ID: phase1-db-schema-2025-07-27

-- Default Chat Invitation Template (English)
INSERT INTO email_templates (
    id, 
    template_name, 
    template_type, 
    language_code, 
    subject, 
    body, 
    variables, 
    is_default, 
    created_by
) VALUES (
    'default-chat-invitation-en',
    'Chat Room Invitation (English)',
    'chat_invitation',
    'en',
    'You''ve been invited to join a chat room on Vegvisr',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Room Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 You''re Invited!</h1>
        <p>Join the conversation on Vegvisr</p>
    </div>
    
    <div class="content">
        <h2>Hello {recipientName}!</h2>
        
        <p><strong>{inviterName}</strong> has invited you to join the chat room <strong>"{roomName}"</strong> on Vegvisr.</p>
        
        <div class="message-box">
            <strong>Personal Message:</strong><br>
            {invitationMessage}
        </div>
        
        <p>Click the button below to join the room and start chatting:</p>
        
        <div style="text-align: center;">
            <a href="{invitationLink}" class="button">Join Chat Room</a>
        </div>
        
        <p><strong>What is Vegvisr?</strong><br>
        Vegvisr is a platform for creating and sharing knowledge graphs, connecting ideas, and building communities around shared interests.</p>
        
        <p><strong>What happens next?</strong><br>
        - Click the button above to join the room<br>
        - If you''re not registered, you''ll be guided through a quick registration process<br>
        - Once registered, you''ll automatically be added to the chat room<br>
        - Start chatting with other members!</p>
        
        <p><em>This invitation expires in 7 days.</em></p>
    </div>
    
    <div class="footer">
        <p>This invitation was sent from Vegvisr.org<br>
        If you have any questions, please contact the room owner.</p>
    </div>
</body>
</html>',
    '["{recipientName}", "{inviterName}", "{roomName}", "{invitationMessage}", "{invitationLink}"]',
    1,
    'system'
);

-- Default Chat Invitation Template (Turkish)
INSERT INTO email_templates (
    id, 
    template_name, 
    template_type, 
    language_code, 
    subject, 
    body, 
    variables, 
    is_default, 
    created_by
) VALUES (
    'default-chat-invitation-tr',
    'Chat Room Invitation (Turkish)',
    'chat_invitation',
    'tr',
    'Vegvisr''de bir sohbet odasına davet edildiniz',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sohbet Odası Daveti</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Davet Edildiniz!</h1>
        <p>Vegvisr''de sohbete katılın</p>
    </div>
    
    <div class="content">
        <h2>Merhaba {recipientName}!</h2>
        
        <p><strong>{inviterName}</strong> sizi Vegvisr''deki <strong>"{roomName}"</strong> sohbet odasına davet ediyor.</p>
        
        <div class="message-box">
            <strong>Kişisel Mesaj:</strong><br>
            {invitationMessage}
        </div>
        
        <p>Sohbet odasına katılmak ve sohbete başlamak için aşağıdaki butona tıklayın:</p>
        
        <div style="text-align: center;">
            <a href="{invitationLink}" class="button">Sohbet Odasına Katıl</a>
        </div>
        
        <p><strong>Vegvisr nedir?</strong><br>
        Vegvisr, bilgi grafikleri oluşturma ve paylaşma, fikirleri bağlama ve ortak ilgi alanları etrafında topluluklar oluşturma platformudur.</p>
        
        <p><strong>Sırada ne var?</strong><br>
        - Yukarıdaki butona tıklayarak odaya katılın<br>
        - Kayıtlı değilseniz, hızlı bir kayıt sürecinden geçeceksiniz<br>
        - Kayıt olduktan sonra otomatik olarak sohbet odasına ekleneceksiniz<br>
        - Diğer üyelerle sohbete başlayın!</p>
        
        <p><em>Bu davet 7 gün sonra sona erer.</em></p>
    </div>
    
    <div class="footer">
        <p>Bu davet Vegvisr.org''dan gönderildi<br>
        Sorularınız varsa lütfen oda sahibiyle iletişime geçin.</p>
    </div>
</body>
</html>',
    '["{recipientName}", "{inviterName}", "{roomName}", "{invitationMessage}", "{invitationLink}"]',
    1,
    'system'
);

-- Default Chat Invitation Template (German)
INSERT INTO email_templates (
    id, 
    template_name, 
    template_type, 
    language_code, 
    subject, 
    body, 
    variables, 
    is_default, 
    created_by
) VALUES (
    'default-chat-invitation-de',
    'Chat Room Invitation (German)',
    'chat_invitation',
    'de',
    'Sie wurden zu einem Chat-Raum auf Vegvisr eingeladen',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat-Raum Einladung</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Sie sind eingeladen!</h1>
        <p>Treten Sie dem Gespräch auf Vegvisr bei</p>
    </div>
    
    <div class="content">
        <h2>Hallo {recipientName}!</h2>
        
        <p><strong>{inviterName}</strong> hat Sie eingeladen, dem Chat-Raum <strong>"{roomName}"</strong> auf Vegvisr beizutreten.</p>
        
        <div class="message-box">
            <strong>Persönliche Nachricht:</strong><br>
            {invitationMessage}
        </div>
        
        <p>Klicken Sie auf den Button unten, um dem Raum beizutreten und mit dem Chatten zu beginnen:</p>
        
        <div style="text-align: center;">
            <a href="{invitationLink}" class="button">Chat-Raum Beitreten</a>
        </div>
        
        <p><strong>Was ist Vegvisr?</strong><br>
        Vegvisr ist eine Plattform zum Erstellen und Teilen von Wissensgraphen, zum Verbinden von Ideen und zum Aufbau von Gemeinschaften um gemeinsame Interessen.</p>
        
        <p><strong>Was passiert als nächstes?</strong><br>
        - Klicken Sie auf den Button oben, um dem Raum beizutreten<br>
        - Wenn Sie nicht registriert sind, werden Sie durch einen schnellen Registrierungsprozess geführt<br>
        - Nach der Registrierung werden Sie automatisch dem Chat-Raum hinzugefügt<br>
        - Beginnen Sie mit dem Chatten mit anderen Mitgliedern!</p>
        
        <p><em>Diese Einladung läuft in 7 Tagen ab.</em></p>
    </div>
    
    <div class="footer">
        <p>Diese Einladung wurde von Vegvisr.org gesendet<br>
        Bei Fragen wenden Sie sich bitte an den Raum-Besitzer.</p>
    </div>
</body>
</html>',
    '["{recipientName}", "{inviterName}", "{roomName}", "{invitationMessage}", "{invitationLink}"]',
    1,
    'system'
);

-- Default Chat Invitation Template (Spanish)
INSERT INTO email_templates (
    id, 
    template_name, 
    template_type, 
    language_code, 
    subject, 
    body, 
    variables, 
    is_default, 
    created_by
) VALUES (
    'default-chat-invitation-es',
    'Chat Room Invitation (Spanish)',
    'chat_invitation',
    'es',
    'Has sido invitado a unirse a una sala de chat en Vegvisr',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitación a Sala de Chat</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 ¡Has sido invitado!</h1>
        <p>Únete a la conversación en Vegvisr</p>
    </div>
    
    <div class="content">
        <h2>¡Hola {recipientName}!</h2>
        
        <p><strong>{inviterName}</strong> te ha invitado a unirte a la sala de chat <strong>"{roomName}"</strong> en Vegvisr.</p>
        
        <div class="message-box">
            <strong>Mensaje Personal:</strong><br>
            {invitationMessage}
        </div>
        
        <p>Haz clic en el botón de abajo para unirte a la sala y comenzar a chatear:</p>
        
        <div style="text-align: center;">
            <a href="{invitationLink}" class="button">Unirse a la Sala de Chat</a>
        </div>
        
        <p><strong>¿Qué es Vegvisr?</strong><br>
        Vegvisr es una plataforma para crear y compartir grafos de conocimiento, conectar ideas y construir comunidades alrededor de intereses compartidos.</p>
        
        <p><strong>¿Qué pasa después?</strong><br>
        - Haz clic en el botón de arriba para unirte a la sala<br>
        - Si no estás registrado, serás guiado a través de un proceso de registro rápido<br>
        - Una vez registrado, serás automáticamente añadido a la sala de chat<br>
        - ¡Comienza a chatear con otros miembros!</p>
        
        <p><em>Esta invitación expira en 7 días.</em></p>
    </div>
    
    <div class="footer">
        <p>Esta invitación fue enviada desde Vegvisr.org<br>
        Si tienes alguna pregunta, por favor contacta al propietario de la sala.</p>
    </div>
</body>
</html>',
    '["{recipientName}", "{inviterName}", "{roomName}", "{invitationMessage}", "{invitationLink}"]',
    1,
    'system'
); 