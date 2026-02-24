const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const os = require('os');
const axios = require('axios');
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, DisconnectReason, jidDecode, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const yts = require('yt-search');
const googleTTS = require("google-tts-api");
const mongoose = require('mongoose');

// ==================== MONGODB CONFIGURATION ====================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sila_md:sila0022@sila.67mxtd7.mongodb.net/';

// Check if already connected
if (mongoose.connection.readyState === 0) {
  // Connect to MongoDB only if not connected
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  }).then(() => {
    console.log('✅ Connected to MongoDB');
  }).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
} else {
  console.log('✅ MongoDB already connected');
}

// ==================== MONGODB SCHEMAS ====================

const sessionSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  sessionId: { type: String },
  settings: { type: Object, default: {} },
  creds: { type: Object },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const settingsSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  settings: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// MongoDB Models
const Session = mongoose.model('Session', sessionSchema);
const Settings = mongoose.model('Settings', settingsSchema);

console.log('✅ Using MongoDB database system');

// ==================== GLOBAL VARIABLES ====================

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const PLUGINS_PATH = './plugins';

// Create directories
if (!fs.existsSync(SESSION_BASE_PATH)) {
  fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
if (!fs.existsSync(PLUGINS_PATH)) {
  fs.mkdirSync(PLUGINS_PATH, { recursive: true });
}

// ==================== FAKE VCARD ====================

const fakevCard = {
  key: {
    fromMe: false,
    participant: "0@s.whatsapp.net",
    remoteJid: "status@broadcast"
  },
  message: {
    contactMessage: {
      displayName: "© SILA MD",
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:SILA MD\nORG:SILA TECH;\nTEL;type=CELL;type=VOICE;waid=255612491554:+255612491554\nEND:VCARD`
    }
  }
};

// ==================== DEFAULT SETTINGS ====================

const defaultSettings = {
  AUTO_RECORDING: 'false',
  AUTO_TYPING: 'true',
  ANTI_CALL: 'false',
  WELCOME_ENABLE: 'true',
  GOODBYE_ENABLE: 'true',
  READ_MESSAGE: 'true',
  AUTO_VIEW_STATUS: 'true',
  AUTO_LIKE_STATUS: 'true',
  WORK_TYPE: 'public',
  PREFIX: '.',
  ANTI_LINK: 'true',
  AUTO_AI: 'on',
  AUTO_STICKER: 'off',
  AUTO_VOICE: 'off',
  ST_EMOJI: '🐢'
};

// ==================== AUTO REPLIES ====================

const autoReplies = {
  'hi': '𝙷𝚎𝚕𝚕𝚘! 👋 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚑𝚎𝚕𝚙 𝚢𝚘𝚞 𝚝𝚘𝚍𝚊𝚢?',
  'mambo': '𝙿𝚘𝚊 𝚜𝚊𝚗𝚊! 👋 𝙽𝚒𝚔𝚞𝚜𝚊𝚒𝚍𝚒𝚎 𝙺𝚞𝚑𝚞𝚜𝚞?',
  'hey': '𝙷𝚎𝚢 𝚝𝚑𝚎𝚛𝚎! 😊 𝚄𝚜𝚎 .𝚖𝚎𝚗𝚞 𝚝𝚘 𝚜𝚎𝚎 𝚊𝚕𝚕 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜.',
  'vip': '𝙷𝚎𝚕𝚕𝚘 𝚅𝙸𝙿! 👑 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚊𝚜𝚜𝚒𝚜𝚝 𝚢𝚘𝚞?',
  'mkuu': '𝙷𝚎𝚢 𝚖𝚔𝚞𝚞! 👋 𝙽𝚒𝚔𝚞𝚜𝚊𝚒𝚍𝚒𝚎 𝙺𝚞𝚑𝚞𝚜𝚞?',
  'boss': '𝚈𝚎𝚜 𝚋𝚘𝚜𝚜! 👑 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚑𝚎𝚕𝚙 𝚢𝚘𝚞?',
  'habari': '𝙽𝚣𝚞𝚛𝚒 𝚜𝚊𝚗𝚊! 👋 𝙷𝚊𝚋𝚊𝚛𝚒 𝚢𝚊𝚔𝚘?',
  'hello': '𝙷𝚒 𝚝𝚑𝚎𝚛𝚎! 😊 𝚄𝚜𝚎 .𝚖𝚎𝚗𝚞 𝚝𝚘 𝚜𝚎𝚎 𝚊𝚕𝚕 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜.',
  'bot': '𝚈𝚎𝚜, 𝙸 𝚊𝚖 𝚂𝙸𝙻𝙰 𝙼𝙳! 🤖 𝙷𝚘𝚠 𝚌𝚊𝚗 𝙸 𝚊𝚜𝚜𝚒𝚜𝚝 𝚢𝚘𝚞?',
  'menu': '𝚃𝚢𝚙𝚎 .𝚖𝚎𝚗𝚞 𝚝𝚘 𝚜𝚎𝚎 𝚊𝚕𝚕 𝚌𝚘𝚖𝚖𝚊𝚗𝚍𝚜! 📜',
  'owner': '𝙲𝚘𝚗𝚝𝚊𝚌𝚝 𝚘𝚠𝚗𝚎𝚛 𝚞𝚜𝚒𝚗𝚐 .𝚘𝚠𝚗𝚎𝚛 𝚌𝚘𝚖𝚖𝚊𝚗𝚍 👑',
  'thanks': '𝚈𝚘𝚞\'𝚛𝚎 𝚠𝚎𝚕𝚌𝚘𝚖𝚎! 😊',
  'thank you': '𝙰𝚗𝚢𝚝𝚒𝚖𝚎! 𝙻𝚎𝚝 𝚖𝚎 𝚔𝚗𝚘𝚠 𝚒𝚏 𝚢𝚘𝚞 𝚗𝚎𝚎𝚍 𝚑𝚎𝚕𝚙 🤖'
};

// ==================== AUTO JOIN LINKS ====================

const AUTO_JOIN_LINKS = [
  'https://whatsapp.com/channel/0029VbBPxQTJUM2WCZLB6j28',
  'https://whatsapp.com/channel/0029VbBG4gfISTkCpKxyMH02',
  'https://whatsapp.com/channel/0029VbBmFT430LKO7Ch9C80X',
  'https://chat.whatsapp.com/IdGNaKt80DEBqirc2ek4ks',
  'https://chat.whatsapp.com/C03aOCLQeRUH821jWqRPC6'
];

// ==================== CHANNEL JIDS ====================

const CHANNEL_JIDS = [
  '120363402325089913@newsletter',
  '120363421404091643@newsletter'
];

// ==================== BOT IMAGES ====================

const BOT_IMAGES = [
  'https://files.catbox.moe/277zt9.jpg',
  'https://files.catbox.moe/277zt9.jpg'
];

// ==================== OWNER NUMBERS ====================

const OWNER_NUMBERS = ['255789661031', '255612491554'];

// ==================== URL PATTERNS FOR ANTI-LINK ====================

const URL_PATTERNS = [
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
  /chat\.whatsapp\.com\/[a-zA-Z0-9]+/gi,
  /whatsapp\.com\/channel\/[a-zA-Z0-9]+/gi,
  /t\.me\/[a-zA-Z0-9_]+/gi,
  /telegram\.me\/[a-zA-Z0-9_]+/gi,
  /instagram\.com\/[a-zA-Z0-9_.]+/gi,
  /facebook\.com\/[a-zA-Z0-9_.]+/gi,
  /twitter\.com\/[a-zA-Z0-9_]+/gi,
  /youtube\.com\/[a-zA-Z0-9_]+/gi,
  /tiktok\.com\/@[a-zA-Z0-9_.]+/gi,
  /snapchat\.com\/add\/[a-zA-Z0-9_.]+/gi,
  /discord\.gg\/[a-zA-Z0-9]+/gi,
  /discord\.com\/invite\/[a-zA-Z0-9]+/gi
];

// ==================== UTILITY FUNCTIONS ====================

async function myDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// MongoDB CRUD operations for Session model
Session.findOneAndUpdate = async function(query, update, options = {}) {
  try {
    const session = await this.findOne(query);

    if (session) {
      if (update.$set) {
        Object.assign(session, update.$set);
      } else {
        Object.assign(session, update);
      }
      session.updatedAt = new Date();
      await session.save();
      return session;
    } else if (options.upsert) {
      const newSession = new this({
        ...query,
        ...update.$set,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newSession.save();
      return newSession;
    }
    return null;
  } catch (error) {
    console.error('Error in findOneAndUpdate:', error);
    return null;
  }
};

// MongoDB CRUD operations for Settings model
Settings.findOneAndUpdate = async function(query, update, options = {}) {
  try {
    const settings = await this.findOne(query);

    if (settings) {
      if (update.$set) {
        Object.assign(settings.settings, update.$set);
      } else {
        Object.assign(settings.settings, update);
      }
      settings.updatedAt = new Date();
      await settings.save();
      return settings;
    } else if (options.upsert) {
      const newSettings = new this({
        ...query,
        settings: update.$set || update,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newSettings.save();
      return newSettings;
    }
    return null;
  } catch (error) {
    console.error('Error in Settings findOneAndUpdate:', error);
    return null;
  }
};

// ==================== SETTINGS FUNCTIONS ====================

async function getSettings(number) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    let settingsDoc = await Settings.findOne({ number: sanitizedNumber });

    if (!settingsDoc) {
      settingsDoc = await Settings.findOneAndUpdate(
        { number: sanitizedNumber },
        { $set: defaultSettings },
        { upsert: true, new: true }
      );
      return defaultSettings;
    }

    const mergedSettings = { ...defaultSettings };
    for (let key in settingsDoc.settings) {
      mergedSettings[key] = settingsDoc.settings[key];
    }

    const needsUpdate = JSON.stringify(settingsDoc.settings) !== JSON.stringify(mergedSettings);

    if (needsUpdate) {
      await Settings.findOneAndUpdate(
        { number: sanitizedNumber },
        { $set: { settings: mergedSettings } },
        { upsert: true }
      );
    }

    return mergedSettings;
  } catch (error) {
    console.error('Error in getSettings:', error);
    return defaultSettings;
  }
}

async function updateSettings(number, updates = {}) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    let settingsDoc = await Settings.findOne({ number: sanitizedNumber });

    if (!settingsDoc) {
      settingsDoc = await Settings.findOneAndUpdate(
        { number: sanitizedNumber },
        { $set: { ...defaultSettings, ...updates } },
        { upsert: true, new: true }
      );
      return settingsDoc.settings;
    }

    const mergedSettings = { ...defaultSettings };

    for (const key in settingsDoc.settings) {
      mergedSettings[key] = settingsDoc.settings[key];
    }

    for (const key in updates) {
      mergedSettings[key] = updates[key];
    }

    settingsDoc.settings = mergedSettings;
    settingsDoc.updatedAt = new Date();
    await settingsDoc.save();

    return mergedSettings;
  } catch (error) {
    console.error('Error in updateSettings:', error);
    return defaultSettings;
  }
}

async function saveSettings(number) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    let settingsDoc = await Settings.findOne({ number: sanitizedNumber });

    if (!settingsDoc) {
      settingsDoc = new Settings({
        number: sanitizedNumber,
        settings: defaultSettings
      });
      await settingsDoc.save();
      return defaultSettings;
    }

    const settings = settingsDoc.settings;
    let updated = false;

    for (const key in defaultSettings) {
      if (!(key in settings)) {
        settings[key] = defaultSettings[key];
        updated = true;
      }
    }

    if (updated) {
      settingsDoc.settings = settings;
      settingsDoc.updatedAt = new Date();
      await settingsDoc.save();
    }

    return settings;
  } catch (error) {
    console.error('Error in saveSettings:', error);
    return defaultSettings;
  }
}

// ==================== OWNER CHECK ====================

function isBotOwner(jid, number, socket) {
  try {
    const cleanNumber = (number || '').replace(/\D/g, '');
    const cleanJid = (jid || '').replace(/\D/g, '');
    const bot = jidDecode(socket.user.id).user;

    if (bot === number) return true;

    return OWNER_NUMBERS.some(owner => cleanNumber.endsWith(owner) || cleanJid.endsWith(owner));
  } catch (err) {
    return false;
  }
}

// ==================== GET QUOTED TEXT ====================

function getQuotedText(quotedMessage) {
  if (!quotedMessage) return '';

  if (quotedMessage.conversation) return quotedMessage.conversation;
  if (quotedMessage.extendedTextMessage?.text) return quotedMessage.extendedTextMessage.text;
  if (quotedMessage.imageMessage?.caption) return quotedMessage.imageMessage.caption;
  if (quotedMessage.videoMessage?.caption) return quotedMessage.videoMessage.caption;
  if (quotedMessage.buttonsMessage?.contentText) return quotedMessage.buttonsMessage.contentText;
  if (quotedMessage.listMessage?.description) return quotedMessage.listMessage.description;
  if (quotedMessage.listMessage?.title) return quotedMessage.listMessage.title;
  if (quotedMessage.listResponseMessage?.singleSelectReply?.selectedRowId) return quotedMessage.listResponseMessage.singleSelectReply.selectedRowId;
  if (quotedMessage.templateButtonReplyMessage?.selectedId) return quotedMessage.templateButtonReplyMessage.selectedId;
  if (quotedMessage.reactionMessage?.text) return quotedMessage.reactionMessage.text;

  if (quotedMessage.viewOnceMessage) {
    const inner = quotedMessage.viewOnceMessage.message;
    if (inner?.imageMessage?.caption) return inner.imageMessage.caption;
    if (inner?.videoMessage?.caption) return inner.videoMessage.caption;
    if (inner?.imageMessage) return '[view once image]';
    if (inner?.videoMessage) return '[view once video]';
  }

  if (quotedMessage.stickerMessage) return '[sticker]';
  if (quotedMessage.audioMessage) return '[audio]';
  if (quotedMessage.documentMessage?.fileName) return quotedMessage.documentMessage.fileName;
  if (quotedMessage.contactMessage?.displayName) return quotedMessage.contactMessage.displayName;

  return '';
}

// ==================== SILA MESSAGE FORMATTER ====================

function silaMessage(text) {
  const randomImage = BOT_IMAGES[Math.floor(Math.random() * BOT_IMAGES.length)];

  return {
    text: text,
    contextInfo: {
      externalAdReply: {
        title: 'SILA MD',
        body: '𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 𝐒𝐢𝐥𝐚 𝐓𝐞𝐜𝐡',
        thumbnailUrl: 'https://files.catbox.moe/277zt9.jpg',
        thumbnailWidth: 64,
        thumbnailHeight: 64,
        sourceUrl: 'https://whatsapp.com/channel/0029VbBG4gfISTkCpKxyMH02',
        mediaUrl: 'https://files.catbox.moe/277zt9.jpg',
        showAdAttribution: true,
        renderLargerThumbnail: false,
        previewType: 'PHOTO',
        mediaType: 1
      },
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363402325089913@newsletter',
        newsletterName: 'SILA MD',
        serverMessageId: Math.floor(Math.random() * 1000000)
      },
      isForwarded: true,
      forwardingScore: 999
    }
  };
}

// ==================== AUTO BIO FUNCTION ====================

async function setupAutoBio(socket) {
  setInterval(async () => {
    try {
      const bios = [
        "🐢 SILA MD | By SILA TECH",
        "🤖 WhatsApp Bot | SILA MD",
        "🚀 Powerful Features | SILA",
        "💫 Always Online | SILA BOT",
        "🎯 Fast & Reliable | SILA MD"
      ];
      const randomBio = bios[Math.floor(Math.random() * bios.length)];
      await socket.updateProfileStatus(randomBio);
    } catch (error) {
      // Silent error handling
    }
  }, 30000);
}

// ==================== AUTO JOIN CHANNELS ====================

async function autoJoinChannels(socket) {
  try {
    console.log('🔄 Starting auto-join process...');
    
    for (const link of AUTO_JOIN_LINKS) {
      try {
        console.log(`📝 Processing link: ${link}`);
        
        if (link.includes('whatsapp.com/channel/')) {
          const channelId = link.split('/channel/')[1];
          console.log(`📢 Attempting to follow channel: ${channelId}`);
          
          try {
            if (typeof socket.newsletterFollow === 'function') {
              await socket.newsletterFollow(channelId);
            } else {
              await socket.sendMessage(`${channelId}@newsletter`, { 
                text: 'Auto-subscribing to channel' 
              });
            }
            console.log(`✅ Successfully followed channel: ${channelId}`);
          } catch (channelError) {
            console.log(`⚠️ Channel follow failed: ${channelError.message}`);
          }
          
        } else if (link.includes('chat.whatsapp.com/')) {
          const groupCode = link.split('chat.whatsapp.com/')[1];
          console.log(`👥 Attempting to join group with code: ${groupCode}`);
          
          try {
            const cleanGroupCode = groupCode.split('?')[0].split('/')[0];
            
            if (cleanGroupCode && cleanGroupCode.length > 5) {
              await socket.groupAcceptInvite(cleanGroupCode);
              console.log(`✅ Successfully joined group with code: ${cleanGroupCode}`);
            } else {
              console.log(`❌ Invalid group code: ${cleanGroupCode}`);
            }
          } catch (groupError) {
            console.log(`⚠️ Group join failed: ${groupError.message}`);
          }
        }
        
        await myDelay(3000);
        
      } catch (error) {
        console.log(`❌ Error processing link ${link}:`, error.message);
      }
    }
    
    console.log('✅ Auto-join process completed');
  } catch (error) {
    console.error('❌ Auto-join function error:', error);
  }
}

// ==================== CHANNEL AUTO REACTION ====================

async function setupChannelAutoReaction(socket) {
  console.log('🔄 Setting up channel auto-reaction...');
  
  socket.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg.message || !msg.key.remoteJid) return;

      const remoteJid = msg.key.remoteJid;
      
      if (remoteJid.endsWith('@newsletter')) {
        console.log(`📢 Channel message detected from: ${remoteJid}`);
        
        const shouldReact = CHANNEL_JIDS.includes(remoteJid) || CHANNEL_JIDS.length === 0;
        
        if (shouldReact) {
          try {
            const emojis = ['🐢', '❤️', '🔥', '⭐', '💫', '🚀', '👍', '🎉', '👏'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            console.log(`🎭 Reacting with: ${randomEmoji} to channel message`);
            
            await socket.sendMessage(remoteJid, { 
              react: { 
                text: randomEmoji, 
                key: msg.key 
              }
            });
            
            console.log(`✅ Successfully reacted to channel message`);
          } catch (reactError) {
            console.log(`❌ Failed to react to channel message:`, reactError.message);
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Channel reaction error:', error.message);
    }
  });
  
  console.log('✅ Channel auto-reaction setup completed');
}

// ==================== ANTI-LINK HANDLER ====================

async function handleAntiLink(socket, msg, setting, sender) {
  try {
    if (setting.ANTI_LINK !== 'true') return false;
    if (!msg.message) return false;

    let text = '';

    if (msg.message.conversation) {
      text = msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
      text = msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage?.caption) {
      text = msg.message.imageMessage.caption;
    } else if (msg.message.videoMessage?.caption) {
      text = msg.message.videoMessage.caption;
    }

    if (!text) return false;

    let hasLink = false;
    for (const pattern of URL_PATTERNS) {
      if (pattern.test(text)) {
        hasLink = true;
        break;
      }
    }

    if (!hasLink) return false;

    const senderJid = msg.key.participant || msg.key.remoteJid;
    const senderNumber = senderJid.split('@')[0];

    try {
      await socket.sendMessage(sender, {
        delete: {
          id: msg.key.id,
          remoteJid: sender,
          fromMe: false
        }
      });
      console.log(`Deleted link message from ${senderNumber}`);
    } catch (deleteError) {
      console.log('Could not delete message:', deleteError.message);
    }

    const warningMessage = `⚠️ *LINK DETECTED* ⚠️\n\n@${senderNumber} **Umetuma link kwenye group!**\n\nLinks haziruhusiwi hapa. Tafadhali usitumie tena.`;

    await socket.sendMessage(sender, { 
      text: warningMessage,
      mentions: [senderJid]
    }, { quoted: fakevCard });

    return true;
  } catch (error) {
    console.error('Anti-link error:', error);
    return false;
  }
}

// ==================== LOAD PLUGINS ====================

function loadPlugins() {
  const plugins = {};
  try {
    if (!fs.existsSync(PLUGINS_PATH)) {
      return plugins;
    }

    const pluginFiles = fs.readdirSync(PLUGINS_PATH).filter(file => file.endsWith('.js'));

    for (const file of pluginFiles) {
      try {
        const pluginPath = path.join(PLUGINS_PATH, file);
        const plugin = require(pluginPath);
        plugins[path.basename(file, '.js')] = plugin;
      } catch (error) {
        console.log(`Error loading plugin ${file}:`, error.message);
      }
    }
  } catch (error) {
    // Silent error
  }

  return plugins;
}

// ==================== GROUP EVENTS HANDLER ====================

const groupEvents = {
  handleGroupUpdate: async (socket, update) => {
    try {
      console.log('Group update detected:', JSON.stringify(update));

      if (!update || !update.id) return;

      const groupId = update.id;
      const action = update.action;
      const participants = Array.isArray(update.participants) ? update.participants : [update.participants];

      for (const participant of participants) {
        if (!participant) continue;

        const userJid = typeof participant === 'string' ? participant : participant.id || participant;
        const userName = userJid.split('@')[0];

        let message = '';
        let mentions = [userJid];

        if (action === 'add') {
          message = `╭━━【 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 】━━━━━━━━╮\n│ 👋 @${userName}\n│ 🎉 Welcome to the group!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n*𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝚒𝚕𝚊 𝚃𝚎𝚌𝚑*`;
        } else if (action === 'remove') {
          message = `╭━━【 𝐆𝐎𝐎𝐃𝐁𝐘𝐄 】━━━━━━━━╮\n│ 👋 @${userName}\n│ 👋 Farewell!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n*𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝚒𝚕𝚊 𝚃𝚎𝚌𝚑*`;
        } else if (action === 'promote') {
          const author = update.author || '';
          if (author) mentions.push(author);
          message = `╭━━【 𝐏𝐑𝐎𝐌𝐎𝐓𝐄 】━━━━━━━━╮\n│ ⬆️ @${userName}\n│ 👑 Promoted to Admin!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n*𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝚒𝚕𝚊 𝚃𝚎𝚌𝚑*`;
        } else if (action === 'demote') {
          const author = update.author || '';
          if (author) mentions.push(author);
          message = `╭━━【 𝐃𝐄𝐌𝐎𝐓𝐄 】━━━━━━━━╮\n│ ⬇️ @${userName}\n│ 👑 Demoted from Admin!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n*𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚂𝚒𝚕𝚊 𝚃𝚎𝚌𝚑*`;
        }

        if (message) {
          await socket.sendMessage(groupId, { 
            text: message, 
            mentions: mentions.filter(m => m) 
          }, { quoted: fakevCard });
          console.log(`✅ Sent ${action} message for ${userName}`);
        }
      }
    } catch (err) {
      console.error('Group event error:', err.message);
    }
  }
};

// ==================== SETUP GROUP EVENTS LISTENER ====================

function setupGroupEventsListener(socket) {
  socket.ev.on('group-participants.update', async (update) => {
    console.log('Group participants update detected:', update);
    await groupEvents.handleGroupUpdate(socket, update);
  });
}

// ==================== MESSAGE HANDLER ====================

async function kavixmdminibotmessagehandler(socket, number) {
  const plugins = loadPlugins();

  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

    const setting = await getSettings(number);
    const remoteJid = msg.key.remoteJid;
    const jidNumber = remoteJid.split('@')[0];
    const isGroup = remoteJid.endsWith('@g.us');
    const isOwner = isBotOwner(msg.key.remoteJid, number, socket);
    const owners = [];
    const msgContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || "";
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    // Check anti-link first
    if (isGroup && setting.ANTI_LINK === 'true') {
      const linkHandled = await handleAntiLink(socket, msg, setting, remoteJid);
      if (linkHandled) return;
    }

    // Handle auto-replies for inbox messages
    if (!isGroup && !isOwner && setting.WORK_TYPE === 'inbox') {
      const lowerText = text.toLowerCase().trim();
      if (autoReplies[lowerText]) {
        await socket.sendMessage(remoteJid, { text: autoReplies[lowerText] });
        return;
      }
    }

    const PREFIX = setting.PREFIX || '.';
    let command = null;
    let args = [];
    let sender = msg.key.remoteJid;
    let botImg = BOT_IMAGES[Math.floor(Math.random() * BOT_IMAGES.length)];
    let boterr = "🐢 An error has occurred, Please try again.";
    let botNumber = await socket.decodeJid(socket.user.id);
    let body = msgContent.trim();
    let isCommand = body.startsWith(PREFIX);

    if (isCommand) {
      const parts = body.slice(PREFIX.length).trim().split(/ +/);
      command = parts.shift().toLowerCase();
      args = parts;
    }

    const ownerMessage = async () => {
      await socket.sendMessage(sender, {text: `🚫 ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ᴜsᴇᴅ ʙʏ ᴛʜᴇ ᴏᴡɴᴇʀ.`}, { quoted: fakevCard });
    };

    const groupMessage = async () => {
      await socket.sendMessage(sender, {text: `🚫 ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ᴏɴʟʏ ғᴏʀ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ ᴜsᴇ.`}, { quoted: fakevCard });
    };

    const replygckavi = async (teks) => {
      await socket.sendMessage(sender, silaMessage(teks), { quoted: fakevCard });
    };

    const kavireact = async (remsg) => {
      await socket.sendMessage(sender, { react: { text: remsg, key: msg.key } });
    };

    // WORK TYPE CHECK
    const allowedModes = {
      'private': () => jidNumber === number,
      'groups': () => isGroup,
      'inbox': () => !isGroup && jidNumber !== number,
      'public': () => true
    };

    if (!isOwner) {
      const modeCheck = allowedModes[setting.WORK_TYPE];
      if (!modeCheck || !modeCheck()) {
        return;
      }
    }

    // Execute plugin commands
    try {
      for (const pluginName in plugins) {
        const plugin = plugins[pluginName];
        if (plugin.commands && plugin.commands.includes(command)) {
          await plugin.execute(socket, msg, {
            command,
            args,
            sender,
            number,
            isOwner,
            setting,
            replygckavi,
            kavireact
          });
          return;
        }
      }
    } catch (error) {}

    // Built-in commands handler
    try {
      switch (command) {
        // ==================== GENERAL COMMANDS ====================

        case 'menu': {
          try {
            await kavireact("📜");

            const startTime = socketCreationTime.get(number) || Date.now();
            const uptime = Math.floor((Date.now() - startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const totalMemMB = (os.totalmem() / (1024 * 1024)).toFixed(2);
            const freeMemMB = (os.freemem() / (1024 * 1024)).toFixed(2);

            const message = `╭─━━━━━━━━━━━━━━━━━━━━─╮
│ 🐢 𝗦𝗜𝗟𝗔 𝗠𝗗   
│ ✦ Hello User 👋  
│ ✦ Welcome to the command menu
╰─━━━━━━━━━━━━━━━━━━━━─╯

┌───〔 📊 𝗦𝘆𝘀𝘁𝗲𝗺 𝗜𝗻𝗳𝗼 〕───┐
│• Version: 2.0.0
│• Prefix: ${PREFIX}
│• Total RAM: ${totalMemMB} MB
│• Free RAM: ${freeMemMB} MB
│• Uptime: ${hours}h ${minutes}m ${seconds}s
│• OS: ${os.type()}
│• Platform: ${os.platform()}
│• CPU Arch: ${os.arch()}
└────────────────────────┘

╭───《 ⚙️ 𝗕𝗼𝘁 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀 》───╮
│• alive ☺️
│• ping ⚡
│• video 🎥
│• song 🎵
│• menu 📜
│• chid 🆔
│• freebot 🆓
│• setemoji 🐢
│• settings ⚙️
│• imagine 🎨
│• pair 🔐
│• play 🎧
│• sora 🎬
│• textmaker 🎭
│• tts 🔊
│• fb 📹
│• openai 🧠
│• ai 🤖
│• deepseek 👾
│• vv 👁️
│• apk 📱
│• ig 📸
│• tiktok 🎶
│• url 🔗
│• repo 📦
│• update 🔄
│• uptime ⏱️
│• restart ♻️
│• owner 👑
│• bot on/off 🔛
│• broadcast 📢
│• sticker ✂️
│• joke 😂
│• trt 🔤
╰─────────────────────────╯

╭───《 👥 𝗚𝗿𝗼𝘂𝗽 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀 》───╮
│• mute 🔇
│• unmute 🔊
│• delete 🗑️
│• kick 👢
│• tag 🏷️
│• tagall 📢
│• hidetag 🙈
│• kickall 🚫
│• getpic 📸
│• link 🔗
│• join ➕
│• add 👥
│• ginfo ℹ️
│• senddm 📨
│• listonline 👤
│• poll 📊
│• chatbot 💬
│• setgpp 🖼️
│• setgname 📝
│• setgdesc 📋
│• antitag ⚠️
│• warn ⚠️
│• clear 🧹
│• antilink 🔗
│• antimention 📢
│• ban 🚫
╰─────────────────────────╯

📢 Join our official channels & groups!`;

            await socket.sendMessage(sender, { image: { url: botImg }, caption: message }, { quoted: fakevCard });
          } catch (error) {
            await replygckavi(boterr);
          }
        }
        break;

        case 'ping': {
          await kavireact("🏓");
          const start = Date.now();
          const pingMsg = await socket.sendMessage(sender, { text: '🏓 Pinging...' }, { quoted: fakevCard });
          const ping = Date.now() - start;
          await socket.sendMessage(sender, { text: `🏓 Pong! ${ping}ms`, edit: pingMsg.key });
        }
        break;

        case 'alive': {
          await kavireact("☺️");
          await replygckavi(`*🐢 SILA MD BOT 🐢*\n\n*Status:* 🟢 Online\n*Version:* 2.0.0\n*Owner:* SILA TECH\n\n*Powered by SILA TECH*`);
        }
        break;

        case 'url': {
          await kavireact("🔗");
          await replygckavi(`*🔗 Bot URL:*\nhttps://sila-bot.onrender.com\n\n*📱 Pair your number:*\n.pair YOUR_NUMBER\n\n*Example:* .pair 255612491554`);
        }
        break;

        case 'repo': {
          await kavireact("📦");
          await replygckavi(`*📦 SILA MD Repository*\n\n*GitHub:* Coming soon...\n*Bot URL:* https://sila-bot.onrender.com\n\n*For updates, join our channels!*`);
        }
        break;

        case 'uptime': {
          await kavireact("⏱️");
          const startTime = socketCreationTime.get(number) || Date.now();
          const uptime = Math.floor((Date.now() - startTime) / 1000);
          const hours = Math.floor(uptime / 3600);
          const minutes = Math.floor((uptime % 3600) / 60);
          const seconds = Math.floor(uptime % 60);

          await replygckavi(`*⏱️ Uptime*\n\n*Bot has been running for:*\n${hours}h ${minutes}m ${seconds}s\n\n*Since:* ${new Date(startTime).toLocaleString()}`);
        }
        break;

        case 'owner': {
          await kavireact("👑");
          await replygckavi(`*👑 Bot Owner*\n\n*Name:* SILA TECH\n*Number:* +255612491554\n*Channel:* @SILA_TECH\n\n*Contact for support or queries!*`);
        }
        break;

        // ==================== PAIRING COMMAND ====================

        case 'pair': {
          await kavireact("🔐");
          try {
            const phoneNumber = args.join(" ").trim();
            if (!phoneNumber) {
              return await replygckavi(`*🔐 𝙿𝙰𝙸𝚁 𝙲𝙾𝙳𝙴 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙾𝚁*\n\n*𝙲𝙷𝙴𝙽𝙶𝙴𝚉𝙰 𝙽𝚄𝙼𝙱𝙰 𝚈𝙰𝙺𝙾 𝙺𝚄𝙿𝙰𝚃𝙰 𝙿𝙰𝙸𝚁𝙸𝙽𝙶 𝙲𝙾𝙳𝙴*\n\n*𝚄𝚂𝙰𝙶𝙴:*\n.pair <namba yako>\n\n*𝙴𝚇𝙰𝙼𝙿𝙻𝙴:*\n.pair 255612491554\n\n*𝙺𝙾𝙳𝙴 𝙸𝚃𝙰𝚃𝚄𝙼𝙰 𝙷𝙰𝙿𝙰 𝙽𝙰 𝚄𝚃𝙰𝙸𝙸𝙽𝙶𝙸𝚉𝙰 𝙺𝚆𝙴𝙽𝚈𝙴 𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 > 𝙻𝙸𝙽𝙺𝙴𝙳 𝙳𝙴𝚅𝙸𝙲𝙴𝚂*`);
            }

            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            if (cleanNumber.length < 10) {
              return await replygckavi("❌ Namba si sahihi. Tafadhali weka namba sahihi (mfano: 255612491554)");
            }

            await replygckavi(`*🔐 𝙶𝙴𝙽𝙴𝚁𝙰𝚃𝙸𝙽𝙶 𝙿𝙰𝙸𝚁 𝙲𝙾𝙳𝙴...*\n\n*𝙽𝚞𝚖𝚋𝚎𝚛:* ${cleanNumber}\n*𝙿𝚕𝚎𝚊𝚜𝚎 𝚠𝚊𝚒𝚝...*`);

            // Call the pairing endpoint
            const BOT_URL = process.env.BOT_URL || 'https://sila-bot.onrender.com';
            const response = await axios.get(`${BOT_URL}/code?number=${cleanNumber}`);

            if (!response.data || !response.data.code) {
              return await replygckavi("❌ Imeshindwa kupata pairing code. Jaribu tena baadaye.");
            }

            const pairingCode = response.data.code;
            
            await socket.sendMessage(sender, { 
              text: `*🐢 𝚂𝙸𝙻𝙰 𝙼𝙳 𝙱𝙾𝚃 🐢*\n\n*📱 𝙿𝙰𝙸𝚁 𝙲𝙾𝙳𝙴:*\n\`\`\`${pairingCode}\`\`\`\n\n*📲 𝙹𝙸𝙽𝙰 𝙻𝙰 𝙺𝚄𝚃𝚄𝙼𝙸𝙰:*\n1. 𝙵𝚞𝚗𝚐𝚞𝚊 𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 𝙺𝚆𝙴𝙽𝚈𝙴 𝚂𝙸𝙼𝚄 𝚈𝙰𝙺𝙾\n2. 𝙽𝙴𝙽𝙳𝙰 𝙺𝚆𝙴𝙽𝚈𝙴 *𝚂𝙴𝚃𝚃𝙸𝙽𝙶𝚂 > 𝙻𝙸𝙽𝙺𝙴𝙳 𝙳𝙴𝚅𝙸𝙲𝙴𝚂*\n3. 𝙱𝙾𝙽𝚈𝙴𝙽𝚉𝙰 *𝙻𝙸𝙽𝙺 𝙰 𝙳𝙴𝚅𝙸𝙲𝙴*\n4. 𝙸𝙽𝙶𝙸𝚉𝙰 𝙲𝙾𝙳𝙴 𝙸𝙻𝙸𝙾𝙿𝙾𝙰𝙽𝙰 𝙷𝙰𝙿𝙰 𝙹𝚄𝚈𝙰\n5. 𝙽𝙶𝙾𝙹𝙴𝙰 𝙱𝙾𝚃 𝙸𝙳𝙴 𝙲𝙾𝙽𝙽𝙴𝙲𝚃\n\n*⏱️ 𝙲𝚘𝚍𝚎 𝚒𝚗𝚊𝚒𝚜𝚑𝚊 𝙼𝚄𝙳𝙰 𝚆𝙰 𝙳𝙰𝙺𝙸𝙺𝙰 𝟻*`
            }, { quoted: fakevCard });

            await kavireact("✅");

          } catch (error) {
            console.error('Pair command error:', error);
            await replygckavi(`*❌ 𝙿𝙰𝙸𝚁𝙸𝙽𝙶 𝙵𝙰𝙸𝙻𝙴𝙳*\n\n${error.message || 'Jaribu tena baadaye'}`);
          }
        }
        break;

        // ==================== SETTINGS COMMANDS ====================

        case 'autorecording':
        case 'autorec': {
          if (!isOwner) return await ownerMessage();
          await kavireact("🎤");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { AUTO_RECORDING: 'true' });
            await replygckavi(`✅ *AUTO_RECORDING* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { AUTO_RECORDING: 'false' });
            await replygckavi(`✅ *AUTO_RECORDING* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.AUTO_RECORDING}*\n\n*use:*\n.autorecording on\n.autorecording off`);
          }
        }
        break;

        case 'autotyping': {
          if (!isOwner) return await ownerMessage();
          await kavireact("⌨️");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { AUTO_TYPING: 'true' });
            await replygckavi(`✅ *AUTO_TYPING* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { AUTO_TYPING: 'false' });
            await replygckavi(`✅ *AUTO_TYPING* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.AUTO_TYPING}*\n\n*use:*\n.autotyping on\n.autotyping off`);
          }
        }
        break;

        case 'anticall': {
          if (!isOwner) return await ownerMessage();
          await kavireact("📵");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { ANTI_CALL: 'true' });
            await replygckavi(`✅ *ANTI_CALL* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { ANTI_CALL: 'false' });
            await replygckavi(`✅ *ANTI_CALL* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.ANTI_CALL}*\n\n*use:*\n.anticall on\n.anticall off`);
          }
        }
        break;

        case 'welcome': {
          if (!isOwner) return await ownerMessage();
          await kavireact("👋");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { WELCOME_ENABLE: 'true' });
            await replygckavi(`✅ *WELCOME_ENABLE* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { WELCOME_ENABLE: 'false' });
            await replygckavi(`✅ *WELCOME_ENABLE* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.WELCOME_ENABLE}*\n\n*use:*\n.welcome on\n.welcome off`);
          }
        }
        break;

        case 'goodbye': {
          if (!isOwner) return await ownerMessage();
          await kavireact("👋");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { GOODBYE_ENABLE: 'true' });
            await replygckavi(`✅ *GOODBYE_ENABLE* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { GOODBYE_ENABLE: 'false' });
            await replygckavi(`✅ *GOODBYE_ENABLE* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.GOODBYE_ENABLE}*\n\n*use:*\n.goodbye on\n.goodbye off`);
          }
        }
        break;

        case 'autoread': {
          if (!isOwner) return await ownerMessage();
          await kavireact("👁️");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { READ_MESSAGE: 'true' });
            await replygckavi(`✅ *READ_MESSAGE* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { READ_MESSAGE: 'false' });
            await replygckavi(`✅ *READ_MESSAGE* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.READ_MESSAGE}*\n\n*use:*\n.autoread on\n.autoread off`);
          }
        }
        break;

        case 'autoview': {
          if (!isOwner) return await ownerMessage();
          await kavireact("👁️");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { AUTO_VIEW_STATUS: 'true' });
            await replygckavi(`✅ *AUTO_VIEW_STATUS* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { AUTO_VIEW_STATUS: 'false' });
            await replygckavi(`✅ *AUTO_VIEW_STATUS* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.AUTO_VIEW_STATUS}*\n\n*use:*\n.autoview on\n.autoview off`);
          }
        }
        break;

        case 'autolike': {
          if (!isOwner) return await ownerMessage();
          await kavireact("❤️");
          const value = args[0]?.toLowerCase();

          if (value === 'on' || value === 'true') {
            await updateSettings(number, { AUTO_LIKE_STATUS: 'true' });
            await replygckavi(`✅ *AUTO_LIKE_STATUS* updated to: *true*`);
          } else if (value === 'off' || value === 'false') {
            await updateSettings(number, { AUTO_LIKE_STATUS: 'false' });
            await replygckavi(`✅ *AUTO_LIKE_STATUS* updated to: *false*`);
          } else {
            await replygckavi(`*current status: ${setting.AUTO_LIKE_STATUS}*\n\n*use:*\n.autolike on\n.autolike off`);
          }
        }
        break;

        case 'mode': {
          if (!isOwner) return await ownerMessage();
          await kavireact("⚙️");
          const mode = args[0]?.toLowerCase();
          const validModes = ['public', 'private', 'groups', 'inbox'];

          if (validModes.includes(mode)) {
            await updateSettings(number, { WORK_TYPE: mode });
            await replygckavi(`✅ *WORK_TYPE* updated to: *${mode}*`);
          } else {
            await replygckavi(`*invalid mode*\n*available modes:* ${validModes.join(', ')}\n*current:* ${setting.WORK_TYPE}`);
          }
        }
        break;

        case 'setprefix': {
          if (!isOwner) return await ownerMessage();
          await kavireact("💀");
          const newPrefix = args[0];

          if (newPrefix) {
            if (newPrefix.length > 3) return await replygckavi("❌ prefix too long (max 3 characters)");
            await updateSettings(number, { PREFIX: newPrefix });
            await replygckavi(`✅ *PREFIX* updated to: *${newPrefix}*`);
          } else {
            await replygckavi(`*current prefix: ${setting.PREFIX}*\n*use:*\n.setprefix .\n.setprefix !\n.setprefix #`);
          }
        }
        break;

        case 'antilink': {
          if (!isGroup) return await groupMessage();
          await kavireact("🔗");
          try {
            const state = args[0]?.toLowerCase();
            if (state === 'on' || state === 'off') {
              await updateSettings(number, { 
                ANTI_LINK: state === 'on' ? 'true' : 'false' 
              });

              await replygckavi(`*🔗 Anti-link has been turned ${state.toUpperCase()}*\n\nWhen enabled, all links will be automatically deleted and the sender will be warned.`);
            } else {
              const current = setting.ANTI_LINK === 'true' ? "ON 🔴" : "OFF ⚪";
              await replygckavi(`*🔗 Anti-link Status*\n\n*Current:* ${current}\n\n*Usage:* .antilink on/off\n\n*Features:*\n• Auto-deletes links\n• Warns the sender\n• Mentions the user`);
            }
          } catch (error) {
            await replygckavi("Failed to update anti-link settings.");
          }
        }
        break;

        case 'setemoji': {
          if (!isOwner) return await ownerMessage();
          await kavireact("🐢");
          const newEmoji = args[0];

          if (newEmoji) {
            await updateSettings(number, { ST_EMOJI: newEmoji });
            await replygckavi(`✅ *ST_EMOJI* updated to: *${newEmoji}*`);
          } else {
            await replygckavi(`*current emoji: ${setting.ST_EMOJI}*\n*use:*\n.setemoji 😊\n.setemoji ❤️\n.setemoji ⭐`);
          }
        }
        break;

        case 'settings':
        case 'setting': {
          if (!isOwner) return await replygckavi('🚫 Only owner can use this command.');
          await kavireact("⚙️");

          let settingsText = `*🛠️ SILA MD SETTINGS 🛠️*\n\n`;

          for (const [key, value] of Object.entries(setting)) {
            settingsText += `*${key}:* ${value}\n`;
          }

          settingsText += `\n*Use commands like:*\n• .mode public/private/groups/inbox\n• .setprefix .\n• .autorecording on/off\n• .autoread on/off\n• .antilink on/off\n• .setemoji 🐢`;

          await socket.sendMessage(sender, { image: { url: botImg }, caption: settingsText }, { quoted: fakevCard });
        }
        break;

        // ==================== DOWNLOADER COMMANDS ====================

        case 'song':
        case 'play': {
          await kavireact("🎵");
          try {
            const query = args.join(" ");
            if (!query) {
              return await replygckavi("*𝙳𝙾 𝚈𝙾𝚄 𝚆𝙰𝙽𝚃 𝙰𝚄𝙳𝙸𝙾?*\n*𝚄𝚂𝙰𝙶𝙴:* .song song name\n*𝙴𝚇𝙰𝙼𝙿𝙻𝙴:* .song shape of you");
            }

            await replygckavi("*𝚂𝚎𝚊𝚛𝚌𝚑𝚒𝚗𝚐 𝚊𝚞𝚍𝚒𝚘...*");

            let video;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
              video = { 
                url: query, 
                title: 'YouTube Audio', 
                timestamp: 'N/A', 
                views: 'N/A',
                thumbnail: 'https://files.catbox.moe/277zt9.jpg',
                author: { name: 'YouTube' }
              };
            } else {
              const search = await yts(query);
              if (!search || !search.videos.length) {
                return await replygckavi("*❌ 𝙽𝚘 𝚛𝚎𝚜𝚞𝚕𝚝𝚜 𝚏𝚘𝚞𝚗𝚍*");
              }
              video = search.videos[0];
            }

            const caption = `╭━━【 🎵 𝙰𝚄𝙳𝙸𝙾 𝙸𝙽𝙵𝙾 】━━━╮
│ 📛 𝚃𝚒𝚝𝚕𝚎: ${video.title}
│ ⏱️ 𝙳𝚞𝚛𝚊𝚝𝚒𝚘𝚗: ${video.timestamp}
│ 👁️ 𝚅𝚒𝚎𝚠𝚜: ${video.views}
╰━━━━━━━━━━━━━━━━━━━╯

*𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐢𝐧𝐠...*`;

            await socket.sendMessage(sender, {
              image: { url: video.thumbnail || 'https://files.catbox.moe/277zt9.jpg' },
              caption: caption
            }, { quoted: fakevCard });

            let audioUrl = null;
            let audioTitle = video.title;
            let audioThumb = video.thumbnail;

            try {
              const apiUrl1 = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
              const res1 = await axios.get(apiUrl1, {
                timeout: 30000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });

              if (res1.data?.result?.audio?.url) {
                audioUrl = res1.data.result.audio.url;
                audioTitle = res1.data.result.title || video.title;
                audioThumb = res1.data.result.thumbnail || video.thumbnail;
                console.log("✅ Using Yupra API");
              }
            } catch (e) {
              console.log("❌ Yupra API failed:", e.message);
            }

            if (!audioUrl) {
              try {
                const apiUrl2 = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
                const res2 = await axios.get(apiUrl2, {
                  timeout: 30000
                });

                if (res2.data?.url) {
                  audioUrl = res2.data.url;
                  audioTitle = res2.data.title || video.title;
                  audioThumb = res2.data.thumb || video.thumbnail;
                  console.log("✅ Using Okatsu API");
                }
              } catch (e) {
                console.log("❌ Okatsu API failed:", e.message);
              }
            }

            if (!audioUrl) {
              try {
                const apiUrl3 = `https://api.siputzx.my.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`;
                const res3 = await axios.get(apiUrl3, {
                  timeout: 30000
                });

                if (res3.data?.result?.url) {
                  audioUrl = res3.data.result.url;
                  console.log("✅ Using Siputzx API");
                }
              } catch (e) {
                console.log("❌ Siputzx API failed:", e.message);
              }
            }

            if (!audioUrl) {
              throw new Error("All APIs failed");
            }

            const audioResponse = await axios.get(audioUrl, {
              responseType: 'arraybuffer',
              timeout: 60000
            });

            const audioBuffer = Buffer.from(audioResponse.data);

            await socket.sendMessage(sender, {
              audio: audioBuffer,
              mimetype: "audio/mpeg",
              fileName: `${audioTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 80)}.mp3`
            }, { quoted: fakevCard });

            await socket.sendMessage(sender, {
              text: `✅ *${audioTitle}* has been downloaded successfully!\n\n> 𝐏𝐨𝐰𝐞𝐫𝐝 𝐁𝐲 𝐒𝐢𝐥𝐚 𝐓𝐞𝐜𝐡`
            }, { quoted: fakevCard });

            await kavireact("✅");

          } catch (error) {
            console.error("❌ Song error:", error);
            await replygckavi("*❌ 𝙴𝚛𝚛𝚘𝚛 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍𝚒𝚗𝚐 𝚊𝚞𝚍𝚒𝚘*");
            await kavireact("❌");
          }
        }
        break;

        case 'video': {
          await kavireact("🎥");
          try {
            const text = args.join(" ");
            if (!text) {
              return await replygckavi("*𝙳𝙾 𝚈𝙾𝚄 𝚆𝙰𝙽𝚃 𝚃𝙾 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳 𝙰𝙽𝚈 𝚅𝙸𝙳𝙴𝙾?*\n*𝚄𝚂𝙰𝙶𝙴:* .video video name");
            }

            const search = await yts(text);
            if (!search.videos.length) return await replygckavi("*❌ Video haipatikani*");

            const data = search.videos[0];
            const ytUrl = data.url;

            const api = `https://gtech-api-xtp1.onrender.com/api/video/yt?apikey=APIKEY&url=${encodeURIComponent(ytUrl)}`;
            const { data: apiRes } = await axios.get(api);

            if (!apiRes?.status || !apiRes.result?.media?.video_url) {
              return await replygckavi("*❌ Video haidownloadi*");
            }

            const result = apiRes.result.media;
            const caption = `*🎥 𝚅𝙸𝙳𝙴𝙾 𝙸𝙽𝙵𝙾*\n\n*Title:* ${data.title}\n*Views:* ${data.views}\n*Duration:* ${data.timestamp}\n\n*Downloading...*`;

            await socket.sendMessage(sender, { image: { url: result.thumbnail }, caption }, { quoted: fakevCard });

            await socket.sendMessage(sender, { 
              video: { url: result.video_url }, 
              mimetype: "video/mp4",
              caption: "✅ Video downloaded successfully!"
            }, { quoted: fakevCard });

          } catch (error) {
            await replygckavi("*❌ Video download failed*");
          }
        }
        break;

        // ==================== AI COMMANDS ====================

        case 'ai':
        case 'gpt': {
          await kavireact("🤖");
          try {
            if (!args.length) return await replygckavi("Please provide a message for the AI.\nExample: `.ai Hello`");

            const q = args.join(" ").trim();
            const apiUrl = `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(q)}`;
            const { data } = await axios.get(apiUrl);

            if (!data || !data.result) {
              await kavireact("❌");
              return await replygckavi("AI failed to respond. Please try again later.");
            }

            await replygckavi(`🤖 *AI Response:*\n\n${data.result}`);
            await kavireact("✅");
          } catch (e) {
            await kavireact("❌");
            await replygckavi("An error occurred while communicating with the AI.");
          }
        }
        break;

        case 'imagine': {
          await kavireact("🎨");
          try {
            const prompt = args.join(" ");
            if (!prompt) {
              return await replygckavi("*🎨 AI IMAGE GENERATOR*\n\nPlease provide a prompt for the image.\n\n*Example:* .imagine a beautiful sunset");
            }

            await socket.sendMessage(sender, { 
              text: `*🔄 CREATING IMAGE...*\n\n*Prompt:* ${prompt}\n\nPlease wait...`
            }, { quoted: fakevCard });

            const apis = [
              { name: "Flux AI", url: `https://api.siputzx.my.id/api/ai/flux?prompt=${encodeURIComponent(prompt)}` },
              { name: "Stable Diffusion", url: `https://api.siputzx.my.id/api/ai/stable-diffusion?prompt=${encodeURIComponent(prompt)}` }
            ];

            let imageBuffer = null;
            let apiUsed = "";

            for (const api of apis) {
              try {
                const response = await axios.get(api.url, { 
                  responseType: "arraybuffer",
                  timeout: 30000
                });

                if (response.data && response.data.length > 1000) {
                  imageBuffer = Buffer.from(response.data, "binary");
                  apiUsed = api.name;
                  break;
                }
              } catch (apiError) {
                continue;
              }
            }

            if (!imageBuffer) {
              await replygckavi("*❌ IMAGE GENERATION FAILED*\n\nAll AI services are currently unavailable.");
              return;
            }

            await socket.sendMessage(sender, {
              image: imageBuffer,
              caption: `*🎨 AI IMAGE GENERATED*\n\n*Prompt:* ${prompt}\n*Model:* ${apiUsed}\n*Powered by:* SILA MD`
            }, { quoted: fakevCard });
          } catch (error) {
            await replygckavi(`*❌ ERROR*\n\nFailed to generate image.`);
          }
        }
        break;

        case 'deepseek': {
          await kavireact("👾");
          try {
            if (!args.length) return await replygckavi("Please provide a message for DeepSeek AI.\nExample: `.deepseek Hello`");

            const q = args.join(" ");
            const apiUrl = `https://api.ryzendesu.vip/api/ai/deepseek?text=${encodeURIComponent(q)}`;
            const { data } = await axios.get(apiUrl);

            if (!data || !data.answer) {
              await kavireact("❌");
              return await replygckavi("DeepSeek AI failed to respond.");
            }

            await replygckavi(`👾 *DeepSeek AI Response:*\n\n${data.answer}`);
            await kavireact("✅");
          } catch (e) {
            await kavireact("❌");
            await replygckavi("An error occurred while communicating with DeepSeek AI.");
          }
        }
        break;

        case 'openai': {
          await kavireact("🧠");
          try {
            if (!args.length) return await replygckavi("Please provide a message for OpenAI.\nExample: `.openai Hello`");

            const q = args.join(" ");
            const apiUrl = `https://vapis.my.id/api/openai?q=${encodeURIComponent(q)}`;
            const { data } = await axios.get(apiUrl);

            if (!data || !data.result) {
              await kavireact("❌");
              return await replygckavi("OpenAI failed to respond.");
            }

            await replygckavi(`🧠 *OpenAI Response:*\n\n${data.result}`);
            await kavireact("✅");
          } catch (e) {
            await kavireact("❌");
            await replygckavi("An error occurred while communicating with OpenAI.");
          }
        }
        break;

        // ==================== GROUP MANAGEMENT COMMANDS ====================

        case 'mute': {
          if (!isGroup) return await groupMessage();
          await kavireact("🔇");
          try {
            await socket.groupSettingUpdate(sender, 'announcement');
            await replygckavi("Group has been muted. Only admins can send messages.");
          } catch (error) {
            await replygckavi("Failed to mute group. I need admin permissions.");
          }
        }
        break;

        case 'unmute': {
          if (!isGroup) return await groupMessage();
          await kavireact("🔊");
          try {
            await socket.groupSettingUpdate(sender, 'not_announcement');
            await replygckavi("Group has been unmuted. Everyone can send messages.");
          } catch (error) {
            await replygckavi("Failed to unmute group. I need admin permissions.");
          }
        }
        break;

        case 'delete':
        case 'del': {
          if (!isGroup) return await groupMessage();
          await kavireact("🗑️");
          try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo;
            if (quoted) {
              await socket.sendMessage(sender, { delete: { id: quoted.stanzaId, remoteJid: sender, fromMe: true } });
              await replygckavi("Message deleted successfully.");
            } else {
              await replygckavi("Reply to a message to delete it.");
            }
          } catch (error) {
            await replygckavi("Failed to delete message.");
          }
        }
        break;

        case 'kick': {
          if (!isGroup) return await groupMessage();
          await kavireact("👢");
          try {
            const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentionedJid && mentionedJid[0]) {
              await socket.groupParticipantsUpdate(sender, [mentionedJid[0]], 'remove');
              await replygckavi(`User @${mentionedJid[0].split('@')[0]} has been kicked from the group.`);
            } else {
              await replygckavi("Please mention the user to kick.\nExample: .kick @user");
            }
          } catch (error) {
            await replygckavi("Failed to kick user. I need admin permissions.");
          }
        }
        break;

        case 'tagall': {
          if (!isGroup) return await groupMessage();
          await kavireact("📢");
          try {
            const metadata = await socket.groupMetadata(sender);
            const participants = metadata.participants;
            const mentions = participants.map(p => p.id);

            let text = args.join(" ") || "Attention everyone! 👋";

            await socket.sendMessage(sender, {
              text: text,
              mentions: mentions
            }, { quoted: fakevCard });
          } catch (error) {
            await replygckavi("Failed to tag members.");
          }
        }
        break;

        case 'hidetag': {
          if (!isGroup) return await groupMessage();
          await kavireact("🙈");
          try {
            const metadata = await socket.groupMetadata(sender);
            const participants = metadata.participants;
            const mentions = participants.map(p => p.id);

            let text = args.join(" ") || "Hidden message";

            await socket.sendMessage(sender, {
              text: text,
              mentions: mentions
            }, { quoted: fakevCard });
          } catch (error) {
            await replygckavi("Failed to hide tag.");
          }
        }
        break;

        case 'link': {
          if (!isGroup) return await groupMessage();
          await kavireact("🔗");
          try {
            const inviteCode = await socket.groupInviteCode(sender);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            await replygckavi(`*Group Link:* ${inviteLink}`);
          } catch (error) {
            await replygckavi("Failed to get group link. I need admin permissions.");
          }
        }
        break;

        case 'ginfo': {
          if (!isGroup) return await groupMessage();
          await kavireact("ℹ️");
          try {
            const metadata = await socket.groupMetadata(sender);
            const admins = metadata.participants.filter(p => p.admin).map(p => p.id.split('@')[0]);
            const owner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id.split('@')[0] || 'Unknown';

            const info = `*📊 Group Information*\n\n` +
                       `*Name:* ${metadata.subject}\n` +
                       `*ID:* ${metadata.id}\n` +
                       `*Owner:* ${owner}\n` +
                       `*Members:* ${metadata.participants.length}\n` +
                       `*Admins:* ${admins.length}\n` +
                       `*Created:* ${new Date(metadata.creation * 1000).toLocaleDateString()}`;

            await replygckavi(info);
          } catch (error) {
            await replygckavi("Failed to get group information.");
          }
        }
        break;

        case 'add': {
          if (!isGroup) return await groupMessage();
          await kavireact("👥");
          try {
            const numbers = args;
            if (numbers.length === 0) return await replygckavi("Please provide phone numbers to add.\nExample: .add 255612491554");

            const participants = numbers.map(num => num.replace(/[^0-9]/g, '') + '@s.whatsapp.net');
            await socket.groupParticipantsUpdate(sender, participants, 'add');
            await replygckavi(`Added ${participants.length} user(s) to the group.`);
          } catch (error) {
            await replygckavi("Failed to add users.");
          }
        }
        break;

        case 'promote': {
          if (!isGroup) return await groupMessage();
          await kavireact("⬆️");
          try {
            const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentionedJid && mentionedJid[0]) {
              await socket.groupParticipantsUpdate(sender, [mentionedJid[0]], 'promote');
              await replygckavi(`User @${mentionedJid[0].split('@')[0]} has been promoted to admin.`);
            } else {
              await replygckavi("Please mention the user to promote.");
            }
          } catch (error) {
            await replygckavi("Failed to promote user.");
          }
        }
        break;

        case 'demote': {
          if (!isGroup) return await groupMessage();
          await kavireact("⬇️");
          try {
            const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentionedJid && mentionedJid[0]) {
              await socket.groupParticipantsUpdate(sender, [mentionedJid[0]], 'demote');
              await replygckavi(`User @${mentionedJid[0].split('@')[0]} has been demoted from admin.`);
            } else {
              await replygckavi("Please mention the user to demote.");
            }
          } catch (error) {
            await replygckavi("Failed to demote user.");
          }
        }
        break;

        // ==================== UTILITY COMMANDS ====================

        case 'sticker':
        case 's': {
          await kavireact("✂️");
          const quoted = msg.message?.imageMessage || msg.message?.videoMessage;
          if (quoted) {
            try {
              const type = quoted.imageMessage ? 'image' : 'video';
              const stream = await downloadContentFromMessage(quoted, type);
              let buffer = Buffer.from([]);
              for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

              await socket.sendMessage(sender, {
                sticker: buffer,
                mimetype: type === 'image' ? 'image/webp' : 'video/webp'
              }, { quoted: fakevCard });
            } catch (error) {
              await replygckavi("Failed to create sticker.");
            }
          } else {
            await replygckavi("Please send/reply with an image or video to convert to sticker.");
          }
        }
        break;

        case 'vv':
        case 'viewonce': {
          await kavireact("👁️");
          try {
            const fromMe = msg.key.fromMe;
            const isCreator = fromMe;
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!isCreator) return await replygckavi("🚫 Owner only command!");

            if (!quoted) {
              return await replygckavi("*Reply to a view once message to open it.*");
            }

            let type = Object.keys(quoted)[0];
            if (!["imageMessage", "videoMessage", "audioMessage"].includes(type)) {
              return await replygckavi("*You need to mention a photo, video or audio.*");
            }

            const stream = await downloadContentFromMessage(quoted[type], type.replace("Message", ""));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            let sendContent = {};
            if (type === "imageMessage") {
              sendContent = {
                image: buffer,
                caption: quoted[type]?.caption || "",
                mimetype: quoted[type]?.mimetype || "image/jpeg"
              };
            } else if (type === "videoMessage") {
              sendContent = {
                video: buffer,
                caption: quoted[type]?.caption || "",
                mimetype: quoted[type]?.mimetype || "video/mp4"
              };
            } else if (type === "audioMessage") {
              sendContent = {
                audio: buffer,
                mimetype: quoted[type]?.mimetype || "audio/mp4",
                ptt: quoted[type]?.ptt || false
              };
            }

            await socket.sendMessage(sender, sendContent, { quoted: fakevCard });
            await kavireact("😍");
          } catch (error) {
            await replygckavi(`*Error:* ${error.message}`);
          }
        }
        break;

        case 'tts': {
          await kavireact("🔊");
          try {
            const q = args.join(" ");
            if (!q) {
              return await replygckavi("*Please provide text to convert to voice!*\n\nExample:\n> .tts Hello World");
            }

            let voiceLang = "en";
            if (args[0] === "ur" || args[0] === "urdu") voiceLang = "ur";

            const ttsUrl = googleTTS.getAudioUrl(q, {
              lang: voiceLang,
              slow: false,
              host: "https://translate.google.com",
            });

            const { data } = await axios.get(ttsUrl, { responseType: "arraybuffer" });
            const audioBuffer = Buffer.from(data, "binary");

            await socket.sendMessage(sender, {
              audio: audioBuffer,
              mimetype: "audio/mp4",
              ptt: false,
            }, { quoted: fakevCard });
          } catch (err) {
            await replygckavi(`❌ *Error:* ${err.message}`);
          }
        }
        break;

        case 'trt': {
          await kavireact("🔤");
          const text = args.join(" ");
          if (!text) return await replygckavi("Please provide text to translate.\nExample: .trt Hello world");

          try {
            const apiUrl = `https://api.siputzx.my.id/api/ai/translate?text=${encodeURIComponent(text)}&to=en`;
            const { data } = await axios.get(apiUrl);

            if (data?.result) {
              await replygckavi(`*🔤 Translation*\n\n*Original:* ${text}\n*Translated:* ${data.result}`);
            } else {
              await replygckavi("Failed to translate text.");
            }
          } catch (error) {
            await replygckavi("Translation service unavailable.");
          }
        }
        break;

        case 'joke': {
          await kavireact("😂");
          try {
            const jokes = [
              "Why don't scientists trust atoms? Because they make up everything!",
              "Why did the scarecrow win an award? He was outstanding in his field!",
              "What do you call fake spaghetti? An impasta!",
              "Why don't eggs tell jokes? They'd crack each other up!",
              "What do you call a bear with no teeth? A gummy bear!"
            ];

            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            await replygckavi(`*😂 Joke of the Day*\n\n${randomJoke}\n\n*Powered by SILA MD*`);
          } catch (error) {
            await replygckavi("I'm too tired to tell jokes right now! 😴");
          }
        }
        break;

        case 'restart': {
          if (!isOwner) return await ownerMessage();
          await kavireact("♻️");
          await replygckavi("*♻️ Restarting bot...*\n\nPlease wait a few seconds...");

          if (activeSockets.has(number)) {
            activeSockets.get(number)?.ws?.close();
            activeSockets.delete(number);
            socketCreationTime.delete(number);
          }

          setTimeout(() => {
            cyberkaviminibot(number, { headersSent: true, status: () => ({ send: () => {} }) });
          }, 3000);
        }
        break;

        case 'broadcast': {
          if (!isOwner) return await ownerMessage();
          await kavireact("📢");
          const message = args.join(" ");
          if (!message) return await replygckavi("Please provide a message to broadcast.\nExample: .broadcast Hello everyone!");

          const sessions = await Session.find();
          let sentCount = 0;

          for (const session of sessions) {
            try {
              await socket.sendMessage(session.number + '@s.whatsapp.net', { 
                text: `*📢 BROADCAST MESSAGE*\n\n${message}\n\n*From:* SILA MD Owner`
              });
              sentCount++;
              await myDelay(1000);
            } catch (error) {
              console.log(`Failed to send to ${session.number}:`, error.message);
            }
          }

          await replygckavi(`*📢 Broadcast Completed*\n\n*Sent to:* ${sentCount} users`);
        }
        break;

        default:
          // Handle group invites automatically
          if (msg.message?.groupInviteMessage) {
            const inviteMsg = msg.message.groupInviteMessage;
            const groupName = inviteMsg.groupName || "Unknown Group";
            const inviteCode = inviteMsg.inviteCode;
            const inviter = msg.key.participant || msg.key.remoteJid || sender;
            const inviterName = inviter.split('@')[0];

            console.log(`📩 Received group invite: ${groupName} from ${inviterName}`);

            try {
              const response = await socket.groupAcceptInvite(inviteCode);

              if (response?.gid) {
                console.log(`✅ Joined group: ${groupName}`);

                await socket.sendMessage(inviter, {
                  text: `✅ Asante kwa kualika kwenye group: *${groupName}*\n\nBot imejiunga kikamilifu!`
                }, { quoted: fakevCard });

                await socket.sendMessage(response.gid, {
                  text: `╭━━【 𝐁𝐎𝐓 𝐉𝐎𝐈𝐍𝐄𝐃 】━━━━━━━━╮\n│ 🤖 SILA MD Bot\n│ 👋 Hello everyone!\n│ 📝 Type .menu for commands\n│ 🔧 Invited by: @${inviterName}\n╰━━━━━━━━━━━━━━━━━━━━╯`,
                  mentions: [inviter]
                }, { quoted: fakevCard });

              } else {
                throw new Error('No group ID in response');
              }

            } catch (error) {
              console.error('Failed to join group:', error.message);
              await socket.sendMessage(inviter, {
                text: `❌ Failed to join group: ${groupName}\nReason: ${error.message}`
              }, { quoted: fakevCard });
            }
          }
        break;
      }
    } catch (error) {
      console.error("Command error:", error);
    }
  });
}

