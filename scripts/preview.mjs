// Serves the built site from dist/ so you can click through it locally: npm run build && npm run preview
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const base = ("/" + (process.env.BASE_PATH || "/").replace(/^\/+|\/+$/g, "") + "/").replace(/^\/\/$/, "/");
const server = await startServer(dist, base);
console.log(`Preview: http://127.0.0.1:${server.address().port}${base}`);
