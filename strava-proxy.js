// Strava API proxy with automatic token refresh
// Run with: node strava-proxy.js
// Requires .env with STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    console.error('Missing Strava credentials. Copy .env.example to .env and fill in.');
    process.exit(1);
}

app.use(cors());
app.use(express.static(__dirname));

let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
        return cachedAccessToken;
    }
    const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: STRAVA_REFRESH_TOKEN,
    });
    const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        body: params,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token refresh failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    cachedAccessToken = data.access_token;
    tokenExpiresAt = data.expires_at * 1000;
    console.log(`Refreshed Strava token, expires ${new Date(tokenExpiresAt).toISOString()}`);
    return cachedAccessToken;
}

app.get('/api/activities', async (req, res) => {
    try {
        const token = await getAccessToken();
        const after = req.query.after || Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000);
        const perPage = req.query.per_page || 100;
        const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=${perPage}`;
        const stravaRes = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!stravaRes.ok) {
            const text = await stravaRes.text();
            return res.status(stravaRes.status).json({ error: text });
        }
        const data = await stravaRes.json();
        res.json(data);
    } catch (err) {
        console.error('Activities error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/routes', async (req, res) => {
    try {
        const token = await getAccessToken();
        const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/routes?per_page=50', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!stravaRes.ok) {
            const text = await stravaRes.text();
            return res.status(stravaRes.status).json({ error: text });
        }
        const data = await stravaRes.json();
        res.json(data);
    } catch (err) {
        console.error('Routes error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/athlete', async (req, res) => {
    try {
        const token = await getAccessToken();
        const stravaRes = await fetch('https://www.strava.com/api/v3/athlete', {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await stravaRes.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true, hasToken: !!cachedAccessToken });
});

app.listen(PORT, () => {
    console.log(`Strava proxy running on http://localhost:${PORT}`);
    console.log(`Try: http://localhost:${PORT}/api/activities`);
});
