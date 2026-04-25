#!/usr/bin/env node
/**
 * Snapshot Strava activities + saved routes naar data/*.json.
 * Draait in GitHub Actions (cron) en lokaal (`node scripts/fetch-strava-data.js`).
 *
 * Vereist env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN.
 * Lokaal worden die uit .env geladen; in CI komen ze uit repo secrets.
 */
const fs = require('fs');
const path = require('path');

// .env loader (alleen lokaal nodig — CI zet env vars direct)
try { require('dotenv').config(); } catch {}

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    console.error('Missing Strava env vars (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN).');
    process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DAYS_BACK = 120; // ruim genoeg voor 90-dagen filter in frontend

async function getAccessToken() {
    const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: STRAVA_REFRESH_TOKEN,
        }),
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    return j.access_token;
}

async function api(token, pathAndQuery) {
    const res = await fetch(`https://www.strava.com/api/v3${pathAndQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`API ${pathAndQuery} → ${res.status} ${await res.text()}`);
    return res.json();
}

// PII-strip: alleen wat het dashboard echt gebruikt blijft over
function sanitizeActivity(a) {
    return {
        id: a.id,
        name: a.name,
        type: a.type,
        sport_type: a.sport_type,
        start_date: a.start_date,
        start_date_local: a.start_date_local,
        distance: a.distance,
        moving_time: a.moving_time,
        elapsed_time: a.elapsed_time,
        total_elevation_gain: a.total_elevation_gain,
        average_speed: a.average_speed,
        max_speed: a.max_speed,
        average_heartrate: a.average_heartrate,
        max_heartrate: a.max_heartrate,
        start_latlng: a.start_latlng,
        end_latlng: a.end_latlng,
        map: a.map ? { summary_polyline: a.map.summary_polyline } : null,
    };
}

function sanitizeRoute(r) {
    return {
        id: r.id,
        id_str: r.id_str,
        name: r.name,
        type: r.type,
        sub_type: r.sub_type,
        distance: r.distance,
        elevation_gain: r.elevation_gain,
        estimated_moving_time: r.estimated_moving_time,
        map: r.map ? { summary_polyline: r.map.summary_polyline } : null,
    };
}

(async () => {
    console.log('→ Refreshing access token…');
    const token = await getAccessToken();

    const after = Math.floor((Date.now() - DAYS_BACK * 86400000) / 1000);
    console.log(`→ Fetching activities since ${new Date(after * 1000).toISOString().slice(0, 10)}…`);
    const activitiesRaw = await api(token, `/athlete/activities?after=${after}&per_page=100`);
    const activities = activitiesRaw
        .filter(a => !a.private && !a.hide_from_home)
        .map(sanitizeActivity);

    console.log(`→ Fetching saved routes…`);
    const athlete = await api(token, '/athlete');
    const routesRaw = await api(token, `/athletes/${athlete.id}/routes?per_page=50`);
    const routes = routesRaw.map(sanitizeRoute);

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'activities.json'), JSON.stringify(activities, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'strava-routes.json'), JSON.stringify(routes, null, 2));

    console.log(`✓ Wrote ${activities.length} activities + ${routes.length} routes.`);
})().catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
});
