import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const root = process.cwd(),
  entries = {};
const required = [
  "manifest.json",
  "background.js",
  "content.js",
  "edition.js",
  "translate.js",
  "popup.html",
  "popup.js",
  "options.html",
  "options.js",
  "library.html",
  "library.js",
  "offscreen.html",
  "offscreen.js",
  "import-parse.js",
  "icon.png",
];
function add(relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep))
    throw Error("Invalid package path");
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute)) add(relative + "/" + name);
  } else
    entries[relative.replaceAll("\\", "/")] = new Uint8Array(
      fs.readFileSync(absolute)
    );
}
for (const file of [...required, "tesseract", "vendor"]) add(file);
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
if (manifest.manifest_version !== 3) throw Error("Manifest V3 required");
for (const file of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
])
  if (!entries[file]) throw Error("Missing manifest resource: " + file);
const context = vm.createContext({
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Int32Array,
  TextEncoder,
  TextDecoder,
});
vm.runInContext(fs.readFileSync("vendor/fflate.min.js", "utf8"), context);
const zip = context.fflate.zipSync(entries, { level: 6 });
fs.writeFileSync("yomu-extension.zip", zip);
const unpacked = context.fflate.unzipSync(zip);
for (const file of Object.keys(entries))
  if (!Buffer.from(unpacked[file]).equals(Buffer.from(entries[file])))
    throw Error("Archive verification failed: " + file);
console.log(
  JSON.stringify({
    file: "yomu-extension.zip",
    version: manifest.version,
    files: Object.keys(entries).length,
    bytes: zip.length,
    verified: true,
  })
);
