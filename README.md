# GATA Airdrop Checker

A modern, static web application for checking GATA airdrop allocations on the Gnoland blockchain.

## Features

- 🚀 **Lightning Fast**: 2-5 second load time, instant search across 656K+ addresses
- 💾 **Browser Caching**: JSON file cached automatically - subsequent visits even faster
- 🎨 **Modern UI**: Beautiful GATA-themed design with cat background watermark
- 📱 **Responsive**: Works perfectly on mobile and desktop
- ⚡ **Zero Backend**: Fully static, deployable on GitHub Pages
- 🔍 **Simple**: Clean in-memory search with O(1) hash lookup

## How It Works

1. **First Visit**: Downloads 33MB JSON file (~2-5 seconds depending on connection)
2. **Subsequent Visits**: Browser cache makes it even faster (~1-2 seconds)
3. **Address Lookup**: O(1) hash lookup in JavaScript object for instant results
4. **Amount Conversion**: Automatically converts ugnot to GNOT (÷ 1,000,000)

## File Structure

```
atone-airdrop/
├── index.html          # Main HTML page
├── app.js              # IndexedDB logic and search functionality
├── balances.json       # Airdrop allocations (generated from balances.txt)
├── balances.txt        # Original data file
├── gataCat.webp        # GATA logo/favicon
└── README.md           # This file
```

## Local Development

1. Generate the JSON file (if not already done):
```bash
node convert-balances.js
```

2. Start local server:
```bash
python3 -m http.server 8000
```

3. Open browser:
```
http://localhost:8000
```

## Deployment

### Deploy to GitHub Pages

1. Ensure you have the remote configured
2. Commit and push to main:
```bash
git add .
git commit -m "Initial commit: GATA Airdrop Checker"
git push origin main
```

3. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Source: Deploy from branch `main`
   - Folder: `/ (root)`
   - Save

The site will be live at: `https://[username].github.io/[repository-name]/`

## Technical Details

### Performance Optimizations

- **In-Memory Storage**: Entire dataset loaded into JavaScript object for instant access
- **Browser Caching**: Browser automatically caches the JSON file (HTTP cache headers)
- **O(1) Lookup**: Direct hash table lookup - no scanning or indexing needed
- **Progressive Loading**: Shows progress during initial JSON download

### Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

Works in all modern browsers with JavaScript enabled.

### Address Format

- Gnoland addresses start with `g1`
- Total length: 40 characters
- Example: `g1p3ucd3ptpw902fluyjzhq3ffgq4ntddatev7s5`

### Amount Conversion

- Input: ugnot (micro GNOT)
- Output: GNOT (÷ 1,000,000)
- Example: `47056306ugnot` → `47.056306 GNOT`

## Updating Airdrop Data

When `balances.txt` changes:

1. Regenerate JSON:
```bash
node convert-balances.js
```

2. Commit and deploy
3. Users will automatically get the new data on their next visit (browser cache will refresh)

## License

MIT License - see [LICENSE](LICENSE) file for details

© 2025 GATA Public Infra

