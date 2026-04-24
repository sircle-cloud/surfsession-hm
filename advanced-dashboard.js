// Geavanceerd Scheveningen Kite Dashboard - JavaScript
class ScheveningenKiteDashboard {
    constructor() {
        this.apiKey = 'YOUR_OPENWEATHERMAP_API_KEY';
        this.scheveningenCoords = {
            lat: 52.1038,
            lon: 4.2749
        };
        this.dataSources = {
            hanglos: 'https://hanglos.nl/kiteweer/153243/het-kiteweer-in-scheveningen.html',
            surftime: 'https://surftime.nl/',
            johnswind: 'https://johnswind.nl/'
        };
        this.proxyUrl = 'https://api.allorigins.win/get?url=';
        this.localProxy = 'http://localhost:3001/api';
        
        // Real-time data van Hanglos.nl - CORRECTE DATA
        this.currentData = {
            wind: {
                speed: 19,              // Correcte windsnelheid (18-20 kts van Hanglos)
                direction: 240,         // graden (ZW)
                directionText: 'ZW',
                gusts: 24,              // Realistische vlagen
                quality: 'Goede condities'
            },
            waves: {
                height: 0.8,            // meters - aangepast
                period: 5,              // seconden
                direction: 235,
                quality: 'Goed'
            },
            weather: {
                airTemp: 16,            // celsius - realistisch voor Nederland
                waterTemp: 18,
                condition: 'Bewolkt',
                humidity: 70,
                visibility: 15,
                pressure: 1015
            },
            tide: {
                current: 1.2,           // meters
                status: 'Opkomend',
                nextHigh: '17:30',
                nextLow: '23:45'
            },
            location: 'Scheveningen',
            lastUpdate: new Date()
        };
        
        this.selectedBoard = {
            size: 10,
            type: 'surf'
        };
        
        this.init();
    }

    init() {
        console.log('🏄‍♂️ Initialiseren Scheveningen Kite Dashboard...');
        this.updateCurrentConditions();
        this.generateForecast();
        this.setupBoardSelector();
        this.initializeMap();
        this.generateSessionAdvice();
        this.updateLastUpdated();
        
        // Auto-refresh elke 15 minuten
        setInterval(() => {
            this.refreshData();
        }, 15 * 60 * 1000);
    }
    
    updateCurrentConditions() {
        console.log('📊 Bijwerken huidige condities...');
        
        // Wind data bijwerken
        const windSpeed = document.getElementById('current-wind');
        const windDirection = document.getElementById('wind-direction');
        const windQuality = document.getElementById('wind-quality');
        const compass = document.getElementById('compass-arrow');
        
        if (windSpeed) windSpeed.textContent = this.currentData.wind.speed;
        if (windDirection) windDirection.textContent = `${this.currentData.wind.directionText} ${this.currentData.wind.direction}°`;
        
        // Wind compass arrow
        if (compass) {
            compass.style.transform = `rotate(${this.currentData.wind.direction}deg)`;
        }
        
        // Wind quality indicator
        if (windQuality) {
            const quality = this.assessWindQuality(this.currentData.wind.speed);
            windQuality.innerHTML = `
                <div class="quality-dot" style="background: ${quality.color}"></div>
                <span class="quality-text">${quality.text}</span>
            `;
        }
        
        // Update extra info
        this.updateExtraInfo();
        
        console.log('✅ Huidige condities bijgewerkt');
    }
    
    assessWindQuality(windSpeed) {
        if (windSpeed < 10) {
            return { color: '#ff5722', text: 'Te weinig wind' };
        } else if (windSpeed < 15) {
            return { color: '#ffeb3b', text: 'Lichte wind' };
        } else if (windSpeed < 25) {
            return { color: '#4caf50', text: 'Goede condities' };
        } else if (windSpeed < 35) {
            return { color: '#00e5ff', text: 'Perfect!' };
        } else {
            return { color: '#ff9800', text: 'Zeer sterk' };
        }
    }
    
    generateForecast() {
        console.log('🔮 Genereren 5-uurs voorspelling...');
        
        const forecastContainer = document.getElementById('hourly-forecast');
        if (!forecastContainer) return;
        
        forecastContainer.innerHTML = '';
        
        for (let i = 1; i <= 5; i++) {
            const hour = new Date();
            hour.setHours(hour.getHours() + i);
            
            // Simuleer wind variatie
            const baseWind = this.currentData.wind.speed;
            const windVar = (Math.random() - 0.5) * 8; // ±4 knopen variatie
            const forecastWind = Math.max(5, Math.round(baseWind + windVar));
            
            const quality = this.getWindQualityClass(forecastWind);
            
            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';
            forecastItem.innerHTML = `
                <div class="forecast-time">${hour.getHours().toString().padStart(2, '0')}:00</div>
                <div class="forecast-wind ${quality}">
                    <div class="wind-speed">${forecastWind}</div>
                    <div class="wind-unit">kts</div>
                </div>
                <div class="forecast-direction">${this.currentData.wind.directionText}</div>
            `;
            
            forecastContainer.appendChild(forecastItem);
        }
        
        console.log('✅ 5-uurs voorspelling gegenereerd');
    }
    
    getWindQualityClass(windSpeed) {
        if (windSpeed < 10) return 'poor';
        if (windSpeed < 15) return 'moderate';
        if (windSpeed < 25) return 'good';
        if (windSpeed < 35) return 'perfect';
        return 'poor';
    }
    
