# Surf Session - Scheveningen Dashboard

A minimalistic surf conditions dashboard for Scheveningen, Netherlands, featuring real-time wind, wave, and weather data.

## Features

- **Real-time Conditions**: Wind speed, wave height, temperature, and tide information
- **5-Day Forecast**: Extended weather and surf predictions
- **Minimalistic Design**: Clean interface with blue gradients and white accents
- **Responsive Layout**: Works on desktop, tablet, and mobile devices
- **Auto-refresh**: Updates every 15 minutes

## Setup

1. **API Key Configuration**:
   - Sign up for a free OpenWeatherMap API key at https://openweathermap.org/api
   - Replace `YOUR_OPENWEATHERMAP_API_KEY` in `script.js` with your actual API key

2. **Install Dependencies** (for CORS proxy):
   ```bash
   npm install
   ```

3. **Run the Application**:
   ```bash
   # Option 1: With local CORS proxy (recommended)
   npm run dev
   
   # Option 2: Just the proxy server
   npm start
   
   # Option 3: Simple file server (limited functionality)
   python -m http.server 8000
   ```

4. **Access the Dashboard**:
   - With proxy: http://localhost:8000
   - Simple server: http://localhost:8000

## Data Sources

The dashboard integrates with these live sources for Scheveningen:
- **Hanglos.nl**: Real-time wind speed, direction, temperature, and wave height
- **Surftime.nl**: Tide information and marine conditions  
- **OpenWeatherMap API**: Temperature and weather forecasts (requires API key)
- **CORS Proxy**: Handles cross-origin requests to Dutch surf websites

## Customization

- **Colors**: Modify the blue gradient theme in `styles.css`
- **Location**: Change coordinates in `script.js` for different surf spots
- **Data Sources**: Replace mock data with additional APIs for waves and tides
- **Refresh Rate**: Adjust the 15-minute update interval in `script.js`

## File Structure

```
surfsession/
├── index.html          # Main HTML structure
├── styles.css          # Minimalistic styling with blue gradients  
├── script.js           # JavaScript for live data fetching
├── proxy-server.js     # CORS proxy for Dutch surf websites
├── package.json        # Node.js dependencies and scripts
└── README.md           # This file
```

## Browser Compatibility

- Modern browsers supporting ES6+ features
- Responsive design for mobile devices
- CSS Grid and Flexbox support required

## Halve Marathon Training Dashboard

Een tweede dashboard voor HM training (race 7 juni 2026) met live Strava data, schema, routes vanuit Maaswijkstraat Den Haag, pace zones en preventie checklist.

### Setup (eenmalig, ~5 min)

1. **Strava API app aanmaken**: ga naar https://www.strava.com/settings/api → "Create App"
   - Application Name: `HM Dashboard`
   - Category: `Training`
   - Website: `http://localhost`
   - Authorization Callback Domain: `localhost`
   - Noteer `Client ID` en `Client Secret`

2. **`.env` aanmaken met je Client ID en Secret**:
   ```bash
   cp .env.example .env
   # vul STRAVA_CLIENT_ID en STRAVA_CLIENT_SECRET in
   ```

3. **Installeren en setup runnen** (opent browser, vangt OAuth code automatisch op):
   ```bash
   npm install
   npm run setup
   ```
   → Browser opent → klik **Authorize** → refresh_token wordt automatisch opgeslagen in `.env`.

4. **Dashboard starten**:
   ```bash
   npm run training
   ```
   Open http://localhost:3002/training-dashboard.html

### Live op GitHub Pages

Het dashboard draait ook als statische site op GitHub Pages. Strava-data wordt elke ochtend (07:00 NL) ververst door de `.github/workflows/refresh-strava.yml` workflow, die `data/activities.json` en `data/strava-routes.json` regenereert en commit.

**Eenmalige setup voor de live site:**

1. Push deze repo naar GitHub (publiek).
2. Repo Settings → **Secrets and variables → Actions** → voeg toe:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `STRAVA_REFRESH_TOKEN`
3. Repo Settings → **Pages** → Source: `Deploy from a branch` → branch `main`, folder `/`.
4. Trigger de workflow handmatig (Actions tab → Refresh Strava data → Run workflow) om de eerste snapshot te maken.

Site komt op `https://<jouw-username>.github.io/<repo-naam>/training-dashboard.html`.

Lokaal genereren kan met:
```bash
npm run snapshot
```

### Features

- **Overzicht**: countdown tot race, deze week schema, voortgang vs plan, recente runs
- **Schema**: volledig 6-weken progressief opbouwschema (3 dagen/week)
- **Routes**: 5 routes vanuit Maaswijkstraat (5–21 km) op interactieve kaart
- **Zones**: pace en HR zones automatisch berekend uit Strava data
- **Preventie**: blessurepreventie checklist en red flags

### Plan aanpassen

Schema staat in `data/plan.json`. Routes in `data/routes.json` — waypoints zijn schattingen, vervang met je eigen Strava routes voor accurate tracks.

## Future Enhancements

- Integration with marine weather APIs for accurate wave data
- Tide charts and predictions
- Surf quality scoring algorithm
- Weather alerts and notifications
- Historical data trends