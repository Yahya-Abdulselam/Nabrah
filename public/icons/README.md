# Nabrah PWA Icons

## Current Status
- SVG icon created: `icon.svg` (512x512)
- PNG icons needed: `icon-192.png`, `icon-512.png`

## How to Generate PNG Icons from SVG

### Option 1: Using Online Tool
1. Open https://svgtopng.com/ or https://cloudconvert.com/svg-to-png
2. Upload `icon.svg`
3. Export as 192x192 PNG → save as `icon-192.png`
4. Export as 512x512 PNG → save as `icon-512.png`

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick first: https://imagemagick.org/
convert icon.svg -resize 192x192 icon-192.png
convert icon.svg -resize 512x512 icon-512.png
```

### Option 3: Using Inkscape (Command Line)
```bash
# Install Inkscape first: https://inkscape.org/
inkscape icon.svg --export-type=png --export-width=192 --export-filename=icon-192.png
inkscape icon.svg --export-type=png --export-width=512 --export-filename=icon-512.png
```

### Option 4: Using Sharp (Node.js)
```javascript
const sharp = require('sharp');

sharp('icon.svg')
  .resize(192, 192)
  .png()
  .toFile('icon-192.png');

sharp('icon.svg')
  .resize(512, 512)
  .png()
  .toFile('icon-512.png');
```

## Icon Design
- **Colors**: Blue gradient (#3b82f6 to #1d4ed8)
- **Elements**:
  - Waveform (voice analysis)
  - Medical cross (emergency care)
  - Microphone (voice recording)
- **Format**: Maskable with rounded corners
- **Purpose**: Any (works as both regular and maskable)

## Temporary Workaround
Until PNG icons are generated, browsers will use the SVG or fallback to default PWA icons. The app will still work as a PWA.
