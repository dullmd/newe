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
app.use(express.static(path.join(__dirname, 'profile')));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/pair', limiter);

// Connect to MongoDB
connectDB();

// Routes
const pairRouter = require('./sila');
app.use('/', pairRouter);

// Serve pairing page
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'active',
        bot: '𝙱𝚄𝙳 𝙶𝚄𝚈𝚂',
        time: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
    console.log(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`);
    console.log(`┃   🔐 𝙱𝚄𝙳 𝙶𝚄𝚈𝚂 𝚂𝚎𝚛𝚟𝚎𝚛 𝚁𝚞𝚗𝚗𝚒𝚗𝚐   ┃`);
    console.log(`┃   📍 𝙿𝚘𝚛𝚝: ${port}                      ┃`);
    console.log(`┃   ⚡ 𝚂𝚝𝚊𝚝𝚞𝚜: 𝙾𝚗𝚕𝚒𝚗𝚎                   ┃`);
    console.log(`┃   👑 ᴾᵒʷᵉʳᵈ ᵇʸ ᴮᵃᵈ ᴳᵘʸˢ ᴴᵃᶜᵏᵉʳˢ  ┃`);
    console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`);
});

module.exports = app;
