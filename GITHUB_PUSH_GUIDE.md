# GitHub Push Guide

## Step 1: Configure Git (if not already done)
If you haven't configured git with your name and email, run these commands:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## Step 2: Create a GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name your repository (e.g., "gritsync")
5. Choose Public or Private
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 3: Add GitHub Remote

After creating the repository, GitHub will show you commands. Use the HTTPS URL format:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.

## Step 4: Push to GitHub

```bash
# Push to main branch (or master if that's your default)
git branch -M main
git push -u origin main
```

If you're using the master branch:
```bash
git push -u origin master
```

## Step 5: Verify

Visit your GitHub repository page to confirm all files have been pushed successfully.

## Troubleshooting

### If you get authentication errors:
- GitHub now requires a Personal Access Token instead of passwords
- Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
- Generate a new token with `repo` scope
- Use the token as your password when pushing

### If you need to update the remote URL:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

### If you want to check your current remote:
```bash
git remote -v
```
