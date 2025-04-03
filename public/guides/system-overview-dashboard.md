# System Overview for DashBoard FrontEnd and The Dash-Worker

## Frontend

- **Framework**: Vue.js 3
- **State Management**: Vuex
- **Styling**: Bootstrap 5
- **Build Tool**: Vite
- **Primary Language**: JavaScript/TypeScript
- **Key Components**:
  - `UserDashboard.vue`: Displays user profile, settings, and allows updates.
  - Vuex Store: Manages global state for user data (e.g., email, role).

## Backend

- **API**: RESTful API
- **Endpoints**:
  - `GET /userdata`: Fetches user data based on email.
  - `PUT /userdata`: Updates user data.
  - `POST /upload`: Handles profile image uploads.
  - `GET /get-role`: Retrieves user role based on email.
- **Primary Language**: JavaScript (Node.js)
- **Framework**: Hono (lightweight web framework)

## Workers

- **Platform**: Cloudflare Workers
- **Purpose**:
  - Handle API requests and routing.
  - Serve static assets.
  - Perform server-side rendering (if applicable).
- **Key Features**:
  - Error handling (`errorHandler`).
  - Not found handling (`notFoundHandler`).
  - Dynamic routing and middleware support.

## Storage

- **User Data**: Stored in a backend database (not specified in the code).
- **Profile Images**: Stored in Cloudflare R2.

## Deployment

- **Frontend**: Deployed as a static site (e.g., Cloudflare Pages or similar).
- **Backend**: Deployed as serverless functions using Cloudflare Workers.

## Key Features

- **User Management**:
  - Fetch and display user profile and settings.
  - Update user data and upload profile images.
- **Theming**:
  - Supports light and dark themes.
- **Clipboard Integration**:
  - Allows copying user secrets to the clipboard.

## Future Improvements

- Centralize more user data (e.g., `user_id`) in the Vuex store for better state management.
- Add unit and integration tests for critical components and API endpoints.
- Enhance error handling and logging for better debugging.
