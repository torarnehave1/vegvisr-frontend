# Vegvisr Frontend

This project is a Cloudflare Worker-based application designed to handle user registration, email verification, and database interactions. It integrates with external APIs and Cloudflare's D1 database and R2 storage for managing user data and profile pictures.

## Features

- User registration with email verification.
- Resend email verification functionality.
- Check user existence and verification status.
- Reset user registration.
- Secure JWT token generation for user authentication.
- Integration with external APIs for user management.

## Project Structure

- **`wrangler.toml`**: Configuration file for the Cloudflare Worker, including bindings for D1 database, R2 bucket, and environment variables.
- **`index.js`**: Main worker script implementing API endpoints and business logic.

## Setup Instructions

1. **Install Wrangler CLI**:
   Install the Cloudflare Wrangler CLI by following the [official documentation](https://developers.cloudflare.com/workers/wrangler/).

2. **Configure Environment Variables**:
   Update the `wrangler.toml` file with your API keys, secrets, and database bindings.

3. **Deploy the Worker**:
   Use the following command to deploy the worker:

   ```bash
   wrangler publish
   ```

4. **Test Locally**:
   Run the worker locally using:
   ```bash
   wrangler dev
   ```

## API Endpoints

### `/sve2` (GET)

- **Description**: Registers a user by email.
- **Query Parameters**: `email`
- **Response**: Checks if the user exists and registers them if not.

### `/resend-verification` (POST)

- **Description**: Resends the email verification link.
- **Request Body**: `{ "email": "user@example.com" }`

### `/verify-email` (GET)

- **Description**: Verifies the user's email using a token.
- **Query Parameters**: `token`

### `/check-email` (GET)

- **Description**: Checks if a user exists and their verification status.
- **Query Parameters**: `email`

### `/reset-registration` (POST)

- **Description**: Resets a user's registration by deleting their record.
- **Request Body**: `{ "email": "user@example.com" }`

## Dependencies

- **UUID**: For generating unique identifiers.
- **Jose**: For handling JWT tokens.

## Notes

- Ensure that the `OPENAI_API_KEY`, `API_TOKEN`, and `JWT_SECRET` environment variables are securely stored and not exposed publicly.
- The database schema must include a `config` table with columns for `email`, `user_id`, `data`, and `emailVerificationToken`.

## License

This project is licensed under the MIT License.
