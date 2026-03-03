import { execFileSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function () {
    console.log("[beforeBuild] Running bump_version.sh...");
    execFileSync("bash", [join(__dirname, "bump_version.sh")], {
        stdio: "inherit",
    });
}
