https://developers.cloudflare.com/d1/best-practices/local-development/

npx wrangler deploy --config=main-worker/wrangler.toml

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE config ADD COLUMN email BOOLEAN;" --config main-worker/wrangler.toml --remote

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE graphTemplates ADD COLUMN category VARCHAR(50) DEFAULT 'General';" --config main-worker/wrangler.toml --remote

wrangler d1 execute vegvisr_org --command "INSERT INTO config (user_id, data, profileimage) VALUES ('testuser', 'This is a test', 'https://vegvisr.org/tah12have/tah.png');" --remote --config=main-worker/wrangler.toml

> > npx wrangler d1 execute vegvisr_org --command "SELECT \* FROM graphTemplates;" --json --remote --config=main-worker/wrangler.toml

npx wrangler d1 execute vegvisr_org --command "SELECT \* FROM config;" --json --remote --config=main-worker/wrangler.toml

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='config';" --json

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE config ADD COLUMN bio TEXT;" --config main-worker/wrangler.toml --remote

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE graphTemplates ADD COLUMN ai_instructions TEXT;" --config main-worker/wrangler.toml --remote

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE config DROP COLUMN bioTEXT;" --config main-worker/wrangler.toml --remote

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "INSERT INTO config (user_id, data, profileimage, email, emailVerificationToken) VALUES ('tah12have', '{""profile"":{""username"":""tah12have"",""email"":""torarnehave@gmail.com"",""bio"":""Bio""},""settings"":{""darkMode"":false,""notifications"":true,""theme"":""dark""}}', 'https://vegvisr.org/tah12have/profileimage_413942ce-c942-4c15-91f7-cf997ee49326.png', 'torarnehave@gmail.com', '28f907da0a60357ab73d46f9c0cc5916df07f1af');"

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "CREATE TABLE config (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, profileimage TEXT, email TEXT, emailVerificationToken TEXT);"

//Create a wrangler command that is using a sql file to execute a command

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --file=database/graphTemplates.sql

// List all D1 databases in your Cloudflare account
npx wrangler d1 list

// List all tables in a specific D1 database (replace vegvisr_org with your database name)
npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table';"

npx wrangler d1 execute vegvisr_org --command 'UPDATE graphTemplates SET ai_instructions = "{\"format\":\"YYYY-MM-DD: @username - Brief summary\\n\\nDetailed notes...\",\"requirements\":[\"date\",\"username\",\"summary\"],\"validation\":{\"date\":{\"pattern\":\"\\\\d{4}-\\\\d{2}-\\\\d{2}\",\"message\":\"Date must be in YYYY-MM-DD format\"},\"username\":{\"pattern\":\"@\\\\w+\",\"message\":\"Username must be prefixed with @\"},\"summary\":{\"minLength\":10,\"message\":\"Summary must be at least 10 characters\"}}}" WHERE type = "worknote";' --json --remote --config=main-worker/wrangler.toml
