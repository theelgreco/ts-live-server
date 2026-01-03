import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { WebSocketServer, WebSocket } from "ws";
import { transpileFile } from "./transpiler";

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".ts": "application/javascript",
    ".tsx": "application/javascript",
    ".jsx": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".otf": "font/otf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".xml": "application/xml",
};

// Files that need transpilation
const TRANSPILE_EXTENSIONS = [".ts", ".tsx", ".jsx"];

// Live reload script to inject into HTML files
const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(protocol + '//' + window.location.host + '/__ts-live-server-ws');
    
    ws.onmessage = function(event) {
        if (event.data === 'reload') {
            window.location.reload();
        }
    };
    
    ws.onclose = function() {
        console.log('TS Live Server: Connection lost. Attempting to reconnect...');
        setTimeout(function() {
            window.location.reload();
        }, 1000);
    };
})();
</script>
`;

export class LiveServer {
    private server: http.Server | null = null;
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private running = false;

    constructor(private rootDir: string, private port: number, private liveReload: boolean) {}

    isRunning(): boolean {
        return this.running;
    }

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                await this.handleRequest(req, res);
            });

            // Set up WebSocket for live reload
            if (this.liveReload) {
                this.wss = new WebSocketServer({ server: this.server });

                this.server.on("upgrade", (request, socket, head) => {
                    const pathname = url.parse(request.url || "").pathname;

                    if (pathname === "/__ts-live-server-ws") {
                        this.wss!.handleUpgrade(request, socket, head, (ws) => {
                            this.wss!.emit("connection", ws, request);
                        });
                    } else {
                        socket.destroy();
                    }
                });

                this.wss.on("connection", (ws) => {
                    this.clients.add(ws);
                    ws.on("close", () => {
                        this.clients.delete(ws);
                    });
                });
            }

            this.server.on("error", (err: NodeJS.ErrnoException) => {
                if (err.code === "EADDRINUSE") {
                    reject(new Error(`Port ${this.port} is already in use`));
                } else {
                    reject(err);
                }
            });

            this.server.listen(this.port, () => {
                this.running = true;
                console.log(`TS Live Server running at http://localhost:${this.port}`);
                console.log(`Serving files from: ${this.rootDir}`);
                resolve();
            });
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Close all WebSocket connections
            for (const client of this.clients) {
                client.close();
            }
            this.clients.clear();

            if (this.wss) {
                this.wss.close();
                this.wss = null;
            }

            if (this.server) {
                this.server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.running = false;
                        this.server = null;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    notifyClients(): void {
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send("reload");
            }
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const parsedUrl = url.parse(req.url || "/");
        let pathname = decodeURIComponent(parsedUrl.pathname || "/");

        // Ignore WebSocket endpoint
        if (pathname === "/__ts-live-server-ws") {
            return;
        }

        // Build file path
        let filePath = path.join(this.rootDir, pathname);

        try {
            const stats = await fs.promises.stat(filePath);

            // If it's a directory, look for index.html
            if (stats.isDirectory()) {
                filePath = path.join(filePath, "index.html");
            }
        } catch {
            // File doesn't exist, check for TypeScript/JSX alternatives
            const resolved = await this.resolveFile(filePath);
            if (resolved) {
                filePath = resolved;
            }
        }

        // Get file extension
        const ext = path.extname(filePath).toLowerCase();

        try {
            // Check if file exists
            await fs.promises.access(filePath);

            // Check if we need to transpile
            if (TRANSPILE_EXTENSIONS.includes(ext)) {
                await this.serveTranspiledFile(filePath, res);
                return;
            }

            // Handle .js requests - check if there's a .ts/.tsx version
            if (ext === ".js") {
                const tsPath = filePath.replace(/\.js$/, ".ts");
                const tsxPath = filePath.replace(/\.js$/, ".tsx");

                try {
                    await fs.promises.access(tsPath);
                    await this.serveTranspiledFile(tsPath, res);
                    return;
                } catch {
                    try {
                        await fs.promises.access(tsxPath);
                        await this.serveTranspiledFile(tsxPath, res);
                        return;
                    } catch {
                        // Fall through to serve the .js file directly
                    }
                }
            }

            // Serve static file
            await this.serveStaticFile(filePath, ext, res);
        } catch (error) {
            this.send404(res, pathname);
        }
    }

    private async resolveFile(filePath: string): Promise<string | null> {
        const ext = path.extname(filePath);

        // If requesting a .js file, check for .ts/.tsx/.jsx versions
        if (ext === ".js") {
            const alternatives = [".ts", ".tsx", ".jsx"];
            const basePath = filePath.slice(0, -3);

            for (const altExt of alternatives) {
                const altPath = basePath + altExt;
                try {
                    await fs.promises.access(altPath);
                    return altPath;
                } catch {
                    continue;
                }
            }
        }

        return null;
    }

    private async serveTranspiledFile(filePath: string, res: http.ServerResponse): Promise<void> {
        try {
            const code = await transpileFile(filePath);

            res.writeHead(200, {
                "Content-Type": "application/javascript",
                "Cache-Control": "no-cache",
            });
            res.end(code);
        } catch (error) {
            console.error(`Transpilation error for ${filePath}:`, error);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(`Transpilation error: ${error}`);
        }
    }

    private async serveStaticFile(filePath: string, ext: string, res: http.ServerResponse): Promise<void> {
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";
        let content = await fs.promises.readFile(filePath);

        // Inject live reload script into HTML files
        if (ext === ".html" && this.liveReload) {
            let html = content.toString("utf-8");

            // Inject before </body> if exists, otherwise at the end
            if (html.includes("</body>")) {
                html = html.replace("</body>", `${LIVE_RELOAD_SCRIPT}</body>`);
            } else {
                html += LIVE_RELOAD_SCRIPT;
            }

            content = Buffer.from(html, "utf-8");
        }

        res.writeHead(200, {
            "Content-Type": mimeType,
            "Cache-Control": "no-cache",
            "Content-Length": content.length,
        });
        res.end(content);
    }

    private send404(res: http.ServerResponse, pathname: string): void {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Not Found</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #1e1e1e;
                        color: #fff;
                    }
                    .container { text-align: center; }
                    h1 { font-size: 4em; margin: 0; color: #007acc; }
                    p { color: #888; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>404</h1>
                    <p>File not found: ${pathname}</p>
                </div>
            </body>
            </html>
        `);
    }
}
