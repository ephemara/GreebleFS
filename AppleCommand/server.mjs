import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';

const HOST = process.env.APPLE_COMMAND_HOST || '0.0.0.0';
const PORT = Number(process.env.APPLE_COMMAND_PORT || 3000);
const STATIC_ROOT = join(process.cwd(), 'public');
const TOKEN = process.env.APPLE_COMMAND_TOKEN || randomBytes(16).toString('hex');
const DEFAULT_SHELL = process.env.APPLE_COMMAND_SHELL || 'pwsh.exe';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function safePath(urlPath) {
  const clean = urlPath.split('?')[0].replace(/\\\\/g, '/');
  if (clean.includes('..')) return null;
  const normalized = clean === '/' ? '/index.html' : clean;
  return join(STATIC_ROOT, normalized);
}

function listNetworkUrls() {
  const nets = networkInterfaces();
  const urls = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) {
        urls.push({ iface: name, url: `http://${a.address}:${PORT}` });
      }
    }
  }
  return urls;
}

function unauthorized(res) {
  res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, host: HOST, port: PORT }));
      return;
    }

    if (url.pathname === '/config') {
      const token = req.headers['x-apple-token'] || url.searchParams.get('token');
      if (token !== TOKEN) return unauthorized(res);

      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        shell: DEFAULT_SHELL,
        host: HOST,
        port: PORT
      }));
      return;
    }

    const path = safePath(url.pathname);
    if (!path || !existsSync(path)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const body = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: String(err) }));
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || req.headers['x-apple-token'];

  if (token !== TOKEN) {
    ws.send(JSON.stringify({ type: 'error', message: 'unauthorized' }));
    ws.close(1008, 'unauthorized');
    return;
  }

  const shell = spawn(DEFAULT_SHELL, ['-NoLogo'], {
    cwd: process.env.APPLE_COMMAND_CWD || process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  ws.send(JSON.stringify({ type: 'status', message: `connected to ${DEFAULT_SHELL}` }));

  shell.stdout.on('data', chunk => {
    ws.send(JSON.stringify({ type: 'output', stream: 'stdout', data: chunk.toString('utf8') }));
  });

  shell.stderr.on('data', chunk => {
    ws.send(JSON.stringify({ type: 'output', stream: 'stderr', data: chunk.toString('utf8') }));
  });

  shell.on('exit', code => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code }));
      ws.close(1000, 'shell exited');
    }
  });

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input' && typeof msg.data === 'string') {
        shell.stdin.write(msg.data);
      }
      if (msg.type === 'command' && typeof msg.data === 'string') {
        shell.stdin.write(msg.data + '\n');
      }
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'invalid message' }));
    }
  });

  ws.on('close', () => {
    if (!shell.killed) shell.kill();
  });
});

server.listen(PORT, HOST, () => {
  console.log('\nAppleCommand mobile host online');
  console.log(`- bind: http://${HOST}:${PORT}`);
  console.log(`- token: ${TOKEN}`);
  console.log('- iPhone/Safari URLs on your LAN:');
  for (const item of listNetworkUrls()) {
    console.log(`  • [${item.iface}] ${item.url}?token=${TOKEN}`);
  }
  console.log('');
});
