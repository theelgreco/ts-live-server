# TS Live Server

A VS Code extension that provides a live development server with **TypeScript, JSX, and TSX support**. Similar to Live Server, but automatically transpiles TypeScript and JSX/TSX files using esbuild before serving them to the browser.

## Features

- 🚀 **TypeScript Support**: Write TypeScript (`.ts`) files and have them automatically transpiled to JavaScript
- ⚛️ **JSX/TSX Support**: Full support for React JSX syntax in `.jsx` and `.tsx` files
- 🔄 **Live Reload**: Automatically refreshes the browser when files change
- 📁 **File-based Routing**: Serves files based on directory structure
- ⚡ **Fast Transpilation**: Uses esbuild for near-instant transpilation
- 🎯 **Smart Resolution**: Automatically serves `.ts`/`.tsx` files when `.js` is requested

## Usage

### Start Server

You have two options to start the server: via the Command Palette or via the Explorer context menu. Starting the server from the Command Palette uses the workspace as the server root; starting it from a folder in the Explorer sets that folder as the server root.

1. **Command Palette**: Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) and run:
    - `TS Live Server: Start Server`

2. **Context Menu**: Right-click on a folder in the Explorer and select:
    - `Open with TS Live Server`

### Stop Server

- Run `TS Live Server: Stop Server` from the Command Palette.
- You can also stop the server by clicking the TS Live Server status bar item in the bottom bar.

## Configuration

Configure the extension in VS Code settings:

| Setting                   | Default | Description                                   |
| ------------------------- | ------- | --------------------------------------------- |
| `tsLiveServer.port`       | `5500`  | Port number for the server                    |
| `tsLiveServer.autoOpen`   | `true`  | Automatically open browser when server starts |
| `tsLiveServer.liveReload` | `true`  | Enable live reload on file changes            |

### Example Settings

```json
{
    "tsLiveServer.port": 3000,
    "tsLiveServer.autoOpen": true,
    "tsLiveServer.liveReload": true
}
```

## How It Works

1. When you start the server, it serves files from the selected directory (or workspace root)
2. Requests for directories automatically serve `index.html` if present
3. When a `.ts`, `.tsx`, or `.jsx` file is requested, it's transpiled on-the-fly using esbuild
4. When a `.js` file is requested, the server checks for a corresponding `.ts`/`.tsx` file and serves the transpiled version if found
5. HTML files are automatically injected with a live reload script
6. File changes trigger an automatic browser refresh

## Example Project Structure

```
my-project/
├── index.html
├── styles.css
├── main.ts          # Transpiled and served as JavaScript
├── components/
│   └── App.tsx      # JSX/TSX support
└── utils/
    └── helpers.ts
```

In your `index.html`:

```html
<!DOCTYPE html>
<html>
    <head>
        <link rel="stylesheet" href="styles.css" />
    </head>
    <body>
        <div id="root"></div>
        <!-- Request .ts file directly or as .js - both work! -->
        <script type="module" src="main.ts"></script>
    </body>
</html>
```

## Supported File Types

### Transpiled (via esbuild)

- `.ts` - TypeScript
- `.tsx` - TypeScript with JSX
- `.jsx` - JavaScript with JSX

### Served Directly

- `.html`, `.css`, `.js`, `.mjs`
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`
- Fonts: `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf`
- Media: `.mp4`, `.webm`, `.mp3`, `.wav`
- Other: `.json`, `.pdf`, `.txt`, `.xml`

## Requirements

- VS Code 1.85.0 or higher

## License

MIT
