# Did Hamza Play?

A small Next.js site that answers one question: **Did Hamza Choudhury play in his club's latest match?**

It uses API-Football for football data and Supabase/Postgres for a cached snapshot.

## 1. Accounts you need

You need:

1. API-Football account — free plan is enough for the prototype.
2. GitHub account — to store the code.
3. Vercel account — hosts the Next.js app.
4. Supabase account — hosts the Postgres database.
5. Optional: a domain such as `didhamzplay.com`.

You do NOT need to pay for hosting at the beginning.

## 2. API key

Create an API-Football account and copy the key from Account -> My Access.

Put it in your local `.env.local`:

```env
API_FOOTBALL_KEY=XXX
```

Do not commit this file.

## 3. Supabase

Create a new Supabase project.

Open SQL Editor and run `supabase/schema.sql`.

Then copy these values from Supabase:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

The service-role key is a secret. It must only be used on the server.

## 4. Local setup

Install Node.js 20+.

Then:

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and add the three secrets plus:

```env
PLAYER_NAME=Hamza Choudhury
PLAYER_ID=
CRON_SECRET=make-this-a-long-random-secret
```

Start the site:

```bash
npm run dev
```

Visit http://localhost:3000

The first page will be empty until you refresh the data.

## 5. First data refresh

Call the refresh endpoint with your secret:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/refresh
```

Then reload the homepage.

If player-name search selects the wrong player, find Hamza's API-Football player ID and set:

```env
PLAYER_ID=123456
```

## 6. GitHub

Create a new GitHub repository called `did-hamza-play`.

Push this project:

```bash
git init
git add .
git commit -m "Initial Did Hamza Play site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/did-hamza-play.git
git push -u origin main
```

## 7. Vercel

Import the GitHub repository into Vercel.

Add these Environment Variables in Vercel:

- `API_FOOTBALL_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `PLAYER_NAME`
- `PLAYER_ID` (optional)

Deploy.

## 8. Updating automatically

The free Vercel Hobby plan only supports daily cron execution. For this project, that is not ideal on matchdays.

The included GitHub Actions workflow is designed to call the refresh endpoint every 30 minutes. Add these GitHub repository secrets:

- `SITE_URL` — e.g. `https://didhamzplay.com`
- `CRON_SECRET` — the same value used in Vercel

The workflow is in `.github/workflows/refresh.yml`.

If you prefer not to use GitHub Actions, Vercel Cron can be used, but more frequent-than-daily cron requires Vercel Pro.

## 9. Domain

You can buy a domain from Cloudflare Registrar or another registrar.

For example:

`didhamzplay.com`

Then in Vercel:

Project -> Settings -> Domains -> Add

Enter the domain. Vercel will show the DNS records you need to add.

## 10. Important API quota note

API-Football's free plan has 100 requests/day. The refresh code deliberately uses a small number of calls and stores the result in Supabase.

Do not configure a refresh job every few minutes. It would burn through the quota.

## 11. Classification logic

The site intentionally uses conservative labels:

- Started
- Substitute (played)
- Unused substitute
- Injured
- Suspended
- Not selected

It does not label a player "dropped" merely because he wasn't selected. That would require an additional reliable source or explicit reporting.

## 12. Production improvements

Before launching publicly, consider:

- Add a second source for injury/news verification.
- Add a manual admin refresh button.
- Add historical match cards.
- Add an About/Data Sources page.
- Add analytics.
- Add Open Graph/social preview images.
- Add monitoring/error alerts.
- Expand the database so the same code can support multiple players.
