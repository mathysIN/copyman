# Agent Instructions for Copyman

## Code Verification

**IMPORTANT:** When making code changes, do NOT run `npm run build` to verify the code. Instead, use:

```bash
npm run lint
```

The user handles the build process separately. Only use linting to check for TypeScript errors and code issues.

## E2EE Implementation Notes

### Authentication Flow

1. **Client-side key derivation**: Password is never sent raw to the server

   - `deriveAuthKey(password, createdAt)` - for authentication
   - `deriveEncKey(password, createdAt)` - for E2EE encryption (never leaves client)

2. **Server storage**: Only SHA256 hash of authKey is stored (64 characters)

   - Old format (128 chars SHA512) is no longer supported

3. **Session creation**: Client generates timestamp, derives keys, sends authKey

4. **Session joining**: Client receives `createdAt`, derives same keys

### Password Changes

- Changing password disables E2EE (encryption key becomes invalid)
- User must re-enable E2EE with new password
- Old encrypted content remains encrypted but inaccessible

## Backward Compatibility

- Legacy password format (128 chars) is NOT supported
- Sessions created before this update need to have passwords reset
- E2EE cannot be recovered for legacy sessions with password changes

## Security

- Never log or expose raw passwords
- Never send raw passwords to server
- Auth keys are already PBKDF2-derived (100k iterations)
- Session tokens are used for ongoing authentication
- Encryption keys never leave the client

## Redis / Database Queries

**⚠️ CRITICAL: NEVER perform write operations on production data.**  
**Only operate on `copyman:development:*` prefix. The dev will explicitly ask for production operations if needed.**

The project uses **Upstash Redis** (serverless Redis with REST API).

### Connection Details

- **URL**: From `.env` → `UPSTASH_REDIS_REST_URL`
- **Token**: From `.env` → `UPSTASH_REDIS_REST_TOKEN`
- **Production Key Prefix**: `copyman:production:session:` (read-only for agents)
- **Development Key Prefix**: `copyman:development:session:` (safe for testing)

### Query Session Data

Using curl with Upstash REST API:

```bash
# Get session data
URL="$UPSTASH_REDIS_REST_URL"
TOKEN="$UPSTASH_REDIS_REST_TOKEN"
SESSION="session_name"

curl -s "${URL}/hgetall/copyman:production:session:${SESSION}" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Key Patterns

- **Session data**: `copyman:production:session:{sessionId}` (hash)
- **Session token**: `copyman:production:token:{tokenHash}` → sessionId
- **Content**: `copyman:production:content:{sessionId}:{contentId}` (hash)

### Common Operations

```bash
# Delete a field from session
curl -s "${URL}/hdel/copyman:production:session:${SESSION}/password" \
  -H "Authorization: Bearer ${TOKEN}"

# Check if session exists
curl -s "${URL}/exists/copyman:production:session:${SESSION}" \
  -H "Authorization: Bearer ${TOKEN}"

# List all session keys
curl -s "${URL}/keys/copyman:production:session:*" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Note**: Upstash Redis returns data as arrays: `["field1", "value1", "field2", "value2"]`
