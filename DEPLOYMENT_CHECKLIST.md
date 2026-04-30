# Deployment Checklist - Vercel + Neon PostgreSQL

Complete these steps in order to deploy your application to production.

## ✅ Step 1: Create GitHub Repository

If you haven't already, create a GitHub repository and push your code:

```bash
# If repo doesn't exist on GitHub yet, create it at github.com/new
# Then set up remote and push:
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/YOUR_USERNAME/don.git
git branch -M main
git push -u origin main
git push -u origin claude/complete-previous-tasks-rzcSp
```

**Note:** Replace `YOUR_USERNAME` with your actual GitHub username.

## ✅ Step 2: Create Neon PostgreSQL Project

1. Visit **https://console.neon.tech/**
2. Sign up with GitHub or Email
3. Create a new project
   - Choose region closest to your deployment location
   - PostgreSQL version: 15 (recommended)
4. Copy the **Connection String** (looks like):
   ```
   postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/neondb
   ```
5. Keep this URL safe - you'll need it for Vercel

## ✅ Step 3: Generate New AUTH_SECRET

Generate a strong secret for production:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output - you'll need this for Vercel environment variables.

## ✅ Step 4: Set Up Your AI Provider

Choose ONE of these options:

### Option A: Google Gemini (Recommended - Free)
1. Visit **https://aistudio.google.com/apikey**
2. Click "Get API Key"
3. Create new API key
4. Copy the key

### Option B: Groq (Free, Fast)
1. Visit **https://console.groq.com/keys**
2. Create new API key
3. Copy the key

### Option C: Anthropic Claude (Paid)
1. Visit **https://console.anthropic.com/settings/keys**
2. Create new API key
3. Copy the key

## ✅ Step 5: Deploy to Vercel

### 5a. Create Vercel Account
1. Visit **https://vercel.com**
2. Sign up with GitHub account
3. Authorize GitHub access

### 5b. Import Project
1. Go to https://vercel.com/new
2. Select your GitHub repository (`zzzz212/don`)
3. Click "Import"

### 5c. Configure Environment Variables
In the Vercel dashboard, add these environment variables:

```
DATABASE_URL = postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/neondb
AUTH_SECRET = (paste the generated secret from Step 3)
AUTH_TRUST_HOST = true
DEMO_MODE = false

# Choose ONE:
GEMINI_API_KEY = (your Google API key)
# OR
GROQ_API_KEY = (your Groq API key)
# OR
ANTHROPIC_API_KEY = (your Claude API key)

# Optional (only if you have DaData integration):
# DADATA_API_KEY = your-dadata-key
# DADATA_SECRET_KEY = your-dadata-secret
```

### 5d. Deploy
1. Click "Deploy"
2. Wait for build to complete (usually 2-3 minutes)
3. Vercel will automatically:
   - Run `prisma generate`
   - Run `prisma migrate deploy` (creates tables)
   - Build Next.js app
   - Deploy to production

## ✅ Step 6: Seed Legal Knowledge Base

After deployment completes, initialize the legal database one time:

```bash
curl -X POST https://your-deployment.vercel.app/api/admin/seed-legal \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "admin-secret-key"}'
```

**Note:** Replace `your-deployment` with your actual Vercel deployment URL.

## ✅ Step 7: Test Production

1. Visit your deployment URL
2. Test key functionality:
   - [ ] Home page loads
   - [ ] Counterparty search works (try INN 7714993037)
   - [ ] Document upload works
   - [ ] Chat analysis works
3. Check logs: Go to Vercel dashboard → Deployment → Logs

## 🔍 Troubleshooting

### "Build failed"
- Check Vercel logs for the specific error
- Ensure all environment variables are set
- Run locally: `npm run build` to test locally

### "Database connection failed"
- Verify DATABASE_URL is correct
- Check Neon project status (not paused)
- Ensure IP is whitelisted (Neon does this automatically for Vercel)

### "Migrations failed"
- Go to Neon console → Branches
- If there's a corrupted migration, delete and retry
- Check Vercel build logs for SQL error details

### "Environmental variable not found"
- Re-check all variable names in Vercel dashboard
- Redeploy after changes
- Wait 30 seconds for variables to be injected

## 📊 Monitoring

After deployment:
1. **Neon Dashboard**: Monitor database connections at https://console.neon.tech
2. **Vercel Analytics**: Track errors and performance in Vercel dashboard
3. **Enable Sentry (Optional)**: For error tracking
   ```
   SENTRY_AUTH_TOKEN=your-token
   ```

## 🎯 Next Steps

After deployment is successful:
1. Buy a custom domain and connect it to Vercel
2. Enable auto-deployments on all branches
3. Set up Sentry for production error monitoring
4. Configure DaData integration if using counterparty checks
5. Monitor Neon database performance

## 🆘 Need Help?

- **Neon Support**: https://neon.tech/docs or support@neon.tech
- **Vercel Support**: https://vercel.com/support
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs/
