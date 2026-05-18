# GritSync — Play Store assets

Mockup designs for the Google Play Store listing. Hand-built SVGs modeled
on the real app UI (Inter font, brand red `#DC2626`, Pearson-style exam).

## Files

| File | Purpose | Size |
| --- | --- | --- |
| `feature-graphic.svg` | Feature graphic (banner at top of listing) | 1024 × 500 |
| `screenshot-01-home.svg` | Home dashboard with hero + quick actions | 1080 × 1920 |
| `screenshot-02-review.svg` | Review hub with NCLEX countdown + Q-banks | 1080 × 1920 |
| `screenshot-03-exam.svg` | Pearson Vue-style mock exam runner | 1080 × 1920 |
| `screenshot-04-docs.svg` | Document upload screen | 1080 × 1920 |
| `screenshot-05-apply.svg` | Guided application stepper | 1080 × 1920 |
| `screenshot-06-login.svg` | Sign-in with biometrics | 1080 × 1920 |

## Play Store spec reminders

- **Feature graphic** — 1024 × 500 PNG or JPG, no transparency. Required.
- **Phone screenshots** — 2–8 images, JPEG or 24-bit PNG (no alpha), aspect
  ratio between 16:9 and 9:16, min 320 px, max 3840 px on each side. These
  files are 1080 × 1920 (9:16) which sits comfortably in range.
- **App icon** — 512 × 512 PNG with alpha. Already shipped at
  `mobile/assets/icon.png`.

## Convert SVG → PNG

The Play Console only accepts PNG/JPEG. Pick one of:

### Option 1 — Inkscape (recommended, sharpest text)

```powershell
# install once: winget install Inkscape.Inkscape
foreach ($f in Get-ChildItem playstore\*.svg) {
  inkscape $f.FullName --export-type=png --export-filename=($f.FullName -replace '\.svg$','.png')
}
```

### Option 2 — rsvg-convert (fast, ships with librsvg)

```powershell
foreach ($f in Get-ChildItem playstore\*.svg) {
  rsvg-convert $f.FullName -o ($f.FullName -replace '\.svg$','.png')
}
```

### Option 3 — Headless Chrome (no install if you already have Chrome)

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
foreach ($f in Get-ChildItem playstore\*.svg) {
  $png = $f.FullName -replace '\.svg$','.png'
  & $chrome --headless --disable-gpu --screenshot=$png --window-size=1080,1920 ("file:///" + $f.FullName.Replace('\','/'))
}
```

(Adjust `--window-size` to `1024,500` for `feature-graphic.svg`.)

### Option 4 — Web-based (zero install)

Open each SVG in your browser, right-click → **Save image as…** at 1× zoom,
or drop them into <https://cloudconvert.com/svg-to-png> with the target
dimensions set.

## Want to tweak the copy?

Headlines are at the top of each SVG inside `<text>` blocks — open in any
editor, change the words, re-export. Brand red is `#DC2626` throughout.
