class SurfDashboard {
    constructor() {
        this.apiKey = 'YOUR_OPENWEATHERMAP_API_KEY'; // Replace with actual API key
        this.scheveningenCoords = {
            lat: 52.1038,
            lon: 4.2749
        };
        this.dataSources = {
            johnswind: 'https://johnswind.nl/',
            surftime: 'https://surftime.nl/',
            hanglos: 'https://hanglos.nl/kiteweer/153243/het-kiteweer-in-scheveningen.html'
        };
        this.proxyUrl = 'https://api.allorigins.win/get?url=';
        this.localProxy = 'http://localhost:3001/api';
        this.init();
    }

    init() {
        this.updateLastUpdatedTime();
        this.loadWeatherData();
        
        // Initialize visualizations with default values
        this.updateCurrentVisualization('offshore');
        this.updateVisibility(15);
        
        // Update data every 15 minutes
        setInterval(() => {
            this.loadWeatherData();
        }, 15 * 60 * 1000);
    }

    async loadWeatherData() {
        try {
            // Try to fetch from multiple sources
            await Promise.allSettled([
                this.fetchHanglosData(),
                this.fetchSurftimeData(),
                this.fetchOpenWeatherData()
            ]);
        } catch (error) {
            console.error('Error loading weather data:', error);
            this.loadMockData();
        }
    }

    async fetchOpenWeatherData() {
        if (this.apiKey === 'YOUR_OPENWEATHERMAP_API_KEY') {
            return this.loadMockData();
        }

        try {
            const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${this.scheveningenCoords.lat}&lon=${this.scheveningenCoords.lon}&appid=${this.apiKey}&units=metric`;
            const marineUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${this.scheveningenCoords.lat}&lon=${this.scheveningenCoords.lon}&appid=${this.apiKey}&units=metric`;

            const [currentResponse, marineResponse] = await Promise.all([
                fetch(currentWeatherUrl),
                fetch(marineUrl)
            ]);

            const currentData = await currentResponse.json();
            const marineData = await marineResponse.json();

            this.updateTemperatureData(currentData);
            this.updateForecast(marineData.daily);
        } catch (error) {
            console.error('OpenWeather API error:', error);
        }
    }

    async fetchHanglosData() {
        try {
            // Try local proxy first, fallback to public proxy
            let response, html;
            
            try {
                response = await fetch(`${this.localProxy}/hanglos/kiteweer/153243/het-kiteweer-in-scheveningen.html`);
                html = await response.text();
            } catch (localError) {
                console.log('Local proxy unavailable, using public proxy');
                response = await fetch(`${this.proxyUrl}${encodeURIComponent(this.dataSources.hanglos)}`);
                const data = await response.json();
                html = data.contents;
            }

            // Parse wind data from Hanglos
            const windMatch = html.match(/Wind speed:\s*(\d+)\|(\d+)\s*knots/);
            const tempMatch = html.match(/Temperature:\s*(\d+)°C/);
            const waterTempMatch = html.match(/Water temperature:\s*(\d+)°C/);
            const waveHeightMatch = html.match(/Wave height:\s*([\d.]+)m/);
            const windDirMatch = html.match(/Wind direction:\s*\w+\s*\((\d+)°\)/);

            if (windMatch) {
                const windSpeedKnots = parseInt(windMatch[1]);
                const windSpeedKmh = Math.round(windSpeedKnots * 1.852);
                
                // Update multiple wind displays
                document.getElementById('wind-speed-knots').textContent = windSpeedKnots;
                document.getElementById('wind-speed-kmh').textContent = windSpeedKmh;
                
                // Update wind strength bar
                const strengthFill = document.getElementById('wind-strength-fill');
                const strengthPercent = Math.min((windSpeedKnots / 40) * 100, 100);
                strengthFill.style.width = strengthPercent + '%';
                
                // Update wind quality indicator
                this.updateWindQuality(windSpeedKnots);
            }

            if (windDirMatch) {
                const windDeg = parseInt(windDirMatch[1]);
                const windDirection = this.getWindDirection(windDeg);
                
                document.getElementById('wind-direction-text').textContent = windDirection;
                
                // Update wind compass arrow
                const windArrow = document.getElementById('wind-arrow');
                // Convert to beach-relative rotation (Scheveningen beach faces roughly southwest)
                const beachRelativeAngle = windDeg - 225; // 225° is roughly SW
                windArrow.style.transform = `rotate(${beachRelativeAngle}deg)`;
                
                // Update wind arrow color based on direction relative to beach
                this.updateWindArrowColor(windDeg);
            }

            if (waveHeightMatch) {
                const waveHeight = parseFloat(waveHeightMatch[1]);
                document.getElementById('wave-height').textContent = waveHeight;
                
                // Update wave visualization
                this.updateWaveVisualization(waveHeight);
            }

            if (tempMatch) {
                const temperature = parseInt(tempMatch[1]);
                document.getElementById('temperature').textContent = temperature;
                
                // Update weather visualization
                this.updateWeatherVisualization(temperature, 'Clear');
            }

            console.log('Hanglos data updated successfully');
        } catch (error) {
            console.error('Error fetching Hanglos data:', error);
        }
    }

