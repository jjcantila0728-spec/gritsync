git config --global user.email "jjcantila0728@gmail.com"
git config --global user.name "JJ Cantila"
git add server/index.ts vercel.json
git commit -m "fix: prevent esbuild from bundling Playwright in Vercel lambda"
git push origin main