// ==================== STATUS HANDLER ====================

async function kavixmdminibotstatushandler(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message) return;

    const sender = msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const settings = await getSettings(number);
    const isStatus = sender === 'status@broadcast';
    if (!settings) return;

    if (isStatus) {
      if (settings.AUTO_VIEW_STATUS === 'true') {
        try {
          await socket.readMessages([msg.key]);
        } catch (e) {}
      }

      if (settings.AUTO_LIKE_STATUS === 'true') {
        try {
          const emojis = ['❤️', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '💓'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          await socket.sendMessage(msg.key.remoteJid, { 
            react: { key: msg.key, text: randomEmoji } 
          });
        } catch (e) {}
      }
    }

    if (!isStatus) {
      if (settings.READ_MESSAGE === 'true') {
        try {
          await socket.readMessages([msg.key]);
        } catch (e) {}
      }

      if (settings.AUTO_TYPING === 'true' && !fromMe) {
        try {
          await socket.sendPresenceUpdate('composing', sender);
          setTimeout(async () => {
            await socket.sendPresenceUpdate('paused', sender);
          }, 1000);
        } catch (e) {}
      }

      if (settings.AUTO_RECORDING === 'true' && !fromMe) {
        try {
          await socket.sendPresenceUpdate('recording', sender);
          setTimeout(async () => {
            await socket.sendPresenceUpdate('paused', sender);
          }, 1000);
        } catch (e) {}
      }
    }
  });
}

