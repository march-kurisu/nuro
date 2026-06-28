# Auth Testing Playbook (Emergent Google OAuth + Email/Password)

## Backend Endpoints
- POST `/api/auth/register` { email, password, name } → returns { token, user }
- POST `/api/auth/login` { email, password } → returns { token, user }
- POST `/api/auth/google/session` { session_id } → exchanges Emergent session_id → returns { token, user }
- GET  `/api/auth/me` → returns user (uses Bearer token)
- POST `/api/auth/logout` → invalidates session

## Manual cURL Test (Email/Password)
```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Register
curl -s -X POST "$API/api/auth/register" -H "Content-Type: application/json" \
  -d '{"email":"test@learn.app","password":"Test1234!","name":"Test User"}'

# Login
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"test@learn.app","password":"Test1234!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Me
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Manual Test User in MongoDB (for browser auth)
```bash
mongosh test_database --eval "
var userId = 'user_' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.'+Date.now()+'@example.com',
  name: 'Test User',
  picture: '',
  auth_provider: 'google',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('TOKEN: ' + sessionToken);
"
```

## Notes
- Both auth methods produce the same `session_token` (Bearer) stored in `user_sessions`.
- Email/password uses bcrypt, password_hash stored on user record. Google users have no password_hash.
- Test credentials are tracked in /app/memory/test_credentials.md
