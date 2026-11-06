import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { createUniformesStore, DomainError } from './uniformes.js';
import { handleApi } from './api.js';
import { assertPrivatePath } from './private-path.js';

const defaultWebRoot = fileURLToPath(new URL('../PROMENADEHUB/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};
function isWithin(root, target) {
  const path = relative(root, target);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}
function json(response, status, data, method, headers = {}) {
  const body = Buffer.from(JSON.stringify(data));
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, ...headers });
  response.end(method === 'HEAD' ? undefined : body);
}

export function createApplication({ databasePath = fileURLToPath(new URL('../.data/promenade.sqlite', import.meta.url)), webRoot = defaultWebRoot } = {}) {
  if(databasePath!==':memory:') assertPrivatePath(databasePath,webRoot);
  const database = openDatabase(databasePath);
  const store = createUniformesStore(database);
  const root = resolve(webRoot);
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const error = (status, code, message, headers) => json(response, status, { error: { code, message } }, request.method, headers);
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/api/health') {
        if (!['GET', 'HEAD'].includes(request.method)) return error(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.', { Allow: 'GET, HEAD' });
        database.prepare('SELECT 1').get();
        return json(response, 200, { status: 'ok', uniformes: 'ready-local-no-login' }, request.method);
      }
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return await handleApi(request, response, url, store, json);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return error(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.', { Allow: 'GET, HEAD' });
      let path;
      try { path = decodeURIComponent(url.pathname); }
      catch { return error(400, 'INVALID_PATH', 'Caminho inválido.'); }
      if (path.includes('\0') || path.includes('\\') || path.split('/').some((part) => part.startsWith('.'))) return error(404, 'NOT_FOUND', 'Arquivo não encontrado.');
      let target = resolve(root, `.${path}`);
      if (!isWithin(root, target)) return error(404, 'NOT_FOUND', 'Arquivo não encontrado.');
      const info = await stat(target);
      if (info.isDirectory() && !url.pathname.endsWith('/')) {
        response.writeHead(308, { Location: `${url.pathname}/${url.search}` });
        return response.end();
      }
      if (info.isDirectory()) target = resolve(target, 'index.html');
      const [actualRoot, actualTarget] = await Promise.all([realpath(root), realpath(target)]);
      if (!isWithin(actualRoot, actualTarget)) return error(404, 'NOT_FOUND', 'Arquivo não encontrado.');
      const body = await readFile(actualTarget);
      response.writeHead(200, { 'Content-Type': contentTypes[extname(actualTarget).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (cause) {
      if (cause instanceof DomainError) return error(cause.status,cause.code,cause.message);
      if (cause.code?.startsWith('SQLITE_CONSTRAINT') || cause.errcode === 2067 || cause.errcode === 787 || cause.errcode === 275) return error(409,'DATA_CONFLICT','Os dados conflitam com um cadastro existente. Revise os identificadores e as referências.');
      if (['ENOENT', 'ENOTDIR', 'EISDIR', 'EACCES'].includes(cause.code)) return error(404, 'NOT_FOUND', 'Arquivo não encontrado.');
      return error(500, 'INTERNAL_ERROR', 'Não foi possível atender à solicitação.');
    }
  });
  server.on('close', () => database.close());
  return { server, database };
}
