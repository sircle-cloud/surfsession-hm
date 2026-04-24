const PROXY_URL = '';
const RACE_DATE = new Date('2026-06-07T09:00:00');
const TODAY = new Date();

let plan = null;
let routes = null;
let stravaRoutes = [];
let activities = [];
let map = null;
let mapLayers = {};
let activeRouteId = null;
let routeSource = 'strava'; // 'strava' | 'activities' | 'suggested'

// Google encoded polyline decoder (used by Strava)
function decodePolyline(str) {
    if (!str) return [];
    let index = 0, lat = 0, lng = 0, coords = [];
    while (index < str.length) {
        let b, shift = 0, result = 0;
        do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = 0; result = 0;
        do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
        coords.push([lat * 1e-5, lng * 1e-5]);
    }
    return coords;
}

async function init() {
    setupTabs();
    updateCountdown();
    setInterval(updateCountdown, 60_000);

    try {
        const cacheBust = `?t=${Date.now()}`;
        [plan, routes] = await Promise.all([
            fetch(`data/plan.json${cacheBust}`).then(r => r.json()),
            fetch(`data/routes.json${cacheBust}`).then(r => r.json()),
        ]);
    } catch (err) {
        console.error('Failed to load plan/routes', err);
        return;
    }

    renderGoalBand();
    renderSchedule();
    renderRoutes();
    initMap();
    renderChecklist();

    activities = await fetchActivities();
    stravaRoutes = await fetchStravaRoutes();
    renderRoutes();
    rebuildMapLayers();
    renderOverview();
    renderZones();
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('nl-NL');
}

function setupTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'routes' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });
}

function updateCountdown() {
    const days = Math.max(0, Math.ceil((RACE_DATE - new Date()) / (1000 * 3600 * 24)));
    document.getElementById('daysToRace').textContent = days;
}

