# Authentication Provider Research

Comparison of free authentication providers for StreamTrack.

## Quick Recommendation

**🏆 Best Choice: Supabase Auth**
- Most generous free tier (50,000 MAU)
- Includes database (could migrate from D1)
- Good Cloudflare Workers integration
- Open source, no vendor lock-in

**🥈 Runner-up: Clerk**
- Best developer experience for React
- Pre-built UI components
- 10,000 MAU free tier
- Great for quick implementation

---

## Detailed Comparison

### 1. Supabase Auth

**Free Tier:**
- ✅ 50,000 monthly active users
- ✅ Unlimited total users
- ✅ All auth providers (Google, GitHub, etc.)
- ✅ Anonymous sign-ins
- ✅ Custom SMTP
- ✅ Basic MFA
- ⚠️ Projects pause after 1 week inactivity
- ⚠️ Branding in emails
- ⚠️ Limited to 2 active projects

**Pros:**
- Most generous MAU limit
- Includes PostgreSQL database (500MB)
- Open source (can self-host)
- Good documentation
- Edge Functions work with Cloudflare
- Row Level Security for data protection

**Cons:**
- Projects auto-pause (can be annoying)
- Need to keep project active
- Slightly more complex setup than Clerk

**Integration with Cloudflare Workers:**
```typescript
// Works well with JWT verification
import { createClient } from '@supabase/supabase-js'

export async function authenticate(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return user
}
```

**Best for:** Projects that want generous limits, open source, and might want to move DB to Supabase later

---

### 2. Clerk

**Free Tier:**
- ✅ 10,000 monthly active users
- ✅ 100 monthly active organizations
- ✅ Pre-built React components
- ✅ 3 social connections
- ✅ Custom domain
- ✅ Webhooks
- ❌ Cannot remove branding
- ❌ No MFA on free tier
- ❌ Fixed 7-day session duration

**Pros:**
- Best DX for React apps
- Beautiful pre-built components
- Drop-in solution (< 1 hour setup)
- Excellent documentation
- User/Organization management included
- Good Cloudflare Workers integration

**Cons:**
- Branding required on free tier
- Lower MAU limit (10k vs Supabase 50k)
- Slightly vendor lock-in

**Integration with Cloudflare Workers:**
```typescript
// Clerk provides helper for Workers
import { verifyToken } from '@clerk/backend'

export async function authenticate(request: Request, env: Env) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  const verified = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY
  })
  return verified
}
```

**Best for:** Fast implementation, great UI out of the box, React-focused projects

---

### 3. Firebase Authentication

**Free Tier:**
- ✅ Unlimited monthly active users
- ✅ Email/password, Google, phone, anonymous
- ✅ No branding requirements
- ✅ Generous quotas
- ⚠️ Google ecosystem

**Pros:**
- Unlimited users on free tier
- Very generous
- Mature, well-tested
- Good documentation
- Works everywhere
- Phone authentication included

**Cons:**
- Tied to Google ecosystem
- Heavier SDK
- More complex pricing for other services
- Not ideal with Cloudflare Workers (needs Firebase Admin SDK workaround)

**Integration with Cloudflare Workers:**
```typescript
// Requires manual JWT verification
import { verify } from 'jose'

export async function authenticate(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  // Verify JWT against Firebase public keys
  const verified = await verify(token, firebasePublicKey)
  return verified.payload
}
```

**Best for:** Projects already in Google ecosystem, need phone auth

---

### 4. Auth0

**Free Tier:**
- ✅ 7,500 monthly active users
- ✅ Social/enterprise connections
- ✅ MFA included
- ✅ No branding requirements
- ❌ Lower MAU limit

**Pros:**
- Enterprise-grade security
- MFA on free tier
- Universal Login
- Extensive documentation
- No branding

**Cons:**
- Lower MAU limit (7.5k)
- More complex for simple needs
- Okta acquisition concerns

**Best for:** Enterprise requirements, need MFA, complex auth flows

---

### 5. Cloudflare Access (Zero Trust)

**Free Tier:**
- ✅ 50 users free
- ✅ Native Cloudflare integration
- ✅ Works perfectly with Workers
- ❌ Very limited users on free tier

**Pros:**
- Native Cloudflare integration
- Zero Trust security
- Works seamlessly with Workers
- No external service needed

**Cons:**
- Only 50 free users (not suitable for public app)
- More for internal tools

**Best for:** Internal tools, team dashboards, admin panels

---

### 6. Kinde

