# GATA Airdrop Checker

A modern, static web application for checking GATA airdrop allocations on the Gnoland blockchain.

## Features

- 🚀 **Fast Search**: Uses IndexedDB for instant lookups across 656K+ addresses
- 💾 **Client-Side Storage**: Data cached in browser for offline access after first load
- 🎨 **Modern UI**: Beautiful GATA-themed design matching the main website
- 📱 **Responsive**: Works perfectly on mobile and desktop
- ⚡ **Zero Backend**: Fully static, deployable on GitHub Pages

## How It Works

1. **First Visit**: Downloads 33MB JSON file and stores it in IndexedDB (~10-15 seconds)
2. **Subsequent Visits**: Instant access - no download needed
3. **Address Lookup**: O(1) indexed search for immediate results
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

- **Batch Processing**: Inserts 5,000 addresses at a time to avoid blocking UI
- **Progress Tracking**: Real-time progress bar during initial load
- **IndexedDB Indexing**: Address field indexed for O(1) lookup
- **Data Versioning**: Only re-downloads if version changes

### Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

Requires IndexedDB support (available in all modern browsers).

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

2. Update `CURRENT_DATA_VERSION` in `app.js`
3. Commit and deploy

Users will automatically re-download on their next visit.

## License

© GATA Public Infra