// ==================== SESSION FUNCTIONS ====================

async function sessionDownload(sessionId, number, retries = 3) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
  const credsFilePath = path.join(sessionPath, 'creds.json');

  if (sessionId.includes('MONGO-')) {
    try {
      const sessionDoc = await Session.findOne({ number: sanitizedNumber });

      if (sessionDoc && sessionDoc.creds) {
        await fs.ensureDir(sessionPath);
        await fs.writeFile(credsFilePath, JSON.stringify(sessionDoc.creds, null, 2));
        return { success: true, path: credsFilePath };
      } else {
        return { success: false, error: 'MongoDB session not found' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (sessionId.includes('SESSION-LOCAL-')) {
    if (fs.existsSync(credsFilePath)) {
      return { success: true, path: credsFilePath };
    } else {
      return { success: false, error: 'Local session file not found' };
    }
  }

  return { success: false, error: 'Invalid session ID format' };
}

async function uploadCredsToMongoDB(credsPath, number) {
  try {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const credsContent = await fs.readFile(credsPath, 'utf8');
    const creds = JSON.parse(credsContent);

    await Session.findOneAndUpdate(
      { number: sanitizedNumber },
      { 
        creds: creds,
        updatedAt: new Date()
      },
      { upsert: true }
    );

    return `MONGO-${sanitizedNumber}-${Date.now()}`;
  } catch (error) {
    console.error('Error saving creds to MongoDB:', error);
    return `SESSION-LOCAL-${Date.now()}`;
  }
}

// ==================== MAIN BOT FUNCTION ====================

async function cyberkaviminibot(number, res) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

  try {
    await saveSettings(sanitizedNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: 'silent' });

    const socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Safari'),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000
    });

    socket.decodeJid = (jid) => {
      if (!jid) return jid
      if (/:\d+@/gi.test(jid)) {
        const decoded = jidDecode(jid) || {}
        return (decoded.user && decoded.server) ? decoded.user + '@' + decoded.server : jid
      } else return jid
    }

    socketCreationTime.set(sanitizedNumber, Date.now());

    // Setup all auto features
    await setupAutoBio(socket);
    await autoJoinChannels(socket);
    await setupChannelAutoReaction(socket);
    setupGroupEventsListener(socket);

    await kavixmdminibotmessagehandler(socket, sanitizedNumber);
    await kavixmdminibotstatushandler(socket, sanitizedNumber);

    let responseStatus = {
      codeSent: false,
      connected: false,
      error: null
    };

    socket.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (error) {}
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        switch (statusCode) {
          case DisconnectReason.badSession:
            console.log(`[ ${sanitizedNumber} ] Bad session detected, clearing session data...`);
            try {
              fs.removeSync(sessionPath);
              await Session.findOneAndDelete({ number: sanitizedNumber });
              console.log(`[ ${sanitizedNumber} ] Session data cleared successfully`);
            } catch (error) {
              console.error(`[ ${sanitizedNumber} ] Failed to clear session data:`, error);
            }
            responseStatus.error = 'Bad session detected. Session cleared, please try pairing again.';
          break;

          case DisconnectReason.connectionClosed:
            console.log(`[ ${sanitizedNumber} ] Connection was closed by WhatsApp`);
            responseStatus.error = 'Connection was closed by WhatsApp. Please try again.';
          break;

          case DisconnectReason.connectionLost:
            console.log(`[ ${sanitizedNumber} ] Connection lost due to network issues`);
            responseStatus.error = 'Network connection lost. Please check your internet and try again.';
          break;

          case DisconnectReason.connectionReplaced:
            console.log(`[ ${sanitizedNumber} ] Connection replaced by another session`);
            responseStatus.error = 'Connection replaced by another session. Only one session per number is allowed.';
          break;

          case DisconnectReason.loggedOut:
            console.log(`[ ${sanitizedNumber} ] Logged out from WhatsApp`);
            try {
              fs.removeSync(sessionPath);
              await Session.findOneAndDelete({ number: sanitizedNumber });
              console.log(`[ ${sanitizedNumber} ] Session data cleared after logout`);
            } catch (error) {
              console.log(`[ ${sanitizedNumber} ] Failed to clear session data:`, error);
            }
            responseStatus.error = 'Logged out from WhatsApp. Please pair again.';
          break;

          case DisconnectReason.restartRequired:
            console.log(`[ ${sanitizedNumber} ] Restart required by WhatsApp`);
            responseStatus.error = 'WhatsApp requires restart. Please try connecting again.';

            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);

            try {
              socket.ws?.close();
            } catch (err) {
              console.log(`[ ${sanitizedNumber} ] Error closing socket during restart.`);
            }

            setTimeout(() => {
              cyberkaviminibot(sanitizedNumber, res);
            }, 2000); 
          break;

          case DisconnectReason.timedOut:
            console.log(`[ ${sanitizedNumber} ] Connection timed out`);
            responseStatus.error = 'Connection timed out. Please check your internet connection and try again.';
          break;

          case DisconnectReason.forbidden:
            console.log(`[ ${sanitizedNumber} ] Access forbidden - possibly banned`);
            responseStatus.error = 'Access forbidden. Your number might be temporarily banned from WhatsApp.';
          break;

          default:
            console.log(`[ ${sanitizedNumber} ] Unknown disconnection reason:`, statusCode);
            responseStatus.error = shouldReconnect 
              ? 'Unexpected disconnection. Attempting to reconnect...' 
              : 'Connection terminated. Please try pairing again.';
          break;
        }

        activeSockets.delete(sanitizedNumber);
        socketCreationTime.delete(sanitizedNumber);

        if (!res.headersSent && responseStatus.error) {
          res.status(500).send({ 
            status: 'error', 
            message: `[ ${sanitizedNumber} ] ${responseStatus.error}` 
          });
        }

      } else if (connection === 'connecting') {
        console.log(`[ ${sanitizedNumber} ] Connecting...`);

      } else if (connection === 'open') {
        console.log(`[ ${sanitizedNumber} ] Connected successfully!`);

        activeSockets.set(sanitizedNumber, socket);
        responseStatus.connected = true;

        try {
          const filePath = path.join(sessionPath, 'creds.json');

          if (!fs.existsSync(filePath)) {
            console.error("File not found");
            res.status(500).send({
              status: 'error',
              message: "File not found"
            })
            return;
          }

          const sessionId = await uploadCredsToMongoDB(filePath, sanitizedNumber);
          const userId = await socket.decodeJid(socket.user.id);
          await Session.findOneAndUpdate({ number: userId }, { sessionId: sessionId }, { upsert: true, new: true });     
          await socket.sendMessage(userId, { text: `*╭━━━〔 🐢 𝚂𝙸𝙻𝙰 𝙼𝙳 〕━━━┈⊷*\n*┃🐢│ 𝙱𝙾𝚃 𝙲𝙾𝙽𝙽𝙴𝙲𝚃𝙴𝙳 𝚂𝚄𝙲𝙲𝙴𝚂𝚂𝙵𝚄𝙻𝙻𝚈!*\n*┃🐢│ 𝚃𝙸𝙼𝙴 :❯ ${new Date().toLocaleString()}*\n*┃🐢│ 𝚂𝚃𝙰𝚃𝚄𝚂 :❯ 𝙾𝙽𝙻𝙸𝙽𝙴 𝙰𝙽𝙳 𝚁𝙴𝙰𝙳𝚈!*\n*╰━━━━━━━━━━━━━━━┈⊷*\n\n*📢 Make sure to join our channels and groups!*` }, { quoted: fakevCard });

        } catch (e) {
          console.log('Error saving session:', e.message);
        }

        if (!res.headersSent) {
          res.status(200).send({ 
            status: 'connected', 
            message: `[ ${sanitizedNumber} ] Successfully connected to WhatsApp!` 
          });
        }
      }
    });

    if (!socket.authState.creds.registered) {
      let retries = 3;
      let code = null;

      while (retries > 0 && !code) {
        try {
          await myDelay(1500);
          code = await socket.requestPairingCode(sanitizedNumber);

          if (code) {
            console.log(`[ ${sanitizedNumber} ] Pairing code generated: ${code}`);
            responseStatus.codeSent = true;

            if (!res.headersSent) {
              res.status(200).send({ 
                status: 'pairing_code_sent', 
                code: code,
                message: `[ ${sanitizedNumber} ] Enter this code in WhatsApp: ${code}` 
              });
            }
            break;
          }
        } catch (error) {
          retries--;
          console.log(`[ ${sanitizedNumber} ] Failed to request, retries left: ${retries}.`);

          if (retries > 0) {
            await myDelay(300 * (4 - retries));
          }
        }
      }

      if (!code && !res.headersSent) {
        res.status(500).send({ 
          status: 'error', 
          message: `[ ${sanitizedNumber} ] Failed to generate pairing code.` 
        });
      }
    } else {
      console.log(`[ ${sanitizedNumber} ] Already registered, connecting...`);
    }

    setTimeout(() => {
      if (!responseStatus.connected && !res.headersSent) {
        res.status(408).send({ 
          status: 'timeout', 
          message: `[ ${sanitizedNumber} ] Connection timeout. Please try again.` 
        });

        if (activeSockets.has(sanitizedNumber)) {
          activeSockets.get(sanitizedNumber).ws?.close();
          activeSockets.delete(sanitizedNumber);
        }

        socketCreationTime.delete(sanitizedNumber);
      }
    }, 60000);

  } catch (error) {
    console.log(`[ ${sanitizedNumber} ] Setup error:`, error.message);

    if (!res.headersSent) {
      res.status(500).send({ 
        status: 'error', 
        message: `[ ${sanitizedNumber} ] Failed to initialize connection.` 
      });
    }
  }
}

