const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const USERS = { admin: 'admin123' };
const sessions = {};
const DATA_FILE = path.join(__dirname, 'data', 'events.json');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const cookie = req.headers.cookie || '';
  const result = {};
  cookie.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) result[k] = decodeURIComponent(v || '');
  });
  return result;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const sid = cookies.sid;
  return sid && sessions[sid] ? sessions[sid] : null;
}

function loadEvents() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveEvents(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
}

function generateId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function getPath(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return url.pathname;
}

function getQuery(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = {};
  for (const [k, v] of url.searchParams) params[k] = v;
  return params;
}

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const p = getPath(req);
  const session = getSession(req);
  const isAuth = session && session.user;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') return res.writeHead(204).end();

  // API routes
  if (p === '/api/login' && method === 'POST') {
    const body = await parseBody(req);
    if (USERS[body.username] && USERS[body.username] === body.password) {
      const sid = crypto.randomBytes(16).toString('hex');
      sessions[sid] = { user: body.username };
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `sid=${sid}; HttpOnly; Path=/; Max-Age=86400`
      });
      return res.end(JSON.stringify({ success: true }));
    }
    return jsonResponse(res, 401, { error: '帳號或密碼錯誤' });
  }

  if (p === '/api/logout' && method === 'POST') {
    const cookies = parseCookies(req);
    if (cookies.sid) delete sessions[cookies.sid];
    return jsonResponse(res, 200, { success: true });
  }

  if (p === '/api/session') {
    return jsonResponse(res, 200, { user: isAuth ? session.user : null });
  }

  // Protected API routes
  if (p.startsWith('/api/')) {
    if (!isAuth) return jsonResponse(res, 401, { error: '未登入' });

    if (p === '/api/events' && method === 'GET') {
      const q = getQuery(req);
      const events = loadEvents();
      if (q.month && q.year) {
        const prefix = `${q.year}-${String(Number(q.month)).padStart(2, '0')}`;
        const filtered = {};
        for (const [date, evts] of Object.entries(events)) {
          if (date.startsWith(prefix)) filtered[date] = evts;
        }
        return jsonResponse(res, 200, filtered);
      }
      return jsonResponse(res, 200, events);
    }

    if (p === '/api/events' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.date || !body.text) return jsonResponse(res, 400, { error: '日期與內容為必填' });
      const events = loadEvents();
      if (!events[body.date]) events[body.date] = [];
      const evt = { id: generateId(), text: body.text.trim() };
      events[body.date].push(evt);
      saveEvents(events);
      return jsonResponse(res, 200, evt);
    }

    if (p.startsWith('/api/events/') && method === 'PUT') {
      const id = p.split('/')[3];
      const body = await parseBody(req);
      if (!body.text) return jsonResponse(res, 400, { error: '內容為必填' });
      const events = loadEvents();
      for (const date in events) {
        const idx = events[date].findIndex(e => e.id === id);
        if (idx !== -1) {
          events[date][idx].text = body.text.trim();
          saveEvents(events);
          return jsonResponse(res, 200, events[date][idx]);
        }
      }
      return jsonResponse(res, 404, { error: '找不到該事項' });
    }

    if (p.startsWith('/api/events/') && method === 'DELETE') {
      const id = p.split('/')[3];
      const events = loadEvents();
      for (const date in events) {
        const idx = events[date].findIndex(e => e.id === id);
        if (idx !== -1) {
          events[date].splice(idx, 1);
          if (!events[date].length) delete events[date];
          saveEvents(events);
          return jsonResponse(res, 200, { success: true });
        }
      }
      return jsonResponse(res, 404, { error: '找不到該事項' });
    }

    return jsonResponse(res, 404, { error: 'Not Found' });
  }

  // Static files / pages
  if (p === '/' || p === '') {
    if (isAuth) {
      res.writeHead(302, { Location: '/calendar.html' });
      return res.end();
    }
    res.writeHead(302, { Location: '/login.html' });
    return res.end();
  }

  if (p === '/login.html') {
    return serveFile(res, path.join(__dirname, 'public', 'login.html'));
  }

  if (p === '/calendar.html') {
    if (!isAuth) {
      res.writeHead(302, { Location: '/login.html' });
      return res.end();
    }
    return serveFile(res, path.join(__dirname, 'public', 'calendar.html'));
  }

  const ext = path.extname(p);
  if (ext === '.css' || ext === '.js') {
    const filePath = path.join(__dirname, 'public', p);
    if (fs.existsSync(filePath)) return serveFile(res, filePath);
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 月曆系統已啟動：http://localhost:${PORT}`);
   console.log(`📅 顯示範圍：115年8月 ~ 116年2月 (2026/08 ~ 2027/02)`);
  console.log(`👤 預設帳號：admin / admin123`);
});
