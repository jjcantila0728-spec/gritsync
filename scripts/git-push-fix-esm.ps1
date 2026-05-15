git config --global user.email "jjcantila0728@gmail.com"
git config --global user.name "JJ Cantila"
git add api/package.json api/index.ts package.json vercel.json .gitignore
git commit -m "fix: add api/package.json with type:commonjs to resolve ESM/CJS mismatch on Vercel"
git push origin main