    async fetchSurftimeData() {
        try {
            // Try local proxy first, fallback to public proxy
            let response, html;
            
            try {
                response = await fetch(`${this.localProxy}/surftime/`);
                html = await response.text();
            } catch (localError) {
                console.log('Local proxy unavailable, using public proxy');
                response = await fetch(`${this.proxyUrl}${encodeURIComponent(this.dataSources.surftime)}`);
                const data = await response.json();
                html = data.contents;
            }

            // Look for tide and additional wave information
            const tideMatch = html.match(/tide[^>]*>([^<]+)</i);
            if (tideMatch) {
                document.getElementById('tide-status').textContent = tideMatch[1];
            }

            console.log('Surftime data updated successfully');
        } catch (error) {
            console.error('Error fetching Surftime data:', error);
        }
    }

    loadMockData() {
        // Mock data for demonstration
        const mockCurrentData = {
            wind: {
                speed: 8.5,
                deg: 270
            },
            main: {
                temp: 16,
                feels_like: 14
            },
            weather: [{
                main: 'Clear',
                description: 'clear sky'
            }]
        };

        const mockMarineData = {
            current: {
                wind_speed: 8.5,
                wind_deg: 270
            },
            daily: [
                { dt: Date.now() / 1000, wind_speed: 8.5, temp: { day: 16 }, weather: [{ main: 'Clear' }] },
                { dt: (Date.now() / 1000) + 86400, wind_speed: 12.3, temp: { day: 18 }, weather: [{ main: 'Clouds' }] },
                { dt: (Date.now() / 1000) + 172800, wind_speed: 15.2, temp: { day: 15 }, weather: [{ main: 'Rain' }] },
                { dt: (Date.now() / 1000) + 259200, wind_speed: 6.8, temp: { day: 17 }, weather: [{ main: 'Clear' }] },
                { dt: (Date.now() / 1000) + 345600, wind_speed: 9.7, temp: { day: 19 }, weather: [{ main: 'Clouds' }] }
            ]
        };

        this.updateCurrentConditions(mockCurrentData, mockMarineData);
        this.updateForecast(mockMarineData.daily);
        this.updateLastUpdatedTime();
    }

    updateCurrentConditions(currentData, marineData) {
        // Wind data
        const windSpeed = Math.round(currentData.wind.speed * 3.6); // Convert m/s to km/h
        const windDirection = this.getWindDirection(currentData.wind.deg);
        
        document.getElementById('wind-speed').textContent = windSpeed;
        document.getElementById('wind-direction').textContent = windDirection;

        // Temperature data
        document.getElementById('temperature').textContent = Math.round(currentData.main.temp);
        document.getElementById('feels-like').textContent = `Feels like ${Math.round(currentData.main.feels_like)}°C`;

        // Mock wave data (would need marine weather API for real data)
        document.getElementById('wave-height').textContent = '0.8';
        document.getElementById('wave-period').textContent = '6 sec';

        // Mock tide data (would need tide API for real data)
        document.getElementById('tide-height').textContent = '1.2';
        document.getElementById('tide-status').textContent = 'Rising';
    }

    updateTemperatureData(currentData) {
        document.getElementById('temperature').textContent = Math.round(currentData.main.temp);
        document.getElementById('feels-like').textContent = `Feels like ${Math.round(currentData.main.feels_like)}°C`;
    }

    updateForecast(dailyData) {
        const forecastGrid = document.getElementById('forecast-grid');
        forecastGrid.innerHTML = '';

        dailyData.slice(0, 5).forEach((day, index) => {
            const date = new Date(day.dt * 1000);
            const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
            
            const windSpeed = Math.round(day.wind_speed * 3.6);
            const temp = Math.round(day.temp.day);
            const condition = day.weather[0].main;

            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.innerHTML = `
                <div class="day">${dayName}</div>
                <div class="metric">
                    <span class="value" style="font-size: 1.5rem;">${temp}</span>
                    <span class="unit">°C</span>
                </div>
                <div class="conditions">
                    <div>${condition}</div>
                    <div>Wind: ${windSpeed} km/h</div>
                    <div>Waves: 0.${Math.floor(Math.random() * 9) + 1}m</div>
                </div>
            `;
            
            forecastGrid.appendChild(forecastItem);
        });
    }