async function fetchStravaRoutes() {
    try {
        const res = await fetch(`${PROXY_URL}/api/routes`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.filter(r => r.type === 2); // 2 = run
    } catch (e) {
        console.warn('Routes fetch failed', e);
        return [];
    }
}

function buildRouteList() {
    const list = [];

    // Always include suggested routes from home (text only, no polyline)
    routes.routes.forEach(r => {
        list.push({
            id: `sug-${r.id}`,
            name: r.name,
            distanceKm: r.distanceKm,
            description: r.description,
            source: `Suggestie · ${r.surface} · ${r.terrain}`,
            color: r.color,
            waypoints: [],
            isSuggestion: true,
        });
    });

    // Saved Strava routes (real GPS) — only those starting near home
    stravaRoutes.forEach(r => {
        const waypoints = decodePolyline(r.map?.summary_polyline || '');
        if (waypoints.length < 2) return;
        const dist = haversineKm(waypoints[0][0], waypoints[0][1], routes.home.lat, routes.home.lng);
        if (dist > 5) return;
        list.push({
            id: `sr-${r.id}`,
            name: r.name,
            distanceKm: +(r.distance / 1000).toFixed(1),
            elevationM: Math.round(r.elevation_gain || 0),
            description: r.description || `${Math.round((r.estimated_moving_time || 0) / 60)} min geschat`,
            source: 'Strava saved route',
            color: '#F2E2A4',
            waypoints,
            stravaUrl: `https://www.strava.com/routes/${r.id}`,
        });
    });

    // Recent activities near home (within ~3 km of start)
    activities.forEach(a => {
        if (!a.map?.summary_polyline || !a.start_latlng) return;
        const dist = haversineKm(a.start_latlng[0], a.start_latlng[1], routes.home.lat, routes.home.lng);
        if (dist > 3) return;
        list.push({
            id: `act-${a.id}`,
            name: a.name,
            distanceKm: +(a.distance / 1000).toFixed(1),
            elevationM: Math.round(a.total_elevation_gain || 0),
            description: `Gelopen ${formatDate(a.start_date_local)} · ${formatPace(a.average_speed)}`,
            source: 'Eerder gelopen vanuit huis',
            color: '#8FAF8A',
            waypoints: decodePolyline(a.map.summary_polyline),
            stravaUrl: `https://www.strava.com/activities/${a.id}`,
        });
    });

    return list;
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function pickRouteColor(km) {
    if (km < 6) return '#22c55e';
    if (km < 9) return '#3b82f6';
    if (km < 13) return '#a855f7';
    if (km < 17) return '#f59e0b';
    return '#ef4444';
}

async function fetchActivities() {
    const status = document.getElementById('connectionStatus');
    try {
        const after = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000);
        const res = await fetch(`${PROXY_URL}/api/activities?after=${after}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const runs = data.filter(a => a.type === 'Run' || a.sport_type === 'Run');
        status.textContent = `Strava verbonden (${runs.length} runs laatste 90 dagen)`;
        status.className = 'status-badge connected';
        return runs;
    } catch (err) {
        console.warn('Strava fetch failed:', err);
        status.textContent = 'Strava niet verbonden — start strava-proxy + .env';
        status.className = 'status-badge error';
        return [];
    }
}

function getCurrentWeek() {
    return plan.weeks.find(w => {
        const start = new Date(w.start);
        const end = new Date(w.end);
        end.setHours(23, 59, 59);
        return TODAY >= start && TODAY <= end;
    }) || plan.weeks[0];
}

function getNextSession() {
    const all = plan.weeks.flatMap(w => w.sessions);
    return all.find(s => new Date(s.date) >= new Date(TODAY.toDateString()));
}

function matchActivityToSession(session) {
    const sessionDate = new Date(session.date).toDateString();
    return activities.find(a => new Date(a.start_date_local).toDateString() === sessionDate);
}

function sessionStatus(session) {
    const sessionDate = new Date(session.date);
    const today = new Date(TODAY.toDateString());
    const match = matchActivityToSession(session);
    if (match) {
        const actualKm = match.distance / 1000;
        const ratio = actualKm / session.distanceKm;
        if (ratio >= 0.9) return { state: 'done', label: `✓ ${actualKm.toFixed(1)} km` };
        return { state: 'partial', label: `~ ${actualKm.toFixed(1)} km` };
    }
    if (sessionDate < today) return { state: 'missed', label: 'Gemist' };
    return { state: 'upcoming', label: 'Gepland' };
}

function renderOverview() {
    const week = getCurrentWeek();
    const thisWeek = document.getElementById('thisWeek');
    thisWeek.innerHTML = `
        <div class="muted" style="margin-bottom:8px">Week ${week.week} — ${week.focus}</div>
        ${week.sessions.map(s => {
            const st = sessionStatus(s);
            return `<div class="session" style="padding:10px 0;grid-template-columns:80px 90px 1fr auto">
                <div class="session-date">${formatDate(s.date)}</div>
                <div class="session-type type-${s.type}">${s.type}</div>
                <div class="session-desc"><span class="dist">${s.distanceKm} km</span> — ${s.description}</div>
                <div class="session-status status-${st.state}">${st.label}</div>
            </div>`;
        }).join('')}
    `;

    const allSessions = plan.weeks.flatMap(w => w.sessions);
    const past = allSessions.filter(s => new Date(s.date) < TODAY);
    const done = past.filter(s => sessionStatus(s).state === 'done').length;
    const totalKmDone = activities.reduce((sum, a) => sum + a.distance / 1000, 0);
    const totalKmPlanned = plan.weeks.reduce((sum, w) => sum + w.totalKm, 0);

    document.getElementById('progressSummary').innerHTML = `
        <div>
            <div class="progress-row"><span>Sessies voltooid</span><strong>${done}/${past.length}</strong></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${past.length ? (done/past.length*100) : 0}%"></div></div>
        </div>
        <div>
            <div class="progress-row"><span>Km gelopen (90d)</span><strong>${totalKmDone.toFixed(1)} / ${totalKmPlanned} km plan</strong></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, totalKmDone/totalKmPlanned*100)}%"></div></div>
        </div>
        <div class="big-number">${getCurrentWeek().week}/6</div>
        <div class="muted">Huidige trainingsweek</div>
    `;

    const recent = activities.slice(0, 5);
    document.getElementById('recentRuns').innerHTML = recent.length ? recent.map(a => `
        <div class="run-item">
            <div>
                <div class="run-name">${a.name}</div>
                <div class="run-meta">${formatDate(a.start_date_local)} · ${(a.distance/1000).toFixed(2)} km · ${formatPace(a.average_speed)}</div>
            </div>
        </div>
    `).join('') : '<div class="muted">Nog geen runs gevonden. Verbind Strava en loop!</div>';

    const next = getNextSession();
    if (next) {
        document.getElementById('nextRun').innerHTML = `
            <div class="big-number">${next.distanceKm} km</div>
            <div style="margin:8px 0"><span class="session-type type-${next.type}">${next.type}</span></div>
            <div class="muted">${formatDate(next.date)} — ${next.description}</div>
        `;
    } else {
        document.getElementById('nextRun').innerHTML = '<div class="muted">Plan voltooid 🏁</div>';
    }
}

function renderSchedule() {
    const container = document.getElementById('weeksContainer');
    const currentWk = getCurrentWeek();
    container.innerHTML = plan.weeks.map(w => `
        <div class="week-card ${w.week === currentWk.week ? 'current' : ''}">
            <div class="week-header">
                <div>
                    <div class="week-title">Week ${w.week} <span class="muted">— ${w.totalKm} km totaal</span></div>
                    <div class="week-dates">${formatDate(w.start)} – ${formatDate(w.end)}</div>
                </div>
                ${w.week === currentWk.week ? '<span class="status-badge connected">Deze week</span>' : ''}
            </div>
            <div class="week-focus">${w.focus}</div>
            ${w.checkpoint ? `<div class="week-checkpoint">⚑ ${w.checkpoint}</div>` : ''}
            <div class="sessions">
                ${w.sessions.map(s => {
                    const st = sessionStatus(s);
                    return `<div class="session">
                        <div class="session-date">${formatDate(s.date)}</div>
                        <div class="session-type type-${s.type}">${s.type}</div>
                        <div class="session-desc"><span class="dist">${s.distanceKm} km</span> — ${s.description}</div>
                        <div class="session-status status-${st.state}">${st.label}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function renderRoutes() {
    const list = document.getElementById('routesList');
    const items = buildRouteList();
    const suggestions = items.filter(i => i.isSuggestion);
    const realRoutes = items.filter(i => !i.isSuggestion);

    list.innerHTML = `
        <div class="muted" style="padding:0 4px 6px;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em">Routes vanuit Maaswijkstraat</div>
        ${suggestions.map(routeCard).join('')}
        ${realRoutes.length ? `<div class="muted" style="padding:14px 4px 6px;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.12em">Op de kaart · ${realRoutes.length} echte tracks</div>` : ''}
        ${realRoutes.map(routeCard).join('')}
        ${realRoutes.length === 0 ? '<div class="muted" style="padding:8px 4px;font-size:0.82rem">Geen Strava routes/runs vanuit huis gevonden binnen 3 km. Maak een route in <a href="https://www.strava.com/routes/new" target="_blank" style="color:var(--gold)">Strava Route Builder</a> en refresh om GPS-tracks hier te zien.</div>' : ''}
    `;
    list.querySelectorAll('.route-item').forEach(el => {
        el.addEventListener('click', () => focusRoute(el.dataset.id));
    });
    window._routeItems = items;
}

function routeCard(r) {
    return `
        <div class="route-item" data-id="${r.id}" style="border-left-color:${r.color}">
            <div class="route-name">${r.name}</div>
            <div class="route-dist">${r.distanceKm} km${r.elevationM ? ` · ↑${r.elevationM}m` : ''}</div>
            <div class="route-meta">${r.source}</div>
            <div class="route-desc">${r.description}</div>
            ${r.stravaUrl ? `<div class="route-meta" style="margin-top:6px"><a href="${r.stravaUrl}" target="_blank" style="color:${r.color}">Open in Strava →</a></div>` : ''}
        </div>
    `;
}

function initMap() {
    map = L.map('map').setView([routes.home.lat, routes.home.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
    }).addTo(map);

    const homeIcon = L.divIcon({
        html: `<div style="background:#F2E2A4;color:#0C180F;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid #060D08;box-shadow:0 0 0 2px #F2E2A4">⌂</div>`,
        className: 'home-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
    L.marker([routes.home.lat, routes.home.lng], { icon: homeIcon })
        .addTo(map)
        .bindPopup(`<strong>Thuis</strong><br>${routes.home.name}`);
}

function rebuildMapLayers() {
    if (!map) return;
    Object.values(mapLayers).forEach(l => map.removeLayer(l));
    mapLayers = {};
    const items = window._routeItems || buildRouteList();
    const home = [routes.home.lat, routes.home.lng];
    const allBounds = [home];

    items.forEach(r => {
        if (r.isSuggestion) {
            // Show a soft circle at home indicating route radius (rough)
            const radiusM = Math.max(500, (r.distanceKm * 1000) / (2 * Math.PI));
            const layer = L.circle(home, {
                radius: radiusM,
                color: r.color,
                weight: 2.5,
                opacity: 0.85,
                fillOpacity: 0.06,
                dashArray: '6 8',
            }).bindPopup(`<strong>${r.name}</strong><br>${r.distanceKm} km · suggestie<br><small>${r.description}</small>`);
            layer.addTo(map);
            mapLayers[r.id] = layer;
            return;
        }
        if (!r.waypoints || r.waypoints.length < 2) return;
        const layer = L.polyline(r.waypoints, {
            color: r.color,
            weight: 4,
            opacity: 0.75,
        }).bindPopup(`<strong>${r.name}</strong><br>${r.distanceKm} km${r.elevationM ? ` · ↑${r.elevationM}m` : ''}`);
        layer.addTo(map);
        mapLayers[r.id] = layer;
        allBounds.push(...r.waypoints);
    });

    // Fit to real routes if any, otherwise center on home
    const hasRealRoutes = items.some(i => !i.isSuggestion && i.waypoints && i.waypoints.length >= 2);
    if (hasRealRoutes) {
        map.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40], maxZoom: 15 });
    } else {
        map.setView(home, 14);
    }
}

function focusRoute(id) {
    activeRouteId = id;
    document.querySelectorAll('.route-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
    Object.entries(mapLayers).forEach(([rid, layer]) => {
        const isActive = rid === id;
        if (layer.setStyle) {
            const baseOpacity = layer instanceof L.Circle ? 0.5 : 0.4;
            layer.setStyle({
                opacity: isActive ? 1 : baseOpacity,
                weight: isActive ? (layer instanceof L.Circle ? 3 : 6) : (layer instanceof L.Circle ? 1.5 : 3),
            });
        }
        if (isActive && !map.hasLayer(layer)) layer.addTo(map);
    });
    const layer = mapLayers[id];
    const home = [routes.home.lat, routes.home.lng];
    if (layer) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        if (layer instanceof L.Circle) {
            map.setView(home, 14);
        } else {
            map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
        }
        layer.openPopup();
    }
}

function renderZones() {
    const grid = document.getElementById('zonesGrid');
    let easyPace, hmPace, threshold, maxHr;

    if (activities.length >= 3) {
        const paces = activities.map(a => 1000 / a.average_speed).sort((a, b) => a - b);
        const median = paces[Math.floor(paces.length / 2)];
        const slowest30 = paces.slice(Math.floor(paces.length * 0.7));
        easyPace = slowest30.reduce((a, b) => a + b, 0) / slowest30.length;
        hmPace = easyPace - 60;
        threshold = easyPace - 90;
        const hrs = activities.filter(a => a.max_heartrate).map(a => a.max_heartrate);
        maxHr = hrs.length ? Math.max(...hrs) : (220 - 35);
    } else {
        easyPace = 435;
        hmPace = 367;
        threshold = 337;
        maxHr = 185;
    }

    const zones = [
        { label: 'Easy / recovery', value: formatPaceSec(easyPace), hint: 'Pratendend tempo, kunt door neus ademen', color: 'var(--green)' },
        { label: 'HM race pace', value: formatPaceSec(hmPace), hint: 'Comfortabel hard, korte zinnen mogelijk', color: 'var(--accent)' },
        { label: 'Threshold / tempo', value: formatPaceSec(threshold), hint: 'Comfortabel oncomfortabel, ~1 uur volhoudbaar', color: 'var(--amber)' },
        { label: 'Max HR (geschat)', value: `${Math.round(maxHr)} bpm`, hint: `Easy = <${Math.round(maxHr * 0.75)} · HM = ${Math.round(maxHr * 0.83)}-${Math.round(maxHr * 0.88)} bpm`, color: 'var(--red)' },
    ];
    grid.innerHTML = zones.map(z => `
        <div class="zone" style="border-top-color:${z.color}">
            <div class="zone-label">${z.label}</div>
            <div class="zone-value">${z.value}</div>
            <div class="zone-hint">${z.hint}</div>
        </div>
    `).join('');

    const tbody = document.querySelector('#paceTable tbody');
    const paces = [330, 345, 360, 375, 390, 420, 450];
    tbody.innerHTML = paces.map(p => {
        const t5 = p * 5;
        const t10 = p * 10;
        const tHM = p * 21.1;
        return `<tr><td><strong>${formatPaceSec(p)}</strong></td><td>${formatTime(t5)}</td><td>${formatTime(t10)}</td><td>${formatTime(tHM)}</td></tr>`;
    }).join('');
}

function renderGoalBand() {
    const el = document.getElementById('goalBand');
    if (!el || !plan?.race) return;
    el.innerHTML = `
        <span class="goal-primary">Doel: ${plan.race.targetFinish}</span>
        <span class="goal-stretch">Stretch: ${plan.race.stretchGoal}</span>
    `;
}

function renderChecklist() {
    const container = document.getElementById('preventionContent');
    if (!container) return;
    container.innerHTML = `
        ${preventionSection({
            title: 'Mobility — dagelijks 5 min',
            subtitle: 'Doe dit elke ochtend, vooral op rustdagen. Voorkomt stijfheid en houdt heupen open.',
            color: '#8FAF8A',
            icon: 'mobility',
            items: [
                { name: 'Kuiten', detail: '2× 30 sec staand tegen muur, been gestrekt', svg: stretchSvg('calf') },
                { name: 'Hamstrings', detail: '2× 30 sec zitten met been gestrekt, naar tenen reiken', svg: stretchSvg('hamstring') },
                { name: 'Heup openers', detail: '2× 30 sec lunge, achterste heup omlaag duwen', svg: stretchSvg('hip') },
                { name: 'Quads', detail: '2× 30 sec staand, hiel naar bil trekken', svg: stretchSvg('quad') },
            ],
        })}

        ${preventionSection({
            title: 'Strength — 2× per week, 15 min',
            subtitle: 'Bijvoorbeeld dinsdag + zaterdag. Bouwt loopkracht op zonder vermoeidheid.',
            color: '#F2E2A4',
            icon: 'strength',
            items: [
                { name: 'Single-leg deadlift', detail: '3× 8 per been. Houdt enkels en achterketen sterk', svg: exerciseSvg('sld') },
                { name: 'Calf raises', detail: '3× 15. Ook single-leg variant — voorkomt scheenklachten', svg: exerciseSvg('calf-raise') },
                { name: 'Glute bridge', detail: '3× 12. Activeert je bilspieren — minder belasting op knieën', svg: exerciseSvg('glute-bridge') },
                { name: 'Plank', detail: '3× 45 sec. Sterke core = stabiele loopvorm', svg: exerciseSvg('plank') },
            ],
        })}

        <div class="prevention-grid">
            ${quickCard({ icon: '😴', title: '7+ uur slaap', text: 'Vooral pre-long-run. Slaap is wanneer je herstelt en sterker wordt.', color: '#8FAF8A' })}
            ${quickCard({ icon: '💧', title: 'Hydratatie', text: 'Long runs >12 km: bidon mee. Test gels na 60 min al vóór race day — niet op de dag zelf experimenteren.', color: '#F2E2A4' })}
            ${quickCard({ icon: '👟', title: 'Schoenen check', text: 'Levensduur 600–800 km. Vervang vóór wk 3 als je huidige paar al >500 km heeft.', color: '#C4A854' })}
            ${quickCard({ icon: '📈', title: '10% regel', text: 'Nooit meer dan +10% volume per week. Sneller groeien = blessure.', color: '#8FAF8A' })}
            ${quickCard({ icon: '🚴', title: 'Cross-training', text: 'Op rustdagen: fietsen of zwemmen 30–45 min easy. Behoudt fitness zonder impact.', color: '#F2E2A4' })}
        </div>

        <div class="red-flag-card">
            <div class="rf-header">
                <span class="rf-icon">⚠</span>
                <h3>Rode vlaggen — STOP en rust 2 dagen</h3>
            </div>
            <ul class="rf-list">
                <li><strong>Pijn die je loopvorm verandert</strong> — je begint mank te lopen of je tred wordt asymmetrisch</li>
                <li><strong>Ochtendstijfheid >24 uur</strong> — normale spierpijn is weg na een dag, ontsteking blijft</li>
                <li><strong>Scherpe pijn</strong> in shin, achilles of knie — niet wegwerken met pijnstiller</li>
                <li><strong>Twee dagen op rij dezelfde pijn</strong> op exact dezelfde plek</li>
            </ul>
            <p class="rf-cta">Bij twijfel: rust 2 dagen, dan 30 min easy run als test. Als pijn terugkomt → fysio bellen, niet doortrainen.</p>
        </div>
    `;
}

function preventionSection({ title, subtitle, color, items }) {
    return `
        <div class="prev-section" style="--accent:${color}">
            <div class="prev-header">
                <h3>${title}</h3>
                <p class="muted">${subtitle}</p>
            </div>
            <div class="prev-items">
                ${items.map(i => `
                    <div class="prev-item">
                        <div class="prev-svg">${i.svg}</div>
                        <div class="prev-content">
                            <div class="prev-name">${i.name}</div>
                            <div class="prev-detail">${i.detail}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function quickCard({ icon, title, text, color }) {
    return `
        <div class="quick-card" style="--accent:${color}">
            <div class="qc-icon">${icon}</div>
            <div class="qc-title">${title}</div>
            <div class="qc-text">${text}</div>
        </div>
    `;
}

function stretchSvg(type) {
    const figures = {
        calf: `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="30" y1="18" x2="30" y2="42" stroke="currentColor" stroke-width="2"/><line x1="30" y1="24" x2="20" y2="36" stroke="currentColor" stroke-width="2"/><line x1="30" y1="24" x2="40" y2="36" stroke="currentColor" stroke-width="2"/><line x1="30" y1="42" x2="18" y2="68" stroke="currentColor" stroke-width="2"/><line x1="30" y1="42" x2="48" y2="60" stroke="currentColor" stroke-width="2"/><line x1="48" y1="60" x2="56" y2="60" stroke="currentColor" stroke-width="2"/><line x1="18" y1="68" x2="14" y2="74" stroke="currentColor" stroke-width="2"/></svg>`,
        hamstring: `<svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="30" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="26" y1="30" x2="48" y2="30" stroke="currentColor" stroke-width="2"/><line x1="48" y1="30" x2="70" y2="20" stroke="currentColor" stroke-width="2"/><line x1="48" y1="30" x2="48" y2="50" stroke="currentColor" stroke-width="2"/><line x1="38" y1="30" x2="32" y2="22" stroke="currentColor" stroke-width="2"/><line x1="32" y1="22" x2="42" y2="14" stroke="currentColor" stroke-width="2"/></svg>`,
        hip: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="30" y1="20" x2="30" y2="40" stroke="currentColor" stroke-width="2"/><line x1="30" y1="28" x2="42" y2="36" stroke="currentColor" stroke-width="2"/><line x1="30" y1="40" x2="50" y2="56" stroke="currentColor" stroke-width="2"/><line x1="50" y1="56" x2="50" y2="72" stroke="currentColor" stroke-width="2"/><line x1="30" y1="40" x2="14" y2="60" stroke="currentColor" stroke-width="2"/><line x1="14" y1="60" x2="14" y2="74" stroke="currentColor" stroke-width="2"/></svg>`,
        quad: `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="30" y1="18" x2="30" y2="42" stroke="currentColor" stroke-width="2"/><line x1="30" y1="24" x2="44" y2="34" stroke="currentColor" stroke-width="2"/><line x1="30" y1="24" x2="16" y2="34" stroke="currentColor" stroke-width="2"/><line x1="30" y1="42" x2="40" y2="68" stroke="currentColor" stroke-width="2"/><line x1="30" y1="42" x2="20" y2="56" stroke="currentColor" stroke-width="2"/><line x1="20" y1="56" x2="36" y2="42" stroke="currentColor" stroke-width="2"/></svg>`,
    };
    return figures[type] || '';
}

function exerciseSvg(type) {
    const figures = {
        sld: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="40" y1="20" x2="60" y2="30" stroke="currentColor" stroke-width="2"/><line x1="60" y1="30" x2="80" y2="34" stroke="currentColor" stroke-width="2"/><line x1="80" y1="34" x2="92" y2="44" stroke="currentColor" stroke-width="2"/><line x1="60" y1="30" x2="58" y2="56" stroke="currentColor" stroke-width="2"/><line x1="40" y1="20" x2="20" y2="44" stroke="currentColor" stroke-width="2"/></svg>`,
        'calf-raise': `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="30" y1="16" x2="30" y2="46" stroke="currentColor" stroke-width="2"/><line x1="30" y1="22" x2="20" y2="32" stroke="currentColor" stroke-width="2"/><line x1="30" y1="22" x2="40" y2="32" stroke="currentColor" stroke-width="2"/><line x1="30" y1="46" x2="30" y2="64" stroke="currentColor" stroke-width="2"/><line x1="22" y1="68" x2="38" y2="68" stroke="currentColor" stroke-width="3"/><line x1="14" y1="74" x2="46" y2="74" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3"/></svg>`,
        'glute-bridge': `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="36" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="36" x2="50" y2="28" stroke="currentColor" stroke-width="2"/><line x1="50" y1="28" x2="70" y2="44" stroke="currentColor" stroke-width="2"/><line x1="70" y1="44" x2="70" y2="54" stroke="currentColor" stroke-width="2"/><line x1="50" y1="28" x2="36" y2="38" stroke="currentColor" stroke-width="2"/><line x1="36" y1="38" x2="36" y2="54" stroke="currentColor" stroke-width="2"/><line x1="6" y1="56" x2="86" y2="56" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3"/></svg>`,
        plank: `<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="20" r="5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="19" y1="20" x2="80" y2="22" stroke="currentColor" stroke-width="2"/><line x1="14" y1="25" x2="14" y2="38" stroke="currentColor" stroke-width="2"/><line x1="14" y1="38" x2="22" y2="38" stroke="currentColor" stroke-width="2"/><line x1="80" y1="22" x2="86" y2="40" stroke="currentColor" stroke-width="2"/><line x1="86" y1="40" x2="92" y2="40" stroke="currentColor" stroke-width="2"/><line x1="6" y1="44" x2="96" y2="44" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 3"/></svg>`,
    };
    return figures[type] || '';
}

// helpers
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatPace(speedMps) {
    if (!speedMps) return '–';
    const secPerKm = 1000 / speedMps;
    return formatPaceSec(secPerKm) + '/km';
}
function formatPaceSec(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60);
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

init();