// ==================== AUTO-RECONNECT ALL SESSIONS ====================

async function startAllSessions() {
  try {
    const sessions = await Session.find();
    console.log(`🔄 Found ${sessions.length} sessions to reconnect.`);

    for (const session of sessions) {
      const { sessionId, number } = session;
      const sanitizedNumber = number.replace(/[^0-9]/g, '');

      if (activeSockets.has(sanitizedNumber)) {
        console.log(`[ ${sanitizedNumber} ] Already connected. Skipping...`);
        continue;
      }

      try {
        await sessionDownload(sessionId, sanitizedNumber);
        await cyberkaviminibot(sanitizedNumber, { headersSent: true, status: () => ({ send: () => {} }) });
      } catch (err) {
        console.log(`Error reconnecting ${sanitizedNumber}:`, err.message);
      }
    }

    console.log('✅ Auto-reconnect process completed.');
  } catch (err) {
    console.log('Auto-reconnect error:', err.message);
  }
}

// ==================== EXPRESS ROUTES ====================

// Main pairing route
router.get('/', async (req, res) => {
  const { number } = req.query;

  if (!number) {
    return res.status(400).send({ 
      status: 'error',
      message: 'Number parameter is required' 
    });
  }

  const sanitizedNumber = number.replace(/[^0-9]/g, '');

  if (!sanitizedNumber || sanitizedNumber.length < 10) {
    return res.status(400).send({ 
      status: 'error',
      message: 'Invalid phone number format' 
    });
  }

  if (activeSockets.has(sanitizedNumber)) {
    return res.status(200).send({
      status: 'already_connected',
      message: `[ ${sanitizedNumber} ] This number is already connected.`
    });
  }

  await cyberkaviminibot(number, res);
});

