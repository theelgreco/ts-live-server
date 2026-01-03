import * as fs from "fs";
import * as path from "path";
import * as esbuild from "esbuild";

/**
 * Transpile a TypeScript, TSX, or JSX file to JavaScript using esbuild
 */
export async function transpileFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.promises.readFile(filePath, "utf-8");

    // Determine loader based on file extension
    let loader: esbuild.Loader;
    switch (ext) {
        case ".ts":
            loader = "ts";
            break;
        case ".tsx":
            loader = "tsx";
            break;
        case ".jsx":
            loader = "jsx";
            break;
        default:
            loader = "js";
    }

    try {
        const result = await esbuild.transform(content, {
            loader,
            sourcefile: filePath,
            sourcemap: "inline",
            format: "esm",
            target: "es2020",
            jsx: "transform", // Classic JSX transform (React.createElement)
            jsxFactory: "React.createElement",
            jsxFragment: "React.Fragment",
            minify: false,
        });

        if (result.warnings.length > 0) {
            console.warn(`Warnings for ${filePath}:`, result.warnings);
        }

        return result.code;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to transpile ${filePath}: ${errorMessage}`);
    }
}

/**
 * Check if a file needs transpilation based on its extension
 */
export function needsTranspilation(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".ts", ".tsx", ".jsx"].includes(ext);
}
