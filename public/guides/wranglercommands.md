https://developers.cloudflare.com/d1/best-practices/local-development/

npx wrangler deploy --config=main-worker/wrangler.toml

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE config ADD COLUMN email BOOLEAN;" --config main-worker/wrangler.toml --remote

wrangler d1 execute vegvisr_org --command "INSERT INTO config (user_id, data, profileimage) VALUES ('testuser', 'This is a test', 'https://vegvisr.org/tah12have/tah.png');" --remote --config=main-worker/wrangler.toml

> >

npx wrangler d1 execute vegvisr_org --command "SELECT \* FROM config;" --json --remote --config=main-worker/wrangler.toml

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='config';" --json

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE config ADD COLUMN bio TEXT;" --config main-worker/wrangler.toml --remote

npx wrangler d1 execute vegvisr_org --command "ALTER TABLE config DROP COLUMN bioTEXT;" --config main-worker/wrangler.toml --remote

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "INSERT INTO config (user_id, data, profileimage, email, emailVerificationToken) VALUES ('tah12have', '{""profile"":{""username"":""tah12have"",""email"":""torarnehave@gmail.com"",""bio"":""Bio""},""settings"":{""darkMode"":false,""notifications"":true,""theme"":""dark""}}', 'https://vegvisr.org/tah12have/profileimage_413942ce-c942-4c15-91f7-cf997ee49326.png', 'torarnehave@gmail.com', '28f907da0a60357ab73d46f9c0cc5916df07f1af');"

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --command "CREATE TABLE config (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, profileimage TEXT, email TEXT, emailVerificationToken TEXT);"

//Create a wrangler command that is using a sql file to execute a command

npx wrangler d1 execute vegvisr_org --remote --config=main-worker/wrangler.toml --file=database/graphTemplates.sql