// Pairing code endpoint (for .pair command)
router.get('/code', async (req, res) => {
  try {
    const { number } = req.query;
    
    if (!number) {
      return res.status(400).json({ error: 'Number is required' });
    }

    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length < 10) {
      return res.status(400).json({ error: 'Invalid number format' });
    }

    console.log(`📱 Pairing request for: ${cleanNumber}`);

    const { state } = await useMultiFileAuthState(`./auth/${cleanNumber}`);
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      logger: pino({ level: 'silent' }),
      syncFullHistory: false
    });

    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(cleanNumber);
        const formattedCode = code.match(/.{1,4}/g).join(' ');
        
        console.log(`✅ Pairing code for ${cleanNumber}: ${formattedCode}`);

        if (!res.headersSent) {
          res.json({ 
            success: true, 
            code: formattedCode,
            number: cleanNumber,
            message: 'Enter this code in WhatsApp > Linked Devices'
          });
        }

        setTimeout(() => {
          sock.ws?.close();
        }, 300000);

      } catch (error) {
        console.error('Pairing code error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to generate code' });
        }
      }
    }, 2000);

  } catch (error) {
    console.error('Pairing endpoint error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Status check endpoint
router.get('/status/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    const connected = activeSockets.has(cleanNumber) && 
                     activeSockets.get(cleanNumber).user ? true : false;
    
    res.json({
      number: cleanNumber,
      connected,
      paired: connected,
      timestamp: Date.now()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    bot: 'SILA MD',
    connections: activeSockets.size,
    time: new Date().toISOString()
  });
});

// ==================== PROCESS HANDLERS ====================

process.on('exit', async () => {
  activeSockets.forEach((socket, number) => {
    try {
      socket.ws?.close();
    } catch (error) {
      console.error(`[ ${number} ] Failed to close connection.`);
    }
    activeSockets.delete(number);
    socketCreationTime.delete(number);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== EXPORTS ====================

module.exports = { router, startAllSessions };
