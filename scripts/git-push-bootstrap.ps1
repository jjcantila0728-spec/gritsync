# Quick push for the DB bootstrap change
git config --global user.email "jjcantila0728@gmail.com"
git config --global user.name "JJ Cantila"
git add server/index.ts scripts/push-schema-supabase.cjs
git commit -m "feat: auto-bootstrap Supabase DB on Vercel cold-start"
git push origin main
