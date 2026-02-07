# Echo

A browser extension that helps you generate comprehensive bug report bundles for development teams.

## What it does

Echo captures all the essential debugging information in one convenient bundle:

- **Network logs** - All network requests and responses (captured even when dev tools are closed)
- **Console logs** - Browser console output (errors, warnings, info)
- **Screenshot** - Visual snapshot of the current page state
- **System information** - Screen resolution, browser version, page URL, and more

## Installation

This extension is not available in the Chrome Web Store or Firefox Add-ons. It's designed for internal use and must be installed manually.

### From Releases

1. Go to the [Releases](../../releases) page
2. Download the latest `.zip` file

### Chrome/Edge

**Option 1: Drag and drop (easiest)**
1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in the top right)
3. Drag and drop the `.zip` file directly onto the extensions page

**Option 2: Load unpacked**
1. Extract the zip file to a local folder
2. Open `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the extracted extension folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the extracted folder and select `manifest.json`

## Usage

1. Click the Echo icon in your browser toolbar
2. Navigate to the page where you're experiencing the issue
3. Reproduce the bug or issue
4. Click the Echo icon again
5. Click "Generate Bundle" to download the debug package
6. Attach the generated bundle to your bug report

## What's in the bundle?

The generated bundle is a compressed file containing:

- `network.json` - All network activity with request/response details
- `console.json` - Console logs with timestamps
- `screenshot.png` - Visual capture of the page
- `summary.json` - Browser info, page URL, screen resolution, timestamp

## Development

```bash
# Install dependencies
pnpm install
```

### Testing your changes

1. Load the extension unpacked in your browser, pointing to the project folder
2. Make your changes to the source files
3. Go to the extensions page and click the "Reload" button for the Echo extension
4. Test your changes

