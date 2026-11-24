# Zaden AI v2 setup (about 30 minutes)

## 1. Rotate your old keys first
Create NEW keys at Google AI Studio, ElevenLabs and fal.ai, then delete the old ones.
Set a monthly spend limit / budget alert in each dashboard.

## 2. Supabase
1. supabase.com -> New project. Save the database password.
2. SQL Editor -> paste `supabase/schema.sql` -> Run.
3. Project Settings -> API: copy **Project URL** and **anon public key** into `config.js`.
   (Never copy the `service_role` key anywhere except Supabase itself.)

## 3. Server function + secrets (needs the Supabase CLI: https://supabase.com/docs/guides/cli)
```
supabase login
supabase link --project-ref YOUR_PROJECT_ID
supabase secrets set GEMINI_API_KEY=... ELEVENLABS_API_KEY=... FAL_API_KEY=...
supabase secrets set GEMINI_CHAT_MODEL=gemini-2.5-flash GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
supabase secrets set ALLOWED_ORIGIN=https://your-site-url
supabase functions deploy api
```
Run these from the folder that contains `supabase/`. Use model names that exist in your Google account.

## 4. Auth settings (Supabase Dashboard -> Authentication)
- **URL Configuration:** Site URL = your live site URL. Add the same URL (and http://localhost:5500 for testing) under Redirect URLs.
- **Providers -> Email:** keep "Confirm email" on.
- **Providers -> Google:** in Google Cloud Console create an OAuth client (type: Web application).
  Authorized redirect URI = `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`.
  Paste the Client ID and Secret into Supabase and enable the provider.
- **SMTP:** Supabase's built-in email is rate-limited. Add your own SMTP (Resend, Postmark...) before launch.

## 5. Host
Upload the whole folder (index.html, styles.css, extra.css, config.js, app.js, auth.js, logo.png) to Cloudflare Pages or Netlify.
Test locally with a real server, not by double-clicking: `npx serve` or VS Code Live Server.
Delete `giga.js` and `gigs.js`. They are replaced by `app.js`.