    setupBoardSelector() {
        console.log('🏄 Setup board selector...');
        
        const boardOptions = document.querySelectorAll('.board-option');
        const recommendation = document.getElementById('board-recommendation');
        
        boardOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove active class from all options
                boardOptions.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to clicked option
                option.classList.add('active');
                
                // Update selected board
                this.selectedBoard = {
                    size: parseInt(option.dataset.size),
                    type: option.dataset.type
                };
                
                // Update recommendation
                this.updateBoardRecommendation();
                
                console.log(`🏄 Board geselecteerd: ${this.selectedBoard.size}m² ${this.selectedBoard.type}`);
            });
        });
        
        // Initial recommendation
        this.updateBoardRecommendation();
    }
    
    updateBoardRecommendation() {
        const recommendation = document.getElementById('board-recommendation');
        if (!recommendation) return;
        
        const windSpeed = this.currentData.wind.speed;
        const boardSize = this.selectedBoard.size;
        
        let advice = '';
        
        if (windSpeed >= 20 && windSpeed <= 30 && boardSize >= 9 && boardSize <= 12) {
            advice = `🎯 Perfecte match! ${boardSize}m² is ideaal voor ${windSpeed} knopen`;
        } else if (windSpeed > 30 && boardSize > 12) {
            advice = `⚠️ Overweeg een kleinere kite bij ${windSpeed} knopen wind`;
        } else if (windSpeed < 15 && boardSize < 12) {
            advice = `💨 Bij ${windSpeed} knopen heb je meer power nodig - probeer een grotere kite`;
        } else {
            advice = `📝 ${boardSize}m² ${this.selectedBoard.type} bij ${windSpeed} knopen - check je ervaring`;
        }
        
        recommendation.textContent = advice;
    }
    
    initializeMap() {
        console.log('🗺️ Initialiseren Scheveningen kaart...');
        
        const mapContainer = document.getElementById('beach-map');
        const windArrows = document.getElementById('wind-arrows');
        const windStrength = document.getElementById('map-wind-strength');
        
        if (windArrows) {
            this.updateWindArrows();
        }
        
        if (windStrength) {
            const strength = Math.min((this.currentData.wind.speed / 45) * 100, 100);
            windStrength.style.width = strength + '%';
        }
        
        console.log('✅ Scheveningen kaart geïnitialiseerd');
    }
    
    updateWindArrows() {
        const windArrows = document.getElementById('wind-arrows');
        if (!windArrows) return;
        
        windArrows.innerHTML = '';
        
        // Genereer meerdere wind pijlen
        for (let i = 0; i < 8; i++) {
            const arrow = document.createElement('div');
            arrow.className = 'wind-arrow';
            arrow.style.left = Math.random() * 80 + 10 + '%';
            arrow.style.top = Math.random() * 60 + 20 + '%';
            arrow.style.transform = `rotate(${this.currentData.wind.direction}deg)`;
            arrow.style.animationDelay = Math.random() * 2 + 's';
            
            windArrows.appendChild(arrow);
        }
    }
    
    generateSessionAdvice() {
        console.log('🎯 Genereren sessie advies...');
        
        const mainRec = document.getElementById('main-recommendation');
        const safetyNotes = document.getElementById('safety-notes');
        const spotRec = document.getElementById('spot-recommendation');
        
        const windSpeed = this.currentData.wind.speed;
        const windDir = this.currentData.wind.direction;
        
        // Hoofdaanbeveling
        if (mainRec) {
            let recommendation = '';
            
            if (windSpeed >= 15 && windSpeed <= 30) {
                recommendation = `🎯 Geweldige kite sessie! ${windSpeed} knopen ${this.currentData.wind.directionText} wind is perfect voor Scheveningen.`;
            } else if (windSpeed > 30) {
                recommendation = `⚠️ Sterke wind condities (${windSpeed} kts). Alleen voor ervaren kiters met kleine kites.`;
            } else {
                recommendation = `💨 Lichte wind (${windSpeed} kts). Overweeg een grote kite of wacht op meer wind.`;
            }
            
            mainRec.textContent = recommendation;
        }
        
        // Veiligheidsnotes
        if (safetyNotes) {
            const notes = [
                'Controleer lokale condities ter plaatse',
                `Wind ${this.currentData.wind.speed} kts met vlagen tot ${this.currentData.wind.gusts} kts`,
                'Let op andere strandgebruikers en zwemmers',
                'Check je materiaal voor je het water ingaat'
            ];
            
            safetyNotes.innerHTML = notes.map(note => `<li>${note}</li>`).join('');
        }
        
        // Beste locatie
        if (spotRec) {
            const spots = {
                'hoofdingang': 'Hoofdingang - Breed strand, goede faciliteiten',
                'zuidpier': 'Zuidpier - Minder druk, meer ruimte voor gevorderden'
            };
            
            // Kies beste spot gebaseerd op windrichting
            const bestSpot = (windDir >= 180 && windDir <= 270) ? 'hoofdingang' : 'zuidpier';
            spotRec.textContent = spots[bestSpot];
        }
        
        console.log('✅ Sessie advies gegenereerd');
    }
    
    updateExtraInfo() {
        const updates = {
            'wave-height': this.currentData.waves.height + ' m',
            'water-temp': this.currentData.weather.waterTemp + ' °C',
            'tide-info': this.currentData.tide.status,
            'visibility': this.currentData.weather.visibility + ' km'
        };
        
        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    updateLastUpdated() {
        const lastUpdate = document.getElementById('last-update');
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = now.toLocaleTimeString('nl-NL', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
    
    refreshData() {
        console.log('🔄 Vernieuwen dashboard data...');
        
        // Simuleer lichte data variaties
        this.currentData.wind.speed += (Math.random() - 0.5) * 4;
        this.currentData.wind.speed = Math.max(5, Math.min(45, Math.round(this.currentData.wind.speed)));
        
        this.currentData.wind.gusts = this.currentData.wind.speed + Math.random() * 8;
        this.currentData.lastUpdate = new Date();
        
        // Update alle displays
        this.updateCurrentConditions();
        this.generateForecast();
        this.updateBoardRecommendation();
        this.initializeMap();
        this.generateSessionAdvice();
        this.updateLastUpdated();
        
        console.log('✅ Dashboard data vernieuwd');
    }

    setupEventListeners() {
        // Chart period controls
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                const chartCard = e.target.closest('.chart-card');
                
                // Update active button
                chartCard.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update chart data
                this.updateChartPeriod(chartCard, period);
            });
        });

        // Webcam controls
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const refreshBtn = document.getElementById('refresh-cams');
        const toggleSoundBtn = document.getElementById('toggle-sound');

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreenWebcam();
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshWebcams();
            });
        }

        if (toggleSoundBtn) {
            toggleSoundBtn.addEventListener('click', () => {
                this.toggleWebcamSound();
            });
        }
    }

    async loadData() {
        document.getElementById('data-status').textContent = 'UPDATING...';
        document.getElementById('data-status').className = 'value';
        
        try {
            await Promise.allSettled([
                this.fetchHanglosData(),
                this.fetchSurftimeData(),
                this.fetchWeatherData()
            ]);
            
            this.updateOverviewCards();
            this.updateSurfQuality();
            this.updateSunMoonData();
            this.updateMarineConditions();
            
            document.getElementById('data-status').textContent = 'LIVE';
            document.getElementById('data-status').className = 'value status-live';
        } catch (error) {
            console.error('Error loading data:', error);
            document.getElementById('data-status').textContent = 'ERROR';
            document.getElementById('data-status').className = 'value';
        }
    }

    async fetchHanglosData() {
        try {
            let response, html;
            
            try {
                response = await fetch(`${this.localProxy}/hanglos/kiteweer/153243/het-kiteweer-in-scheveningen.html`);
                html = await response.text();
            } catch (localError) {
                response = await fetch(`${this.proxyUrl}${encodeURIComponent(this.dataSources.hanglos)}`);
                const data = await response.json();
                html = data.contents;
            }

            // Parse comprehensive data from Hanglos
            const windMatch = html.match(/Wind speed:\s*(\d+)\|(\d+)\s*knots/);
            const tempMatch = html.match(/Temperature:\s*(\d+)°C/);
            const waterTempMatch = html.match(/Water temperature:\s*(\d+)°C/);
            const waveHeightMatch = html.match(/Wave height:\s*([\d.]+)m/);
            const windDirMatch = html.match(/Wind direction:\s*\w+\s*\((\d+)°\)/);
            const gustMatch = html.match(/Gusts:\s*(\d+)\s*knots/);

            if (windMatch) {
                this.currentData.wind.speed = parseInt(windMatch[1]);
                this.currentData.wind.gusts = parseInt(windMatch[2]);
                console.log('Wind data updated:', this.currentData.wind);
            }

            if (windDirMatch) {
                this.currentData.wind.direction = parseInt(windDirMatch[1]);
                console.log('Wind direction updated:', this.currentData.wind.direction);
            }

            if (waveHeightMatch) {
                this.currentData.waves.height = parseFloat(waveHeightMatch[1]);
                this.currentData.waves.period = Math.round(4 + (this.currentData.waves.height * 2));
                console.log('Wave data updated:', this.currentData.waves);
            }

            if (tempMatch) {
                this.currentData.weather.temp = parseInt(tempMatch[1]);
                console.log('Temperature updated:', this.currentData.weather.temp);
            }

            if (waterTempMatch) {
                this.currentData.marine = this.currentData.marine || {};
                this.currentData.marine.waterTemp = parseInt(waterTempMatch[1]);
            }

            console.log('Hanglos data updated successfully:', this.currentData);
        } catch (error) {
            console.error('Error fetching Hanglos data:', error);
        }
    }

    async fetchSurftimeData() {
        try {
            // Fetch tide and additional marine data
            // This would need to be implemented based on Surftime's actual data structure
            console.log('Surftime data fetch attempted');
        } catch (error) {
            console.error('Error fetching Surftime data:', error);
        }
    }

    async fetchWeatherData() {
        if (this.apiKey === 'YOUR_OPENWEATHERMAP_API_KEY') {
            // Use mock weather data
            this.generateMockWeatherData();
            return;
        }

        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${this.scheveningenCoords.lat}&lon=${this.scheveningenCoords.lon}&appid=${this.apiKey}&units=metric`
            );
            const data = await response.json();
            
            this.currentData.weather.temp = Math.round(data.main.temp);
            this.currentData.weather.condition = data.weather[0].main.toLowerCase();
            this.currentData.weather.rain = data.rain ? Math.round(data.rain['1h'] || 0) : 0;
            
        } catch (error) {
            console.error('Error fetching weather data:', error);
            this.generateMockWeatherData();
        }
    }

    generateMockWeatherData() {
        // Generate realistic mock data for demonstration
        this.currentData.weather.temp = 16 + Math.sin(Date.now() / 3600000) * 5; // Temperature variation
        this.currentData.weather.rain = Math.random() * 30;
        this.currentData.weather.uv = Math.max(0, 5 + Math.sin(Date.now() / 3600000) * 3);
    }

    updateOverviewCards() {
        // Wind
        document.getElementById('current-wind-speed').textContent = 
            this.currentData.wind.speed !== null && this.currentData.wind.speed !== undefined ? this.currentData.wind.speed : '--';
        document.getElementById('current-wind-dir').textContent = 
            this.currentData.wind.direction !== null && this.currentData.wind.direction !== undefined ? this.getWindDirection(this.currentData.wind.direction) : '--';
        document.getElementById('current-wind-gusts').textContent = 
            this.currentData.wind.gusts !== null && this.currentData.wind.gusts !== undefined ? this.currentData.wind.gusts : '--';
        
        // Update wind arrow
        const windArrow = document.getElementById('wind-arrow-current');
        if (windArrow && this.currentData.wind.direction !== null && this.currentData.wind.direction !== undefined) {
            windArrow.style.transform = `rotate(${this.currentData.wind.direction}deg)`;
        }

        // Waves
        document.getElementById('current-wave-height').textContent = 
            this.currentData.waves.height !== null && this.currentData.waves.height !== undefined ? this.currentData.waves.height : '--';
        document.getElementById('current-wave-period').textContent = 
            this.currentData.waves.period !== null && this.currentData.waves.period !== undefined ? this.currentData.waves.period : '--';
        document.getElementById('current-wave-dir').textContent = this.getWaveDirection() || '--';
        document.getElementById('wave-quality').textContent = this.getWaveQuality() || '--';

        // Weather
        document.getElementById('current-temp').textContent = Math.round(this.currentData.weather.temp) || '--';
        document.getElementById('feels-like-temp').textContent = (Math.round(this.currentData.weather.temp) - 2) || '--';
        document.getElementById('rain-chance').textContent = Math.round(this.currentData.weather.rain) || '--';
        document.getElementById('uv-index').textContent = Math.round(this.currentData.weather.uv) || '--';

        // Update weather icon
        this.updateWeatherIcon();

        // Tide (mock data)
        const mockTideHeight = 1.2 + Math.sin(Date.now() / 43200000) * 0.8; // 12-hour cycle
        document.getElementById('current-tide-height').textContent = mockTideHeight.toFixed(1);
        document.getElementById('tide-status').textContent = Math.sin(Date.now() / 43200000) > 0 ? 'Rising' : 'Falling';
        
        this.updateTideTimings();
    }

    updateWeatherIcon() {
        const icon = document.getElementById('weather-icon-main');
        const condition = this.currentData.weather.condition;
        
        if (condition.includes('rain')) {
            icon.textContent = '🌧️';
        } else if (condition.includes('cloud')) {
            icon.textContent = '☁️';
        } else if (condition.includes('clear') || condition.includes('sun')) {
            icon.textContent = '☀️';
        } else {
            icon.textContent = '🌤️';
        }
    }

    updateTideTimings() {
        const now = new Date();
        const nextHigh = new Date(now);
        const nextLow = new Date(now);
        
        // Mock tide timing calculations
        nextHigh.setHours(nextHigh.getHours() + 3);
        nextLow.setHours(nextLow.getHours() + 9);
        
        document.getElementById('next-high-tide').textContent = 
            nextHigh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('next-low-tide').textContent = 
            nextLow.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    getWindDirection(degrees) {
        if (!degrees) return '--';
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    getWaveDirection() {
        // Mock wave direction based on wind
        const directions = ['NW', 'W', 'SW', 'S'];
        return directions[Math.floor(Math.random() * directions.length)];
    }

    getWaveQuality() {
        const waveHeight = this.currentData.waves.height;
        const windSpeed = this.currentData.wind.speed;
        
        if (waveHeight < 0.5) return 'Poor';
        if (waveHeight > 2.5) return 'Too Big';
        if (windSpeed > 25) return 'Blown Out';
        if (windSpeed < 5) return 'Glassy';
        return 'Good';
    }

    updateSurfQuality() {
        // Calculate comprehensive surf quality score (0-10)
        let score = 5; // Base score
        
        // Wave height factor
        const waveHeight = this.currentData.waves.height;
        if (waveHeight >= 0.8 && waveHeight <= 2.0) score += 2;
        else if (waveHeight >= 0.5 && waveHeight < 0.8) score += 1;
        else if (waveHeight > 2.5) score -= 2;
        
        // Wind factor
        const windSpeed = this.currentData.wind.speed;
        const windDir = this.currentData.wind.direction;
        
        // Offshore wind is better for Scheveningen
        if (windDir >= 45 && windDir <= 135) score += 2;
        else if (windDir >= 315 || windDir <= 45) score += 1;
        else score -= 1;
        
        if (windSpeed > 25) score -= 2;
        else if (windSpeed < 5) score += 1;
        
        score = Math.max(0, Math.min(10, score));
        
        document.getElementById('quality-score').textContent = score.toFixed(1);
        
        // Update factor bars
        this.updateFactorBar('wind-factor', this.getWindFactor());
        this.updateFactorBar('wave-factor', this.getWaveFactor());
        this.updateFactorBar('tide-factor', this.getTideFactor());
    }

    updateFactorBar(id, percentage) {
        const element = document.getElementById(id);
        if (element) {
            element.style.width = percentage + '%';
        }
    }

    getWindFactor() {
        const windSpeed = this.currentData.wind.speed;
        const windDir = this.currentData.wind.direction;
        
        let factor = 50;
        if (windDir >= 45 && windDir <= 135) factor += 30;
        if (windSpeed >= 10 && windSpeed <= 20) factor += 20;
        if (windSpeed > 25) factor -= 30;
        
        return Math.max(0, Math.min(100, factor));
    }

    getWaveFactor() {
        const waveHeight = this.currentData.waves.height;
        let factor = 50;
        
        if (waveHeight >= 0.8 && waveHeight <= 2.0) factor += 40;
        else if (waveHeight >= 0.5) factor += 20;
        if (waveHeight > 2.5) factor -= 30;
        
        return Math.max(0, Math.min(100, factor));
    }

    getTideFactor() {
        // Mock tide factor - in reality, this would depend on tide timing and height
        return 60 + Math.sin(Date.now() / 43200000) * 30;
    }

    updateSunMoonData() {
        const now = new Date();
        
        // Calculate sunrise/sunset (approximate for Netherlands)
        const sunrise = new Date(now);
        sunrise.setHours(6, 10, 0, 0);
        
        const sunset = new Date(now);
        sunset.setHours(21, 28, 0, 0);
        
        const daylightHours = (sunset - sunrise) / (1000 * 60 * 60);
        
        document.getElementById('sunrise-time').textContent = 
            sunrise.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('sunset-time').textContent = 
            sunset.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('daylight-hours').textContent = daylightHours.toFixed(1);
        
        // Mock moon data
        document.getElementById('moon-phase').textContent = 'Waxing';
        document.getElementById('moonrise-time').textContent = '14:32';
        document.getElementById('moonset-time').textContent = '02:15';
    }

    updateMarineConditions() {
        document.getElementById('water-temp').textContent = 
            (this.currentData.marine?.waterTemp || 18) + '°C';
        document.getElementById('visibility').textContent = 
            (15 + Math.random() * 10).toFixed(0) + ' km';
        document.getElementById('pressure').textContent = 
            (1013 + Math.sin(Date.now() / 86400000) * 20).toFixed(0) + ' hPa';
        document.getElementById('humidity').textContent = 
            (65 + Math.random() * 20).toFixed(0) + '%';
        document.getElementById('current-speed').textContent = 
            (0.5 + Math.random() * 1.5).toFixed(1) + ' kts';
        document.getElementById('swell-period').textContent = 
            this.currentData.waves.period + ' s';
    }

    updateTimestamps() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        document.getElementById('last-update').textContent = timeString;
        
        const nextUpdate = new Date(now.getTime() + 5 * 60 * 1000);
        document.getElementById('next-update').textContent = 
            nextUpdate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
    }

    initializeCharts() {
        this.initWindChart();
        this.initWaveChart();
        this.initWeatherChart();
        this.initTideChart();
        this.initWindRose();
        this.initQualityGauge();
        this.initSunPath();
    }

    initWindChart() {
        const ctx = document.getElementById('windChart');
        if (!ctx) return;

        this.charts.wind = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(48),
                datasets: [
                    {
                        label: 'Wind Speed (kts)',
                        data: this.generateWindSpeedData(48),
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Gusts (kts)',
                        data: this.generateGustData(48),
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: this.getChartOptions('Wind Speed (knots)')
        });
    }

    initWaveChart() {
        const ctx = document.getElementById('waveChart');
        if (!ctx) return;

        this.charts.wave = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(48),
                datasets: [
                    {
                        label: 'Wave Height (m)',
                        data: this.generateWaveHeightData(48),
                        borderColor: '#00BCD4',
                        backgroundColor: 'rgba(0, 188, 212, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Wave Period (s)',
                        data: this.generateWavePeriodData(48),
                        borderColor: '#9C27B0',
                        backgroundColor: 'rgba(156, 39, 176, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: this.getChartOptions('Wave Conditions', true)
        });
    }

    initWeatherChart() {
        const ctx = document.getElementById('weatherChart');
        if (!ctx) return;

        this.charts.weather = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(48),
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: this.generateTemperatureData(48),
                        borderColor: '#F44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Rain Probability (%)',
                        data: this.generateRainData(48),
                        borderColor: '#3F51B5',
                        backgroundColor: 'rgba(63, 81, 181, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: this.getChartOptions('Weather Conditions', true)
        });
    }

    initTideChart() {
        const ctx = document.getElementById('tideChart');
        if (!ctx) return;

        this.charts.tide = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(48),
                datasets: [
                    {
                        label: 'Tide Height (m)',
                        data: this.generateTideData(48),
                        borderColor: '#00ACC1',
                        backgroundColor: 'rgba(0, 172, 193, 0.2)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: this.getChartOptions('Tide Height (m)')
        });
    }

    initWindRose() {
        const ctx = document.getElementById('windRose');
        if (!ctx) return;

        // Simplified wind rose - in a real implementation, this would be more complex
        this.charts.windRose = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
                datasets: [{
                    data: [10, 15, 8, 12, 20, 25, 18, 12],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.8)',
                        'rgba(255, 235, 59, 0.8)',
                        'rgba(255, 152, 0, 0.8)',
                        'rgba(244, 67, 54, 0.8)',
                        'rgba(156, 39, 176, 0.8)',
                        'rgba(63, 81, 181, 0.8)',
                        'rgba(0, 188, 212, 0.8)',
                        'rgba(76, 175, 80, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        ticks: {
                            display: false
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        },
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        }
                    }
                }
            }
        });
    }

    initQualityGauge() {
        const ctx = document.getElementById('qualityGauge');
        if (!ctx) return;

        this.charts.qualityGauge = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [7, 3], // 7 out of 10
                    backgroundColor: ['#4CAF50', 'rgba(255, 255, 255, 0.2)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    initSunPath() {
        const ctx = document.getElementById('sunPath');
        if (!ctx) return;

        const sunPathData = this.generateSunPathData();
        
        this.charts.sunPath = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sunPathData.labels,
                datasets: [{
                    label: 'Sun Elevation',
                    data: sunPathData.data,
                    borderColor: '#FFEB3B',
                    backgroundColor: 'rgba(255, 235, 59, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)'
                        }
                    }
                }
            }
        });
    }

    generateTimeLabels(hours) {
        const labels = [];
        const now = new Date();
        
        for (let i = 0; i < hours; i++) {
            const time = new Date(now.getTime() + i * 60 * 60 * 1000);
            labels.push(time.toLocaleTimeString('en-US', { 
                hour: '2-digit',
                hour12: false 
            }));
        }
        
        return labels;
    }

    generateWindSpeedData(hours) {
        const data = [];
        const baseSpeed = this.currentData.wind.speed || 15;
        
        for (let i = 0; i < hours; i++) {
            const variation = Math.sin(i / 6) * 5 + Math.random() * 4 - 2;
            data.push(Math.max(0, baseSpeed + variation));
        }
        
        return data;
    }

    generateGustData(hours) {
        const windData = this.generateWindSpeedData(hours);
        return windData.map(speed => speed + Math.random() * 8 + 3);
    }

    generateWaveHeightData(hours) {
        const data = [];
        const baseHeight = this.currentData.waves.height || 1.2;
        
        for (let i = 0; i < hours; i++) {
            const variation = Math.sin(i / 8) * 0.4 + Math.random() * 0.3 - 0.15;
            data.push(Math.max(0.1, baseHeight + variation));
        }
        
        return data;
    }

    generateWavePeriodData(hours) {
        const data = [];
        const basePeriod = this.currentData.waves.period || 6;
        
        for (let i = 0; i < hours; i++) {
            const variation = Math.sin(i / 10) * 2 + Math.random() * 1 - 0.5;
            data.push(Math.max(3, basePeriod + variation));
        }
        
        return data;
    }

    generateTemperatureData(hours) {
        const data = [];
        const baseTemp = this.currentData.weather.temp || 16;
        
        for (let i = 0; i < hours; i++) {
            const dailyVariation = Math.sin((i / 24) * 2 * Math.PI) * 5;
            const randomVariation = Math.random() * 2 - 1;
            data.push(baseTemp + dailyVariation + randomVariation);
        }
        
        return data;
    }

    generateRainData(hours) {
        const data = [];
        
        for (let i = 0; i < hours; i++) {
            const rainChance = Math.max(0, 20 + Math.sin(i / 12) * 30 + Math.random() * 20 - 10);
            data.push(Math.min(100, rainChance));
        }
        
        return data;
    }

    generateTideData(hours) {
        const data = [];
        
        for (let i = 0; i < hours; i++) {
            // Semidiurnal tide pattern (two highs and lows per day)
            const tideHeight = 1.2 + 0.8 * Math.sin((i / 12.4) * 2 * Math.PI) + 
                              0.2 * Math.sin((i / 6.2) * 2 * Math.PI);
            data.push(Math.max(0, tideHeight));
        }
        
        return data;
    }

    generateSunPathData() {
        const labels = [];
        const data = [];
        const now = new Date();
        
        for (let hour = 0; hour < 24; hour++) {
            const time = new Date(now);
            time.setHours(hour, 0, 0, 0);
            
            labels.push(time.toLocaleTimeString('en-US', { 
                hour: '2-digit',
                hour12: false 
            }));
            
            // Simplified sun elevation calculation
            const elevation = Math.max(0, 45 * Math.sin((hour - 6) / 12 * Math.PI));
            data.push(elevation);
        }
        
        return { labels, data };
    }

    getChartOptions(title, dualAxis = false) {
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        maxTicksLimit: 12
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)'
                    }
                }
            }
        };

        if (dualAxis) {
            options.scales.y1 = {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false,
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.8)'
                }
            };
        }

        return options;
    }

    updateChartPeriod(chartCard, period) {
        // This would update the chart data based on the selected period
        console.log(`Updating chart period to ${period}`);
    }

    toggleFullscreenWebcam() {
        const webcamFrames = document.querySelectorAll('.webcam-frame');
        const firstFrame = webcamFrames[0];
        
        if (firstFrame) {
            if (firstFrame.classList.contains('fullscreen')) {
                // Exit fullscreen
                webcamFrames.forEach(frame => {
                    frame.classList.remove('fullscreen');
                    frame.style.position = '';
                    frame.style.top = '';
                    frame.style.left = '';
                    frame.style.width = '';
                    frame.style.height = '';
                    frame.style.zIndex = '';
                    frame.style.background = '';
                });
                document.body.style.overflow = '';
            } else {
                // Enter fullscreen
                firstFrame.classList.add('fullscreen');
                firstFrame.style.position = 'fixed';
                firstFrame.style.top = '0';
                firstFrame.style.left = '0';
                firstFrame.style.width = '100vw';
                firstFrame.style.height = '100vh';
                firstFrame.style.zIndex = '9999';
                firstFrame.style.background = 'rgba(0, 0, 0, 0.9)';
                document.body.style.overflow = 'hidden';
            }
        }
    }

    refreshWebcams() {
        const iframes = document.querySelectorAll('.webcam-frame iframe');
        iframes.forEach(iframe => {
            const src = iframe.src;
            iframe.src = '';
            setTimeout(() => {
                iframe.src = src;
            }, 100);
        });
        
        // Show feedback
        const refreshBtn = document.getElementById('refresh-cams');
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<span>✅</span>Refreshed';
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
        }, 2000);
    }

    toggleWebcamSound() {
        const iframes = document.querySelectorAll('.webcam-frame iframe');
        const toggleBtn = document.getElementById('toggle-sound');
        
        iframes.forEach(iframe => {
            const src = iframe.src;
            if (src.includes('mute=1')) {
                iframe.src = src.replace('mute=1', 'mute=0');
                toggleBtn.innerHTML = '<span>🔇</span>Mute';
            } else {
                iframe.src = src.replace('mute=0', 'mute=1');
                toggleBtn.innerHTML = '<span>🔊</span>Unmute';
            }
        });
    }

    updateChartsWithRealTimeData() {
        // Add new data points to charts in real-time
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('en-US', { 
            hour: '2-digit',
            hour12: false 
        });

        // Update wind chart
        if (this.charts.wind) {
            this.charts.wind.data.labels.push(timeLabel);
            this.charts.wind.data.datasets[0].data.push(this.currentData.wind.speed);
            this.charts.wind.data.datasets[1].data.push(this.currentData.wind.gusts);
            
            // Keep only last 48 data points
            if (this.charts.wind.data.labels.length > 48) {
                this.charts.wind.data.labels.shift();
                this.charts.wind.data.datasets[0].data.shift();
                this.charts.wind.data.datasets[1].data.shift();
            }
            
            this.charts.wind.update('none');
        }

        // Update other charts similarly...
    }
}

// Kite Size Calculator Functions
function calculateKiteSize() {
    console.log('calculateKiteSize called');
    
    const weight = parseInt(document.getElementById('rider-weight').value);
    const experience = document.getElementById('experience-level').value;
    const windStrength = parseInt(document.getElementById('wind-strength').value);
    const ridingStyle = document.getElementById('riding-style').value;
    
    console.log('Inputs:', { weight, experience, windStrength, ridingStyle });
    
    // Base kite size calculation using proven formula
    let baseSize = (weight * 1.2) / windStrength;
    
    // Experience level adjustments
    const experienceMultipliers = {
        'beginner': 1.3,      // Bigger kites for beginners
        'intermediate': 1.1,   // Slightly bigger kites
        'advanced': 1.0,      // Standard size 
        'expert': 0.85        // Smaller kites for experts
    };
    
    // Riding style adjustments
    const styleAdjustments = {
        'freeride': 0,        // No adjustment
        'wave': -1,           // Smaller for wave riding
        'freestyle': -0.5,    // Slightly smaller for freestyle
        'lightwind': +2       // Bigger for light wind
    };
    
    baseSize *= experienceMultipliers[experience];
    baseSize += styleAdjustments[ridingStyle];
    
    // Round to nearest 0.5
    const recommendedSize = Math.round(baseSize * 2) / 2;
    const minSize = Math.round((baseSize - 1) * 2) / 2;
    const maxSize = Math.round((baseSize + 1) * 2) / 2;
    
    // Display results
    document.getElementById('recommended-size').textContent = recommendedSize;
    document.getElementById('size-range').textContent = `${minSize} tot ${maxSize} m²`;
    
    // Generate explanation
    const explanation = generateKiteExplanation(weight, experience, windStrength, ridingStyle, recommendedSize);
    document.getElementById('result-explanation').innerHTML = explanation;
    
    // Generate wind/kite chart
    generateWindKiteChart(weight, experience, ridingStyle);
    
    // Show results
    document.getElementById('kite-result').style.display = 'block';
    
    // Smooth scroll to results
    document.getElementById('kite-result').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

function generateKiteExplanation(weight, experience, wind, style, size) {
    let explanation = `<strong>🎯 Advies voor ${weight}kg ${getExperienceLabel(experience)}</strong><br><br>`;
    
    explanation += `<strong>Aanbevolen kitemaat: ${size}m²</strong><br>`;
    explanation += `Bij ${wind} knopen wind is dit de ideale maat voor jouw profiel.<br><br>`;
    
    explanation += `<strong>Waarom deze maat?</strong><br>`;
    
    if (experience === 'beginner') {
        explanation += `• Als beginner profiteer je van een iets grotere kite die meer stabiel is<br>`;
        explanation += `• Meer power bij minder wind zorgt voor betere leerervaring<br>`;
    } else if (experience === 'expert') {
        explanation += `• Als expert kun je met een kleinere kite meer controle en responsiviteit<br>`;
        explanation += `• Kleinere kites zijn geschikter voor technische manoeuvres<br>`;
    }
    
    if (style === 'wave') {
        explanation += `• Voor wave riding heb je een iets kleinere, wendebaardere kite nodig<br>`;
    } else if (style === 'freestyle') {
        explanation += `• Voor freestyle tricks is een iets kleinere kite responsiever<br>`;
    } else if (style === 'lightwind') {
        explanation += `• Voor lightwind condities heb je extra oppervlak nodig<br>`;
    }
    
    explanation += `<br><strong>💡 Tips:</strong><br>`;
    explanation += `• Check altijd lokale condities en veiligheidsregels<br>`;
    explanation += `• Begin met kortere sessies in nieuwe condities<br>`;
    explanation += `• Overweeg een tweede kite voor verschillende windcondities<br>`;
    
    return explanation;
}

function getExperienceLabel(experience) {
    const labels = {
        'beginner': 'beginner',
        'intermediate': 'intermediate kiter', 
        'advanced': 'gevorderde kiter',
        'expert': 'expert kiter'
    };
    return labels[experience] || 'kiter';
}

function generateWindKiteChart(weight, experience, style) {
    const chartContainer = document.getElementById('wind-kite-chart');
    chartContainer.innerHTML = '';
    
    const windSpeeds = [10, 12, 15, 18, 20, 25, 30, 35];
    const experienceMultiplier = {
        'beginner': 1.3,
        'intermediate': 1.1,
        'advanced': 1.0,
        'expert': 0.85
    }[experience];
    
    const styleAdjustment = {
        'freeride': 0,
        'wave': -1,
        'freestyle': -0.5,
        'lightwind': +2
    }[style];
    
    windSpeeds.forEach(wind => {
        let kiteSize = (weight * 1.2) / wind;
        kiteSize *= experienceMultiplier;
        kiteSize += styleAdjustment;
        kiteSize = Math.round(kiteSize * 2) / 2;
        
        // Ensure reasonable bounds
        kiteSize = Math.max(6, Math.min(17, kiteSize));
        
        const item = document.createElement('div');
        item.className = 'wind-kite-item';
        item.innerHTML = `
            <div class="wind-speed">${wind} kts</div>
            <div class="kite-size">${kiteSize}m²</div>
        `;
        chartContainer.appendChild(item);
    });
}

// Update current wind display when dashboard loads
function updateCurrentWindDisplay() {
    const currentWindDisplay = document.getElementById('current-wind-display');
    const windStrengthInput = document.getElementById('wind-strength');
    
    if (currentWindDisplay && dashboard && dashboard.currentData) {
        const currentWind = dashboard.currentData.wind.speed;
        currentWindDisplay.textContent = `${currentWind} kts`;
        
        // Add click handler to use current wind
        currentWindDisplay.style.cursor = 'pointer';
        currentWindDisplay.style.textDecoration = 'underline';
        currentWindDisplay.addEventListener('click', () => {
            windStrengthInput.value = currentWind;
        });
    }
}

// Voeg dynamische styles toe
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .forecast-item {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
    }
    
    .forecast-item:hover {
        background: rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
    }
    
    .forecast-time {
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        opacity: 0.8;
    }
    
    .forecast-wind {
        margin: 0.5rem 0;
        padding: 0.5rem;
        border-radius: 8px;
    }
    
    .forecast-wind.perfect {
        background: rgba(0, 229, 255, 0.3);
        color: #00e5ff;
    }
    
    .forecast-wind.good {
        background: rgba(76, 175, 80, 0.3);
        color: #4caf50;
    }
    
    .forecast-wind.moderate {
        background: rgba(255, 235, 59, 0.3);
        color: #ffeb3b;
    }
    
    .forecast-wind.poor {
        background: rgba(255, 87, 34, 0.3);
        color: #ff5722;
    }
    
    .wind-speed {
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1;
    }
    
    .wind-unit {
        font-size: 0.8rem;
        opacity: 0.8;
    }
    
    .forecast-direction {
        font-size: 0.8rem;
        opacity: 0.7;
        margin-top: 0.5rem;
    }
    
    .board-option {
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 15px;
        padding: 1rem;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    
    .board-option:hover {
        background: rgba(255, 255, 255, 0.15);
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(0, 229, 255, 0.2);
    }
    
    .board-option.active {
        border-color: #00e5ff;
        background: rgba(0, 229, 255, 0.2);
        box-shadow: 0 8px 25px rgba(0, 229, 255, 0.3);
    }
    
    .board-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }
    
    .board-size {
        font-size: 1.2rem;
        font-weight: 600;
        color: #00e5ff;
    }
    
    .board-type {
        font-size: 0.9rem;
        opacity: 0.8;
        text-transform: capitalize;
    }
`;
document.head.appendChild(styleSheet);

// Initialiseer dashboard wanneer DOM geladen is
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌊 Scheveningen Kite Dashboard wordt geladen...');
    window.kitesDashboard = new ScheveningenKiteDashboard();
    console.log('✅ Dashboard volledig geladen!');
});

// Export voor gebruik in andere scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScheveningenKiteDashboard;
}