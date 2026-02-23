const mongoose = require('mongoose');

// MongoDB Connection URL
const MONGODB_URL = 'mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/?retryWrites=true&w=majority';

// Bot Configuration
const config = {
    // Bot Information
    botName: '𝙱𝚄𝙳 𝙶𝚄𝚈𝚂',
    botFooter: 'ᴾᵒʷᵉʳᵈ ᵇʸ ᴮᵃᵈ ᴳᵘʸˢ ᴴᵃᶜᵏᵉʳˢ',
    botImage: 'https://files.catbox.moe/brou6d.jpg',
    menuImage: 'https://files.catbox.moe/36vahk.png',
    
    // Owner Information
    ownerNumber: '254xxxxxxxxx', // Replace with your number
    ownerName: 'SILA-MD',
    
    // Newsletter JID
    newsletterJid: '120363421404091643@newsletter',
    groupLink: 'https://files.catbox.moe/natk49.jpg',
    
    // MongoDB
    mongodbUrl: MONGODB_URL,
    
    // Default Prefix
    defaultPrefix: '.',
    
    // APIs
    apis: {
        ai: 'https://api.yupra.my.id/api/ai/gpt5',
        ytdl: 'https://gtech-api-xtp1.onrender.com/api/video/yt?apikey=APIKEY',
        ytmp3: 'https://yt-dl.officialhectormanuel.workers.dev'
    }
};

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

module.exports = { config, connectDB };
