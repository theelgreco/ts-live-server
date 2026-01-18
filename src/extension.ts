import * as vscode from "vscode";
import { LiveServer } from "./server";

let server: LiveServer | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log("TS Live Server extension is now active");

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "ts-live-server.toggleFromStatusBar";
    updateStatusBar(false);
    context.subscriptions.push(statusBarItem);

    // Start server command
    const startCommand = vscode.commands.registerCommand("ts-live-server.start", async () => {
        await startServer();
    });

    // Stop server command
    const stopCommand = vscode.commands.registerCommand("ts-live-server.stop", async () => {
        await stopServer();
    });

    // Toggle from status bar (start if stopped, stop if running)
    const toggleCommand = vscode.commands.registerCommand("ts-live-server.toggleFromStatusBar", async () => {
        if (server && server.isRunning()) {
            await stopServer();
        } else {
            await startServer();
        }
    });

    // Start from folder context menu
    const startFromFolderCommand = vscode.commands.registerCommand("ts-live-server.startFromFolder", async (uri: vscode.Uri) => {
        await startServer(uri.fsPath);
    });

    context.subscriptions.push(startCommand, stopCommand, toggleCommand, startFromFolderCommand);
}

async function startServer(rootPath?: string) {
    if (server && server.isRunning()) {
        await stopServer();
    }

    // Get root directory
    let rootDir = rootPath;
    if (!rootDir) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace folder open. Please open a folder first.");
            return;
        }
        rootDir = workspaceFolders[0].uri.fsPath;
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration("tsLiveServer");
    const port = config.get<number>("port", 5500);
    const autoOpen = config.get<boolean>("autoOpen", true);
    const liveReload = config.get<boolean>("liveReload", true);

    try {
        server = new LiveServer(rootDir, port, liveReload);
        await server.start();

        // Update status bar
        updateStatusBar(true, port);

        vscode.window.showInformationMessage(`TS Live Server running at http://localhost:${port}`, "Open in Browser").then((selection) => {
            if (selection === "Open in Browser") {
                vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
            }
        });

        if (autoOpen) {
            vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
        }

        // Set up file watcher for live reload
        if (liveReload) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootDir, "**/*"));

            watcher.onDidChange(() => server?.notifyClients());
            watcher.onDidCreate(() => server?.notifyClients());
            watcher.onDidDelete(() => server?.notifyClients());
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start server: ${error}`);
    }
}

async function stopServer() {
    if (!server || !server.isRunning()) {
        vscode.window.showWarningMessage("TS Live Server is not running.");
        return;
    }

    try {
        await server.stop();
        server = null;

        // Update status bar
        updateStatusBar(false);

        vscode.window.showInformationMessage("TS Live Server stopped.");
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to stop server: ${error}`);
    }
}

function updateStatusBar(running: boolean, port?: number) {
    if (!statusBarItem) {
        return;
    }

    if (running && port) {
        statusBarItem.text = `$(broadcast) Port: ${port}`;
        statusBarItem.tooltip = `TS Live Server running on port ${port}\nClick to stop`;
        statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
        statusBarItem.text = `$(broadcast) Start Server`;
        statusBarItem.tooltip = "Click to start TS Live Server";
        statusBarItem.backgroundColor = undefined;
    }

    statusBarItem.show();
}

export function deactivate() {
    if (server) {
        server.stop();
    }
}
