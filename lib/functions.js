const axios = require('axios');
const moment = require('moment-timezone');
const { config } = require('../config');

// Fake VCard for quoted messages
const fkontak = {
    "key": {
        "participant": '0@s.whatsapp.net',
        "remoteJid": '0@s.whatsapp.net',
        "fromMe": false,
        "id": "𝙱𝚄𝙳 𝙶𝚄𝚈𝚂"
    },
    "message": {
        "conversation": "𝙱𝚄𝙳 𝙶𝚄𝚈𝚂"
    }
};

// Context Info for external ad reply
const getContextInfo = (options = {}) => {
    const { sender, mentionedJid = [] } = options;
    return {
        mentionedJid,
        externalAdReply: {
            title: config.botName,
            body: config.botFooter,
            mediaType: 1,
            previewType: 0,
            thumbnailUrl: config.botImage,
            sourceUrl: 'https://github.com/',
            renderLargerThumbnail: true,
        }
    };
};

// Format time
const formatTime = (timezone = 'Africa/Nairobi') => {
    return moment().tz(timezone).format('DD/MM/YYYY HH:mm:ss');
};

// Download YouTube video
const downloadYouTube = async (url) => {
    try {
        const api = `${config.apis.ytdl}&url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(api);
        return data;
    } catch (error) {
        console.error('YouTube download error:', error);
        return null;
    }
};

// Download YouTube audio
const downloadAudio = async (url) => {
    try {
        const api = `${config.apis.ytmp3}/?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(api, { timeout: 30000 });
        return data;
    } catch (error) {
        console.error('Audio download error:', error);
        return null;
    }
};

// AI Chat
const aiChat = async (message) => {
    try {
        const response = await axios.get(`${config.apis.ai}?text=${encodeURIComponent(message)}`);
        return response.data;
    } catch (error) {
        console.error('AI chat error:', error);
        return null;
    }
};

// Google Search
const googleSearch = async (query) => {
    try {
        const { data } = await axios.get(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=YOUR_API_KEY&cx=YOUR_SEARCH_ENGINE_ID`);
        return data.items || [];
    } catch (error) {
        console.error('Google search error:', error);
        return [];
    }
};

// Image to Sticker
const imageToSticker = async (imageBuffer) => {
    // Implementation depends on your sticker library
    return imageBuffer;
};

// Check if user is owner
const isOwner = (sender) => {
    return sender === config.ownerNumber || sender.includes(config.ownerNumber.split('@')[0]);
};

// Anti-link check
const hasLink = (text) => {
    const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
    return linkRegex.test(text);
};

// Anti-bad word check
const hasBadWord = async (text) => {
    const BadWord = require('./database').BadWord;
    const badWords = await BadWord.find();
    const words = text.toLowerCase().split(/\s+/);
    return badWords.some(bw => words.includes(bw.word.toLowerCase()));
};

module.exports = {
    fkontak,
    getContextInfo,
    formatTime,
    downloadYouTube,
    downloadAudio,
    aiChat,
    googleSearch,
    imageToSticker,
    isOwner,
    hasLink,
    hasBadWord
};
