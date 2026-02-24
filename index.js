const express = require('express');
const app = express();
const port = process.env.PORT || 8000;
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import router from sila.js
const silaRouter = require('./sila');

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'profile')));
app.use(express.static(path.join(__dirname)));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/pair', limiter);

// Routes - FIXED: Use the router directly
app.use('/', silaRouter);

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'active',
        bot: 'SILA MD',
        time: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
    console.log(`┃   🔐 SILA MD Server Running    ┃`);
    console.log(`┃   📍 Port: ${port}                      ┃`);
    console.log(`┃   🌐 URL: http://localhost:${port}      ┃`);
    console.log(`┃   ⚡ Status: Online                    ┃`);
    console.log(`┃   👑 Powered By SILA TECH              ┃`);
    console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
});

module.exports = app;
