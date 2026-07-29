# Auth Testing Playbook — DocuAnalytics AI

Custom email/password JWT auth integrated with an anonymous credit system + referral.

## Model
- Users are keyed by `user_id` (uuid). Anonymous users are created via POST /api/session (3 free credits).
- Registration UPGRADES the current anonymous user (preserving its credits) when `user_id` is passed, or creates a new account.
- JWT is a **Bearer token** returned in the JSON response (NOT httpOnly cookie). Frontend stores it in localStorage key `da_token` and sets `Authorization: Bearer <token>` on axios.
- Referral: `+5` credits to BOTH inviter and invitee when the invitee registers with `ref=<referral_code>`.

## Endpoints
- POST /api/auth/register  body: {email, password, name?, user_id?, ref?}  -> {token, user:{user_id,email,name,credits,referral_code}}
- POST /api/auth/login     body: {email, password}                          -> {token, user}
- GET  /api/auth/me        header: Authorization: Bearer <token>            -> {user}
- GET  /api/referral/{user_id}                                              -> {referral_code, invited_count, bonus_per_invite}

## Quick curl
```
B=http://localhost:8001/api
U=$(curl -s -X POST $B/session -d '{}' -H 'Content-Type: application/json' | python3 -c "import sys,json;print(json.load(sys.stdin)['user_id'])")
curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"a@b.it\",\"password\":\"secret123\",\"user_id\":\"$U\"}"
curl -s -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"email":"a@b.it","password":"secret123"}'
curl -s $B/auth/me -H "Authorization: Bearer <TOKEN>"
```

## Notes
- No admin role/seeding (not required by this app).
- Password min length 6; duplicate email -> 409; wrong credentials -> 401.
