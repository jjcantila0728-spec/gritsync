# Git Setup Script for GRITSYNC
Write-Host "Setting up Git repository..." -ForegroundColor Green

# Navigate to project directory
Set-Location $PSScriptRoot

# Check if git is installed
try {
    $gitVersion = git --version
    Write-Host "Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Remove existing .git if it exists (fresh start)
if (Test-Path .git) {
    Write-Host "Removing existing .git directory..." -ForegroundColor Yellow
    Remove-Item -Path .git -Recurse -Force
}

# Initialize git repository
Write-Host "Initializing git repository..." -ForegroundColor Green
git init
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to initialize git repository" -ForegroundColor Red
    exit 1
}

# Add all files
Write-Host "Staging all files..." -ForegroundColor Green
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to stage files" -ForegroundColor Red
    exit 1
}

# Check if user name and email are configured
$userName = git config --get user.name
$userEmail = git config --get user.email

if (-not $userName -or -not $userEmail) {
    Write-Host "WARNING: Git user name or email not configured" -ForegroundColor Yellow
    Write-Host "Please run:" -ForegroundColor Yellow
    Write-Host "  git config --global user.name `"Your Name`"" -ForegroundColor Cyan
    Write-Host "  git config --global user.email `"your.email@example.com`"" -ForegroundColor Cyan
}

# Create initial commit
Write-Host "Creating initial commit..." -ForegroundColor Green
git commit -m "Initial commit: GRITSYNC application"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create commit" -ForegroundColor Red
    Write-Host "This might be because git user.name and user.email are not set" -ForegroundColor Yellow
    exit 1
}

# Add remote
Write-Host "Adding GitHub remote..." -ForegroundColor Green
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin https://github.com/jjcantila0728-spec/gritsync.git
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to add remote" -ForegroundColor Red
    exit 1
}

# Rename branch to main
Write-Host "Setting branch to main..." -ForegroundColor Green
git branch -M main

# Show status
Write-Host "`nGit repository setup complete!" -ForegroundColor Green
Write-Host "`nRepository status:" -ForegroundColor Cyan
git status

Write-Host "`nRemote configuration:" -ForegroundColor Cyan
git remote -v

Write-Host "`nTo push to GitHub, run:" -ForegroundColor Yellow
Write-Host "  git push -u origin main" -ForegroundColor Cyan
Write-Host "`nNote: You may need to authenticate with a Personal Access Token" -ForegroundColor Yellow
