# BlogView System Description (C4 Model)

## 1. System Context Diagram (Level 1)

The **BlogView** is part of the Vegvisr Frontend application, providing users with an interface to browse, search, and interact with blog posts. It communicates directly with the Vegvisr Backend API to retrieve and manage blog content. Users can view blog posts, while authenticated Admin or Superadmin users have additional privileges to manage blog posts.

**Primary interactions:**

- End-users view and search blog posts.
- Admin/Superadmin users manage blog post visibility, editing, and deletion.

## 2. Container Diagram (Level 2)

The **BlogView** resides within the Vegvisr Frontend container, a Vue.js-based Single Page Application (SPA). It interacts with the Vegvisr Backend API container via HTTP requests, leveraging RESTful endpoints for CRUD operations on blog posts. State management is handled through Pinia stores (`userStore` and `blogStore`).

**Containers involved:**

- **Vegvisr Frontend (SPA)**: Hosts the BlogView component.
- **Vegvisr Backend API**: Provides RESTful endpoints for blog data.

## 3. Component Diagram (Level 3)

The **BlogView** component comprises several sub-components and functionalities:

- **Search Bar**: Allows users to filter blog posts by title.
- **Blog Post List**: Displays blog posts in a paginated grid layout, including title, snippet, and images.
- **Pagination Controls**: Enables navigation through multiple pages of blog posts.
- **Visibility Toggle**: Admin/Superadmin users can toggle between viewing hidden and visible blog posts.
- **Blog Post Actions**: Authenticated Admin/Superadmin users can edit, delete, or toggle visibility of individual blog posts.

**Interactions with Pinia stores:**

- `userStore`: Determines user authentication status and roles.
- `blogStore`: Manages blog post data retrieval and state.

## 4. Code Diagram (Level 4)

The **BlogView** component is implemented using Vue.js Composition API, utilizing reactive state (`ref`, `computed`) and lifecycle hooks (`onMounted`). It interacts with Pinia stores (`userStore`, `blogStore`) for centralized state management. HTTP requests are made using JavaScript's native `fetch` API to communicate with backend endpoints.

**Key implementation details:**

- **Reactive State**: Manages UI state such as search queries, pagination, and visibility toggles.
- **Computed Properties**: Dynamically filter and paginate blog posts based on user input.
- **Lifecycle Hooks**: Fetch initial blog data upon component mounting.
- **Event Handlers**: Handle user interactions such as toggling visibility, editing, deleting, and viewing blog posts.

### Example Code Snippet:

```vue
// Toggle between showing visible and hidden posts function toggleHiddenPosts() {
showHiddenPosts.value = !showHiddenPosts.value blogStore.fetchBlogPosts(showHiddenPosts.value) }
```

This structured approach ensures clear separation of concerns, maintainability, and scalability within the Vegvisr Frontend application.
