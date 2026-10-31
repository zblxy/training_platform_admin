import { createApp } from './app.js';
import { readEnvironment } from './config/environment.js';
async function bootstrap() {
  const config = readEnvironment(process.env);
  const app = await createApp();
  await app.listen(config.port, '0.0.0.0');
}
void bootstrap().catch(() => { console.error('API startup failed; check environment and port availability'); process.exitCode = 1; });
