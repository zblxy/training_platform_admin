export function readEnvironment(env: NodeJS.ProcessEnv) {
  const mode = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('Invalid NODE_ENV');
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  // Do not log connection strings or credentials on validation failure.
  try {
    const url = new URL(env.DATABASE_URL ?? '');
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || !url.username || !url.password) throw new Error();
  } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL with host, database and credentials'); }
  return { mode, port };
}
