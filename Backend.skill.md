# RePair Backend Coding Guidelines & Skills

This document outlines the coding standards, documentation patterns, and architectural guidelines for developing the RePair Backend API. AI assistants and developers should follow these rules strictly to maintain consistency.

## 1. Route Documentation (JSDoc Style)

Every route definition in the `routes/` directory **MUST** be documented using a specific JSDoc-style comment block directly above the route. This ensures consistency and makes it easy to understand the API surface at a glance.

### Format Requirement

```javascript
// @route   [HTTP_METHOD] [ENDPOINT_PATH]
// @desc    [Brief description of what the endpoint does]
// @access  [Public | Private | Admin]
```

### Examples

**Public Route (Direct Handler):**
```javascript
// @route   GET /api/health
// @desc    Check for status of server
// @access  Public
router.get('/health', (req, res) => {
    res.json({ message: 'Server is running' });
});
```

**Private Route (Controller Pattern):**
```javascript
// @route   GET /api/auth/me
// @desc    Get current user's full profile
// @access  Private
router.get('/me', protect, getMe);
```

## 2. Controller Pattern & Business Logic

- **Separation of Concerns**: Route files (`routes/`) should ONLY handle endpoint definitions and middleware attachment. All business logic **MUST** reside in the `controllers/` directory.
- **Async/Await**: All controller functions should be `async` and use `try/catch` blocks for error handling.
- **Consistent Responses**: Return appropriate HTTP status codes:
  - `200/201`: Success
  - `400`: Bad Request / Validation Error
  - `401`: Unauthorized (Missing/invalid token)
  - `404`: Resource Not Found
  - `500`: Server Error
- **Error Formatting**: Always return errors as JSON objects with a `message` property (e.g., `res.status(400).json({ message: 'Invalid credentials' })`).

## 3. Middleware Usage

- Custom middleware (like authentication checks) lives in the `middleware/` directory.
- The `protect` middleware should be injected into any route that requires a valid JWT. It securely attaches the decoded payload to `req.user`.

## 4. Mongoose Data Models

- Models belong in the `models/` directory.
- Schema definitions must include robust validation (e.g., `required: true`, `unique: true`).
- **Security Check**: When fetching documents to return to the client, always exclude sensitive fields like passwords (e.g., `.select('-password')`).

## 5. Environment Variables

- Never hardcode configuration strings or secrets (Database URIs, JWT Secrets, Frontend URLs).
- Use `process.env.VARIABLE_NAME`.
- If a new environment variable is introduced, it **must** be immediately documented in `.env.example`.
