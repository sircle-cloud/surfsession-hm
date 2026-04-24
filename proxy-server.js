// Simple Node.js CORS proxy server for local development
// Run with: node proxy-server.js

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoints for each data source
app.use('/api/hanglos', createProxyMiddleware({
    target: 'https://hanglos.nl',
    changeOrigin: true,
    pathRewrite: {
        '^/api/hanglos': ''
    },
    onError: (err, req, res) => {
        console.error('Hanglos proxy error:', err);
        res.status(500).json({ error: 'Proxy error for Hanglos' });
    }
}));

app.use('/api/surftime', createProxyMiddleware({
    target: 'https://surftime.nl',
    changeOrigin: true,
    pathRewrite: {
        '^/api/surftime': ''
    },
    onError: (err, req, res) => {
        console.error('Surftime proxy error:', err);
        res.status(500).json({ error: 'Proxy error for Surftime' });
    }
}));

app.use('/api/johnswind', createProxyMiddleware({
    target: 'https://johnswind.nl',
    changeOrigin: true,
    pathRewrite: {
        '^/api/johnswind': ''
    },
    onError: (err, req, res) => {
        console.error('Johnswind proxy error:', err);
        res.status(500).json({ error: 'Proxy error for Johnswind' });
    }
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`CORS proxy server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`  - /api/hanglos/* -> https://hanglos.nl/*`);
    console.log(`  - /api/surftime/* -> https://surftime.nl/*`);
    console.log(`  - /api/johnswind/* -> https://johnswind.nl/*`);
});