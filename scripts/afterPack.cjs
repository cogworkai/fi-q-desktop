const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * afterPack hook for electron-builder.
 *
 * For MAS builds: wraps the fi-q-server executable in a minimal .app bundle
 * so that codesign embeds the Info.plist (with CFBundleIdentifier) into the
 * binary's code signature. macOS sandbox init (libsecinit) requires this
 * to resolve the container identity.
 *
 * All Mach-O binaries in the fi-q-server directory are also signed with
 * the MAS inherit entitlements.
 */
exports.default = async function afterPack(context) {
    // Only needed for MAS builds
    if (context.packager.platform.name !== "mac" || !context.targets?.find(t => t.name === "mas")) {
        // Also check the electronPlatformName
        if (context.electronPlatformName !== "mas") {
            console.log("[afterPack] Skipping — not a MAS build");
            return;
        }
    }

    const appPath = context.appOutDir;
    const appName = context.packager.appInfo.productFilename;
    const serverDir = path.join(
        appPath,
        `${appName}.app`,
        "Contents",
        "Resources",
        "lib",
        "fi-q-server"
    );

    if (!fs.existsSync(serverDir)) {
        console.warn(`[afterPack] fi-q-server directory not found at: ${serverDir}`);
        return;
    }

    const entitlementsPath = path.resolve(__dirname, "..", "entitlements.mas.inherit.plist");
    if (!fs.existsSync(entitlementsPath)) {
        throw new Error(`[afterPack] Inherit entitlements not found at: ${entitlementsPath}`);
    }

    // Info.plist for the fi-q-server .app bundle (provides CFBundleIdentifier for sandbox)
    const infoPlistSrc = path.resolve(__dirname, "..", "fi-q-server-Info.plist");
    if (!fs.existsSync(infoPlistSrc)) {
        throw new Error(`[afterPack] fi-q-server Info.plist not found at: ${infoPlistSrc}`);
    }

    // Get the signing identity from the build config
    const identity = context.packager.config?.mac?.identity ||
        process.env.CSC_NAME ||
        "-";

    console.log(`[afterPack] Signing fi-q-server binaries with inherit entitlements...`);
    console.log(`[afterPack] Server dir: ${serverDir}`);
    console.log(`[afterPack] Entitlements: ${entitlementsPath}`);
    console.log(`[afterPack] Identity: ${identity}`);

    // ── Step 1: Create a minimal .app bundle for the main executable ──
    // This lets codesign embed the Info.plist (with CFBundleIdentifier)
    // into the binary's code signature, which macOS sandbox init requires.
    const bundlePath = path.join(serverDir, "fi-q-server.app");
    const bundleMacOSDir = path.join(bundlePath, "Contents", "MacOS");
    const bundleInfoPlist = path.join(bundlePath, "Contents", "Info.plist");
    const originalBinary = path.join(serverDir, "fi-q-server");
    const bundledBinary = path.join(bundleMacOSDir, "fi-q-server");

    fs.mkdirSync(bundleMacOSDir, { recursive: true });
    fs.copyFileSync(infoPlistSrc, bundleInfoPlist);
    fs.renameSync(originalBinary, bundledBinary);

    console.log(`[afterPack] Created .app bundle at: ${bundlePath}`);

    // ── Step 2: Sign all other Mach-O files (dylibs, .so, .node) ──
    const signableExtensions = new Set(["", ".dylib", ".so", ".node"]);
    const bundleDirName = "fi-q-server.app";

    function signFilesInDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // Skip the .app bundle — we sign it as a whole in step 3
                if (entry.name === bundleDirName) continue;
                signFilesInDir(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (signableExtensions.has(ext)) {
                    try {
                        const fileOutput = execSync(`file "${fullPath}"`, { encoding: "utf8" });
                        if (fileOutput.includes("Mach-O") || fileOutput.includes("executable")) {
                            console.log(`[afterPack] Signing: ${path.relative(serverDir, fullPath)}`);
                            execSync(
                                `codesign --force --sign "${identity}" --entitlements "${entitlementsPath}" --timestamp "${fullPath}"`,
                                { stdio: "inherit" }
                            );
                        }
                    } catch (err) {
                        console.warn(`[afterPack] Warning: Could not sign ${fullPath}: ${err.message}`);
                    }
                }
            }
        }
    }

    signFilesInDir(serverDir);

    // ── Step 3: Sign the .app bundle ──
    // codesign reads Contents/Info.plist and embeds it into the executable's
    // code signature, providing the CFBundleIdentifier that secinit needs.
    console.log(`[afterPack] Signing fi-q-server.app bundle...`);
    execSync(
        `codesign --force --sign "${identity}" --entitlements "${entitlementsPath}" --timestamp "${bundlePath}"`,
        { stdio: "inherit" }
    );

    console.log("[afterPack] Done signing fi-q-server binaries.");
};
