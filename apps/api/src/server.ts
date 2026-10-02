import { buildApp } from "./app.js";
import { readApiEnv } from "./plugins/env.js";

const config = readApiEnv(process.env);
const app = await buildApp({ env: process.env });

await app.listen({ host: config.API_HOST, port: config.API_PORT });