**Free Tier:**
- ✅ 10,500 monthly active users (community plan)
- ✅ Unlimited applications
- ✅ Social + email auth
- ✅ Organizations included
- ⚠️ Newer, less mature

**Pros:**
- Generous free tier
- Modern API
- Good pricing model
- Organizations included

**Cons:**
- Newer company (less proven)
- Smaller community
- Less documentation than competitors

---

## Implementation Complexity

**Easiest → Hardest:**
1. **Clerk** - Pre-built components, drop-in solution (~1 hour)
2. **Supabase** - Good SDK, straightforward (~2-3 hours)
3. **Kinde** - Modern API, decent docs (~2-3 hours)
4. **Firebase** - Well-documented but complex (~3-4 hours)
5. **Auth0** - Flexible but complex config (~4-5 hours)

---

## Cost at Scale

Monthly Active Users pricing comparison:

| Users | Clerk | Supabase | Firebase | Auth0 | Kinde |
|-------|-------|----------|----------|-------|-------|
| 1K    | Free  | Free     | Free     | Free  | Free  |
| 10K   | Free  | Free     | Free     | $35   | Free  |
| 50K   | $249  | Free     | Free     | $175  | $50   |
| 100K  | $499  | $25*     | Free     | $350  | $100  |

\* Supabase charges for database/bandwidth, not MAU

---

## Recommendation for StreamTrack

### Primary Recommendation: **Supabase Auth**

**Why:**
1. ✅ 50,000 MAU free (plenty of headroom)
2. ✅ Could migrate D1 → Supabase Postgres later
3. ✅ Open source, no lock-in
4. ✅ Good Cloudflare Workers integration
5. ✅ Anonymous auth (let users try before signing up)
6. ✅ Social OAuth included

**Implementation Plan:**
```typescript
// 1. Frontend: Add Supabase client
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 2. Add login UI
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google'
})

// 3. Worker: Verify JWT
const token = request.headers.get('Authorization')?.replace('Bearer ', '')
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
const { data: { user }, error } = await supabase.auth.getUser(token)
```

**Migration Path:**
- Keep D1 for now
- Add Supabase Auth only
- Later: Could migrate to Supabase Postgres if needed

---

### Alternative: **Clerk** (if speed is priority)

**Why:**
1. ✅ Fastest implementation (< 1 hour)
2. ✅ Beautiful pre-built UI
3. ✅ 10,000 MAU sufficient for MVP
4. ✅ Great DX for React

**Tradeoff:**
- Lower MAU limit
- Branding required
- More vendor lock-in

---

## Decision Matrix

| Criteria | Supabase | Clerk | Firebase | Auth0 |
|----------|----------|-------|----------|-------|
| **Free MAU** | 50K ⭐ | 10K | Unlimited ⭐ | 7.5K |
| **Setup Time** | 2-3hr | 1hr ⭐ | 3-4hr | 4-5hr |
| **React DX** | Good | Excellent ⭐ | Fair | Fair |
| **CF Workers** | Good ⭐ | Good ⭐ | Fair | Good |
| **Open Source** | Yes ⭐ | No | No | No |
| **Branding Free** | Yes* | No | Yes | Yes |
| **Future Cost** | Low ⭐ | Medium | Low | High |

\* Email branding only

---

## Next Steps

1. **Decision:** Choose between Supabase (generous) or Clerk (fast)
2. **Setup:**
   - Create account
   - Configure OAuth providers (Google, GitHub)
   - Add environment variables to Workers
3. **Frontend:**
   - Add auth UI (login/signup buttons)
   - Protect API calls with JWT
   - Add user context to React
4. **Backend:**
   - Add auth middleware to Workers
   - Verify JWT on protected routes
   - Associate user ID with titles in database
5. **Database:**
   - Add user_id column to titles table
   - Filter titles by authenticated user
6. **Testing:**
   - Test auth flow
   - Verify data isolation between users

---

## Additional Considerations

### Rate Limiting Strategy
With auth, you can now:
- Limit imports per user (e.g., 100 titles max)
- Throttle API calls per user
- Prevent abuse

### User Data Model
```sql
-- Add to schema.sql
ALTER TABLE titles ADD COLUMN user_id TEXT;
CREATE INDEX idx_titles_user_id ON titles(user_id);

-- Filter queries by user
SELECT * FROM titles WHERE user_id = ?
```

### Anonymous Usage
Consider allowing limited anonymous usage:
- View demo data
- Import 3 titles without login
- "Sign up to track more" CTA
