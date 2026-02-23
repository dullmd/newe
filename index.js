const express = require('express');
const app = express();
const port = process.env.PORT || 8000;
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config');

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Serve static files (profile folder)
app.use(express.static(path.join(__dirname, 'profile')));
app.use(express.static(path.join(__dirname))); // Serve pair.html from root

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/pair', limiter);

// Connect to MongoDB
connectDB();

// IMPORTANT: Serve pair.html at root AND /pair
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/pair.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// API Routes
const pairRouter = require('./sila');
app.use('/', pairRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'active',
        bot: '𝙱𝚄𝙳 𝙶𝚄𝚈𝚂',
        time: new Date().toISOString(),
        connections: activeConnections ? activeConnections.size : 0
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
    console.log(`┃   🔐 𝙱𝚄𝙳 𝙶𝚄𝚈𝚂 𝚂𝚎𝚛𝚟𝚎𝚛 𝚁𝚞𝚗𝚗𝚒𝚗𝚐   ┃`);
    console.log(`┃   📍 𝙿𝚘𝚛𝚝: ${port}                      ┃`);
    console.log(`┃   🌐 𝚄𝚁𝙻: http://localhost:${port}      ┃`);
    console.log(`┃   ⚡ 𝚂𝚝𝚊𝚝𝚞𝚜: 𝙾𝚗𝚕𝚒𝚗𝚎                   ┃`);
    console.log(`┃   👑 ᴾᵒʷᵉʳᵈ ᵇʸ ᴮᵃᵈ ᴳᵘʸˢ ᴴᵃᶜᵏᵉʳˢ  ┃`);
    console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
});

// Make activeConnections available for health check
global.activeConnections = new Map();

module.exports = app;
