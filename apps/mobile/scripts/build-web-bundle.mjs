import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, "..");
const repositoryRoot = resolve(mobileRoot, "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");
const exportRoot = resolve(webRoot, "out");
const webDir = resolve(mobileRoot, "www");
const bootstrapEntry = resolve(mobileRoot, "src", "native", "bootstrap.ts");

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: webRoot, shell: process.platform === "win32", stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)));
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return findHtmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

await rm(webDir, { recursive: true, force: true });
await run("npm", ["run", "build"], {
  env: { ...process.env, CAPACITOR_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1" },
});

if (!await exists(exportRoot)) {
  throw new Error("The Capacitor web build did not produce apps/web/out. CAPACITOR_BUILD must use Next static export.");
}

await mkdir(webDir, { recursive: true });
await cp(exportRoot, webDir, { recursive: true });

// next-intl exports locale-prefixed entry pages. Capacitor launches `/`, so
// make the English default launch page available at the webDir root while the
// Arabic entry remains bundled at `/ar/`.
if (!await exists(resolve(webDir, "index.html"))) {
  await cp(resolve(webDir, "en", "index.html"), resolve(webDir, "index.html"));
}

const esbuild = await import("esbuild");
await esbuild.build({
  bundle: true,
  entryPoints: [bootstrapEntry],
  format: "esm",
  minify: true,
  outfile: resolve(webDir, "native", "bootstrap.js"),
  platform: "browser",
  target: "es2022",
});

const bootstrapTag = '<script type="module" src="/native/bootstrap.js"></script>';
for (const htmlFile of await findHtmlFiles(webDir)) {
  const html = await readFile(htmlFile, "utf8");
  await writeFile(htmlFile, html.includes(bootstrapTag) ? html : html.replace("</head>", `${bootstrapTag}</head>`));
}

const entries = await readdir(webDir);
if (!entries.includes("index.html")) {
  throw new Error("The local Capacitor webDir is missing index.html.");
}

console.log(`Bundled the client-rendered web app into ${webDir}.`);
