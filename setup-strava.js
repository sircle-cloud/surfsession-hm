// One-time Strava OAuth setup. Run: node setup-strava.js
// Reads CLIENT_ID/SECRET from .env, opens browser, captures code,
// exchanges for refresh_token, writes it to .env.

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const ENV_PATH = path.join(__dirname, '.env');

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('❌ Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in .env');
    console.error('   Copy .env.example to .env and fill in your Strava app credentials.');
    process.exit(1);
}

const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read_all`;

function writeRefreshToken(token) {
    let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    if (env.match(/^STRAVA_REFRESH_TOKEN=.*/m)) {
        env = env.replace(/^STRAVA_REFRESH_TOKEN=.*/m, `STRAVA_REFRESH_TOKEN=${token}`);
    } else {
        env = env.trimEnd() + `\nSTRAVA_REFRESH_TOKEN=${token}\n`;
    }
    fs.writeFileSync(ENV_PATH, env);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/callback') {
        res.writeHead(404).end('Not found');
        return;
    }
    const code = url.searchParams.get('code');
    const scope = url.searchParams.get('scope') || '';
    const error = url.searchParams.get('error');

    if (error || !code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>❌ Authorization failed</h1><p>${error || 'no code'}</p>`);
        console.error('Authorization failed:', error || 'no code');
        server.close();
        process.exit(1);
    }

    if (!scope.includes('activity:read_all')) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>⚠ Wrong scope</h1><p>Got: ${scope}</p><p>Need: activity:read_all</p>`);
        console.error('Wrong scope:', scope);
        server.close();
        process.exit(1);
    }

    try {
        const params = new URLSearchParams({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
        });
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            body: params,
        });
        if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
        const data = await tokenRes.json();

        writeRefreshToken(data.refresh_token);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><title>Klaar!</title><style>
            body{font-family:-apple-system,sans-serif;max-width:600px;margin:80px auto;padding:24px;text-align:center;background:#0b1220;color:#e6eaf5}
            h1{color:#22c55e}code{background:#1a2540;padding:2px 8px;border-radius:4px}
        </style></head><body>
            <h1>✓ Klaar!</h1>
            <p>Refresh token opgeslagen in <code>.env</code> als <code>${data.athlete.firstname} ${data.athlete.lastname}</code>.</p>
            <p>Sluit dit tabblad en run:</p>
            <p><code>npm run training</code></p>
        </body></html>`);

        console.log(`\n✓ Success! Authorized as ${data.athlete.firstname} ${data.athlete.lastname}`);
        console.log(`✓ Refresh token saved to .env`);
        console.log(`\nNext: npm run training\n`);
        setTimeout(() => { server.close(); process.exit(0); }, 500);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>❌ Token exchange failed</h1><pre>${err.message}</pre>`);
        console.error(err);
        server.close();
        process.exit(1);
    }
});

server.listen(PORT, () => {
    console.log(`\n→ Setup server running on http://localhost:${PORT}`);
    console.log(`→ Opening browser for Strava authorization...\n`);
    console.log(`If browser doesn't open, visit:\n${authUrl}\n`);
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${opener} "${authUrl}"`, (err) => {
        if (err) console.warn('Could not auto-open browser. Open URL manually above.');
    });
});
