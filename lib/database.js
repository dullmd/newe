const mongoose = require('mongoose');

// Session Schema
const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    sessionData: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now, expires: '30d' }
});

// Settings Schema
const settingsSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    prefix: { type: String, default: '.' },
    autoView: { type: Boolean, default: false },
    autoLike: { type: Boolean, default: false },
    viewOnce: { type: Boolean, default: false },
    autoReply: { type: Boolean, default: false },
    antiLink: { type: Boolean, default: false },
    antiBadWord: { type: Boolean, default: false },
    antiDelete: { type: String, enum: ['off', 'chat', 'group', 'all'], default: 'off' },
    welcome: { type: Boolean, default: false },
    goodbye: { type: Boolean, default: false },
    autoTyping: { type: Boolean, default: false },
    autoRecording: { type: Boolean, default: false },
    musicDownload: { type: Boolean, default: true },
    videoDownload: { type: Boolean, default: true },
    aiChat: { type: Boolean, default: false }
});

// Bad Words Schema
const badWordsSchema = new mongoose.Schema({
    word: { type: String, required: true, unique: true }
});

// Deleted Messages Schema
const deletedMessagesSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    jid: { type: String, required: true },
    participant: { type: String, required: true },
    message: { type: Object, required: true },
    messageType: { type: String },
    deletedAt: { type: Date, default: Date.now }
});

// Create models
const Session = mongoose.model('Session', sessionSchema);
const Settings = mongoose.model('Settings', settingsSchema);
const BadWord = mongoose.model('BadWord', badWordsSchema);
const DeletedMessage = mongoose.model('DeletedMessage', deletedMessagesSchema);

// Helper functions
const getSettings = async (jid) => {
    let settings = await Settings.findOne({ jid });
    if (!settings) {
        settings = new Settings({ jid });
        await settings.save();
    }
    return settings;
};

const updateSettings = async (jid, updates) => {
    return await Settings.findOneAndUpdate(
        { jid },
        { $set: updates },
        { new: true, upsert: true }
    );
};

module.exports = {
    Session,
    Settings,
    BadWord,
    DeletedMessage,
    getSettings,
    updateSettings
};
