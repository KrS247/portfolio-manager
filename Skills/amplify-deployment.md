# Deploying a Next.js App to AWS Amplify Gen 1 SSR

A step-by-step guide for deploying a Next.js 14 App Router application — with Prisma, NextAuth v5, and Resend — to AWS Amplify Gen 1 SSR. Battle-tested on the Libryo Quotes app (ERM internal) — the troubleshooting table reflects every failure encountered during that deployment.

---

## Prerequisites

Before starting, have the following ready:

| Item | Libryo example | Your value |
|---|---|---|
| GitHub repo (public or Amplify GitHub App installed) | `github.com/Pete-Flynn-ERM/libryo-quotes` | — |
| AWS account with Amplify access | ERM sandbox account | — |
| PostgreSQL connection strings | RDS on `eu-north-1` | — |
| Resend API key (for email) | `re_...` from resend.com | — |
| Verified sending domain in Resend | `notifications.libryo.online` | — |
| Two random secrets for auth | generate below | — |

Generate your auth secrets:
```bash
openssl rand -base64 32   # use for AUTH_SECRET
openssl rand -base64 32   # use for NEXTAUTH_SECRET
```

---

## Step 1 — Prepare your codebase

### 1a. Add `amplify.yml` to the repo root

Amplify reads this file to know how to build your app. If it's missing, Amplify guesses and usually gets it wrong for SSR apps.

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 20                 # Next.js 14+ requires Node 18+; Amplify's default is older
        - npm ci --cache .npm --prefer-offline --legacy-peer-deps
        - npx prisma generate        # regenerate Prisma client for Lambda's OS
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - .next/cache/**/*
      - .npm/**/*