    getWindDirection(degrees) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    updateWindQuality(windSpeedKnots) {
        const qualityIndicator = document.querySelector('.quality-indicator');
        const qualityText = document.querySelector('.quality-text');
        
        if (windSpeedKnots < 10) {
            qualityIndicator.style.background = '#ff5722';
            qualityText.textContent = 'Light wind';
        } else if (windSpeedKnots < 20) {
            qualityIndicator.style.background = '#ffeb3b';
            qualityText.textContent = 'Good conditions';
        } else if (windSpeedKnots < 30) {
            qualityIndicator.style.background = '#4caf50';
            qualityText.textContent = 'Perfect wind!';
        } else {
            qualityIndicator.style.background = '#ff9800';
            qualityText.textContent = 'Strong wind';
        }
    }

    updateWindArrowColor(windDeg) {
        const windArrow = document.getElementById('wind-arrow');
        
        // Scheveningen optimal wind directions (offshore: NE to SE, roughly 45-135°)
        if ((windDeg >= 45 && windDeg <= 135)) {
            // Offshore wind - excellent for surfing
            windArrow.style.background = 'linear-gradient(180deg, #4caf50 0%, #2e7d32 50%, #1b5e20 100%)';
        } else if ((windDeg >= 315 || windDeg <= 45) || (windDeg >= 135 && windDeg <= 225)) {
            // Cross-shore wind - decent conditions
            windArrow.style.background = 'linear-gradient(180deg, #ffeb3b 0%, #fbc02d 50%, #f57f17 100%)';
        } else {
            // Onshore wind - not ideal
            windArrow.style.background = 'linear-gradient(180deg, #ff4444 0%, #ff8800 50%, #ffaa00 100%)';
        }
    }

    updateWaveVisualization(waveHeight) {
        const waveBars = document.querySelectorAll('.wave-bar');
        const baseHeight = Math.max(waveHeight * 0.8, 0.3);
        
        waveBars.forEach((bar, index) => {
            const variation = 0.8 + (Math.random() * 0.4); // Random variation between 0.8-1.2
            const height = baseHeight * variation;
            bar.style.setProperty('--height', height);
            bar.style.setProperty('--index', index);
        });

        // Update wave period (mock data based on wave height)
        const mockPeriod = Math.round(4 + (waveHeight * 2));
        document.getElementById('wave-period').textContent = mockPeriod;
    }

    updateWeatherVisualization(temperature, condition) {
        const weatherIcon = document.getElementById('weather-icon');
        const rainDrops = document.getElementById('rain-drops');
        const weatherCondition = document.getElementById('weather-condition');
        
        // Clear existing rain drops
        rainDrops.innerHTML = '';
        
        // Update weather icon and condition based on temperature and condition
        if (condition.toLowerCase().includes('rain')) {
            weatherCondition.textContent = 'Rainy';
            this.createRainDrops(rainDrops);
        } else if (temperature > 20) {
            weatherCondition.textContent = 'Sunny';
        } else if (temperature > 15) {
            weatherCondition.textContent = 'Partly Cloudy';
        } else {
            weatherCondition.textContent = 'Cool';
        }
        
        // Update rain probability bar (mock data)
        const rainFill = document.querySelector('.rain-fill');
        const rainProbability = condition.toLowerCase().includes('rain') ? 80 : 20;
        rainFill.style.setProperty('--fill', rainProbability + '%');
        rainFill.nextElementSibling.textContent = rainProbability + '% Rain';
    }

    createRainDrops(container) {
        for (let i = 0; i < 8; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = Math.random() * 100 + '%';
            drop.style.animationDelay = Math.random() * 1 + 's';
            drop.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
            container.appendChild(drop);
        }
    }

    updateCurrentVisualization(direction = 'offshore') {
        const currentArrows = document.querySelectorAll('.current-arrow');
        const currentDirection = document.getElementById('current-direction');
        
        currentDirection.textContent = direction;
        
        currentArrows.forEach((arrow, index) => {
            arrow.style.setProperty('--index', index);
            // Adjust animation based on current strength
            arrow.style.animationDuration = (1.5 + Math.random() * 1) + 's';
        });
    }

    updateVisibility(visibilityKm = 15) {
        const visibilityFill = document.getElementById('visibility-fill');
        const visibilityValue = document.getElementById('visibility');
        
        visibilityValue.textContent = visibilityKm;
        
        const visibilityPercent = Math.min((visibilityKm / 20) * 100, 100);
        visibilityFill.style.width = visibilityPercent + '%';
    }

    updateLastUpdatedTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        document.getElementById('last-updated').textContent = timeString;
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SurfDashboard();
});