```

> **Why `nvm use 20`?**  
> Amplify Gen 1 defaults to Node 16. Next.js 14 requires Node 18+. Without this line the build either fails immediately or produces a Lambda that silently errors on startup.

> **Why `npx prisma generate` in preBuild?**  
> The Prisma client contains native binaries compiled for the build machine's OS. CodeBuild (Amazon Linux) ≠ your Mac, so the client must be regenerated during the build — not committed from your laptop.

> **Why `--legacy-peer-deps`?**  
> NextAuth v5 beta has peer dependency conflicts with some React versions. Remove this flag once your deps are clean.

### 1b. Add all server-side env vars to `next.config.mjs`

This is the single most important step for Amplify Gen 1 SSR.

**The problem:** Amplify Gen 1 deploys SSR pages as Lambda functions. Unlike Amplify Gen 2 or Vercel, it does **not** inject environment variables into the Lambda runtime at all — not even ones you set in the Amplify Console. The Lambda runs with no env vars unless you explicitly bake them in.

**The fix:** List every server-side env var in the `env` block of `next.config.mjs`. Next.js replaces `process.env.FOO` with the literal value at build time, so the Lambda doesn't need runtime injection.

```javascript
// next.config.mjs
const nextConfig = {
  env: {
    // Add every server-side env var your app reads at runtime.
    // None of these should be NEXT_PUBLIC_ — those go in the build env directly.
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,          // only needed with pgBouncer
    RESEND_SMTP_PASSWORD: process.env.RESEND_SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  },
  // ... rest of your config
};
```

> **⚠ Amplify Secrets (SSM Parameter Store) will NOT work here.**  
> Amplify Secrets inject values as env vars during the CodeBuild build phase only. They are not available to the Lambda runtime. Treat them the same as Environment Variables for this purpose — they still need the `next.config.mjs` entry.

### 1c. If you're writing `middleware.ts`, pass `secureCookie` to `getToken()`

On HTTPS, NextAuth names the session cookie `__Secure-authjs.session-token`. Without the `secureCookie` flag, `getToken()` looks for `authjs.session-token` — the wrong name — and always returns null, making every request appear unauthenticated.

```typescript
// middleware.ts
const isSecure = req.nextUrl.protocol === "https:";
const token = await getToken({
  req,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  secureCookie: isSecure,   // required on HTTPS — without this getToken always returns null
});
```

### 1d. If you're building a custom Credentials provider, always hash tokens before the Prisma lookup

NextAuth v5 (`@auth/core`) stores verification tokens as `SHA256(rawToken + AUTH_SECRET)` — not the raw token. If your Credentials provider looks up tokens directly in Prisma (e.g. to prevent email scanners consuming tokens), you must hash first:

```typescript
async function hashToken(token: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${token}${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// In your authorize callback:
const hashed = await hashToken(rawToken, process.env.AUTH_SECRET ?? "");
const vt = await prisma.verificationToken.delete({
  where: { identifier_token: { identifier: email, token: hashed } },
});
```

> Source: `node_modules/@auth/core/lib/actions/signin/send-token.js` line 63.

---

## Step 2 — Set up the Amplify app in the AWS Console

1. Go to **AWS Console → Amplify**
2. Click **"Create new app"**
3. Choose **"Host web app"**
4. Select **GitHub** as the source → authorise Amplify (install the GitHub App if prompted)
5. Choose your repository and branch (`main`)
6. **App settings:**
   - Framework: **Next.js — SSR** (Amplify should auto-detect this)
   - Build command: leave blank (Amplify will read `amplify.yml`)
   - Build output directory: `.next`
7. Click **"Save and deploy"** — this triggers the first build (it will fail if you haven't added env vars yet; that's fine, cancel it and proceed to Step 3)

---

## Step 3 — Add environment variables in the Amplify Console

Go to **App settings → Environment variables** and add all of these:

| Variable | Value | Notes |
|---|---|---|
| `AUTH_SECRET` | 32-byte base64 string | Never expose this |
| `NEXTAUTH_SECRET` | same value as AUTH_SECRET | NextAuth reads both |
| `AUTH_URL` | `https://main.xxxxxxxx.amplifyapp.com` | Your Amplify URL |
| `AUTH_TRUST_HOST` | `true` | Required behind Amplify's reverse proxy |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Full connection string |
| `DIRECT_URL` | same as DATABASE_URL | Only differs if using pgBouncer (Supabase) |
| `RESEND_SMTP_PASSWORD` | `re_...` | Your Resend API key |
| `EMAIL_FROM` | `App Name <noreply@yourdomain.com>` | Must match verified Resend domain |

> **Variable name typos cause silent failures.** Add the startup diagnostic from Step 4 and check it after deploy — any `false` means that variable didn't reach Lambda. Check its name and the `next.config.mjs` entry.

> **Do NOT use "Secrets" for runtime variables.** Amplify Secrets inject at build time only. Use plain Environment Variables here.

---

## Step 4 — First deployment

1. In the Amplify Console, click **"Run build"** (or push a commit — either triggers a build)
2. Watch the build log. The **Provision → Build → Deploy** pipeline should all go green
3. Build time is typically 3–5 minutes on a warm cache, 6–8 minutes cold

**What a successful build log looks like:**
```
[Prisma] Generated Prisma Client (v7.x.x)
[Next.js] Creating an optimized production build...
[Next.js] Compiled successfully
```

**How to verify env vars reached Lambda** — add a startup diagnostic to your app (e.g. near the top of your auth config or in a server-side entry point):

```typescript
console.log("[startup] env check:", {
  AUTH_SECRET: !!process.env.AUTH_SECRET,
  DATABASE_URL: !!process.env.DATABASE_URL,
  // add your own vars here
});
```

After deploying, open **Amplify → Monitoring → Function logs** (or CloudWatch). Look for your `[startup] env check` line — every value should be `true`. Any `false` means that variable either isn't in the Amplify Console env vars or isn't in the `next.config.mjs` `env` block.

---

## Step 5 — Verify the deployment end-to-end

Run through this checklist after every initial deploy:

- [ ] App loads at `https://main.xxxxxxxx.amplifyapp.com`
- [ ] Unauthenticated routes redirect to your login page
- [ ] Entering your email on the login page sends a magic link email
- [ ] Email arrives from the `EMAIL_FROM` address you configured
- [ ] Clicking the email link triggers the sign-in flow (via a confirm page or directly, depending on your implementation)
- [ ] Sign-in completes and you are authenticated
- [ ] A protected route is accessible and your session persists on refresh
- [ ] Lambda logs show no errors for a normal page load

---

## Troubleshooting

### Reference: known failure modes

| Symptom | Root cause | Fix |
|---|---|---|
| `RESEND_SMTP_PASSWORD: false` in Lambda logs | Var not in `next.config.mjs` `env` block | Add `RESEND_SMTP_PASSWORD: process.env.RESEND_SMTP_PASSWORD` to the env block; redeploy |
| Any env var shows `false` in logs | Same as above | Same fix |
| Email arrives but link says "sign-in link is no longer valid" | Email scanner (Microsoft ATP) consumed the token | Implement confirm-page pattern — link goes to `/confirm`, not directly to the auth callback |
| Sign-in button on `/confirm` shows `error=Verification` | NextAuth stores hashed tokens; raw token lookup fails with P2025 | Add `hashToken()` and hash before Prisma lookup (see Step 1d) |
| Sign-in succeeds but you are immediately redirected back to the login page | Middleware `getToken()` reads wrong cookie name on HTTPS | Add `secureCookie: req.nextUrl.protocol === "https:"` to `getToken()` call (see Step 1c) |
| Build fails: `prisma generate` errors | Wrong Node version or missing peer deps | Ensure Node ≥ 18 in Amplify settings; add `--legacy-peer-deps` to `npm ci` |
| Build succeeds but runtime errors with Prisma | Native binary mismatch (Mac client committed to repo) | Never commit `src/generated/prisma` — add it to `.gitignore` and regenerate in `preBuild` |
| `AUTH_TRUST_HOST` not working (CSRF errors) | Missing or false | Set `AUTH_TRUST_HOST=true` in both Amplify Console and `next.config.mjs` env block |

### How to force a clean rebuild

If a build seems to use stale env vars:
1. In Amplify Console → **Hosting** → click your app
2. Go to **Build settings** → **Clear cache**
3. Then trigger a new build

Alternatively, pushing a new commit always triggers a fresh build that reads the current env var values from the Console.

---

The patterns in Steps 1b–1d should be applied wherever your project handles auth config, middleware, and email callbacks respectively.
