const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage, makeInMemoryStore, jidNormalizedUser, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const router = express.Router();
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const moment = require('moment-timezone');
const { config } = require('./config');
const { Session, Settings, BadWord, DeletedMessage, getSettings, updateSettings } = require('./lib/database');
const { fkontak, getContextInfo, formatTime, downloadYouTube, downloadAudio, aiChat, googleSearch, hasLink, hasBadWord, isOwner } = require('./lib/functions');

// Store active connections
const activeConnections = new Map();

// Command handler
const commands = new Map();

// Register command function
const sila = (commandInfo, handler) => {
    const { nomCom, alias = [], reaction = '🤖', desc = '', Categorie = 'General', fromMe = 'false' } = commandInfo;
    
    const command = {
        name: nomCom,
        aliases: alias,
        reaction,
        description: desc,
        category: Categorie,
        fromMe,
        handler
    };
    
    commands.set(nomCom, command);
    alias.forEach(aliasName => commands.set(aliasName, command));
};

// Load all commands
const loadCommands = () => {
    // ==================== GENERAL COMMANDS ====================
    
    // Menu Command
    sila({
        nomCom: 'menu',
        alias: ['menu', 'help', 'cmd', 'commands'],
        reaction: '📋',
        desc: 'Show bot menu',
        Categorie: 'General'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { ms, repondre, prefixe, nomAuteurMessage } = commandeOptions;
            const settings = await getSettings(dest);
            
            const buttons = [
                { buttonId: `${prefixe}allmenu`, buttonText: { displayText: "📋 𝙰𝙻𝙻 𝙼𝙴𝙽𝚄" }, type: 1 },
                { buttonId: `${prefixe}features`, buttonText: { displayText: "✨ 𝙵𝙴𝙰𝚃𝚄𝚁𝙴𝚂" }, type: 1 },
                { buttonId: `${prefixe}owner`, buttonText: { displayText: "👑 𝙾𝚆𝙽𝙴𝚁" }, type: 1 }
            ];

            const buttonMessage = {
                text: `┏━❑ ${config.botName} ━━━━━━━━━
┃ 🤖 *Bot:* ${config.botName}
┃ ⏰ *Time:* ${formatTime()}
┃ 👤 *User:* @${dest.split('@')[0]}
┃ 📍 *Prefix:* ${prefixe}
┗━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━
> ${config.botFooter}`,
                footer: `${config.botName} © 2026`,
                buttons: buttons,
                headerType: 1,
                contextInfo: getContextInfo({ sender: dest, mentionedJid: [dest] })
            };

            await zk.sendMessage(dest, buttonMessage, { quoted: fkontak });
        } catch (e) {
            console.log("❌ Menu Error:", e);
        }
    });

    // Features Command
    sila({
        nomCom: 'features',
        alias: ['features', 'menu2'],
        reaction: '✨',
        desc: 'Show bot features',
        Categorie: 'General'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { repondre } = commandeOptions;
            const features = `✨ *${config.botName} FEATURES* ✨

① 👀 *AUTO VIEW STATUS*
② ❤️ *AUTO LIKE STATUS*
③ 👁️ *VIEW ONCE*
④ 🤖 *AUTO REPLY*
⑤ 🛡️ *ANTI-LINK & ANTI-BAD WORDS*
   📌 *ANTI-DELETE* (Chat/Group/All)
⑥ 👥 *GROUP MANAGEMENT*
   • Welcome/Goodbye
   • Promote/Demote
   • Kick/Add
   • Mute/Unmute
⑦ 🎵 *MUSIC DOWNLOADER*
⑧ 🎥 *VIDEO DOWNLOADER*
⑨ 📸 *IMAGE ↔️ STICKER*
⑩ 🌐 *GOOGLE SEARCH*
⑪ 🧠 *AI CHAT*
⑫ 🕹️ *GAMES & FUN*

> ${config.botFooter}`;
            
            await repondre(features);
        } catch (e) {
            console.log("❌ Features Error:", e);
        }
    });

    // Alive Command with Buttons
    sila({
        nomCom: 'alive',
        alias: ['alive', 'bot', 'status'],
        reaction: '💚',
        desc: 'Check bot status',
        Categorie: 'General'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { prefixe, repondre } = commandeOptions;
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            const buttons = [
                { buttonId: `${prefixe}menu`, buttonText: { displayText: "📋 𝙼𝙴𝙽𝚄" }, type: 1 },
                { buttonId: `${prefixe}ping`, buttonText: { displayText: "📊 𝙿𝙸𝙽𝙶" }, type: 1 },
                { buttonId: `${prefixe}owner`, buttonText: { displayText: "👑 𝙾𝚆𝙽𝙴𝚁" }, type: 1 }
            ];

            const buttonMessage = {
                text: `┏━❑ *${config.botName}* ━━━━━━━━━
┃ 💚 *Status:* ONLINE
┃ ⏰ *Uptime:* ${hours}h ${minutes}m
┃ 📍 *Prefix:* ${prefixe}
┃ 👤 *Active Users:* ${activeConnections.size}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`,
                footer: config.botName,
                buttons: buttons,
                headerType: 1,
                contextInfo: getContextInfo({ sender: dest })
            };

            await zk.sendMessage(dest, buttonMessage, { quoted: fkontak });
        } catch (e) {
            console.log("❌ Alive Error:", e);
        }
    });

    // Ping Command
    sila({
        nomCom: 'ping',
        alias: ['ping', 'pong'],
        reaction: '📊',
        desc: 'Check bot response time',
        Categorie: 'General'
    }, async (dest, zk, commandeOptions) => {
        try {
            const start = Date.now();
            const { repondre } = commandeOptions;
            const end = Date.now();
            const responseTime = end - start;
            
            await repondre(`┏━❑ *𝙿𝙸𝙽𝙶* ━━━━━━━━━
┃ 📡 *Response:* ${responseTime}ms
┃ ⚡ *Speed:* ${responseTime < 200 ? 'Fast' : responseTime < 500 ? 'Normal' : 'Slow'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Ping Error:", e);
        }
    });

    // Owner Command
    sila({
        nomCom: 'owner',
        alias: ['owner', 'creator', 'developer'],
        reaction: '👑',
        desc: 'Show bot owner',
        Categorie: 'General'
    }, async (dest, zk, commandeOptions) => {
        try {
            const vcard = 'BEGIN:VCARD\n' +
                'VERSION:3.0\n' +
                `FN:${config.ownerName}\n` +
                `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber.split('@')[0]}:+${config.ownerNumber.split('@')[0]}\n` +
                'END:VCARD';

            await zk.sendMessage(dest, {
                contacts: {
                    displayName: config.ownerName,
                    contacts: [{ vcard }]
                }
            }, { quoted: fkontak });
        } catch (e) {
            console.log("❌ Owner Error:", e);
        }
    });

    // Set Prefix Command
    sila({
        nomCom: 'setprefix',
        alias: ['setprefix', 'prefix'],
        reaction: '⚙️',
        desc: 'Set bot prefix (none or symbol)',
        Categorie: 'General',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const newPrefix = args[0] || '';
            
            await updateSettings(dest, { prefix: newPrefix });
            await repondre(`┏━❑ *𝚂𝙴𝚃 𝙿𝚁𝙴𝙵𝙸𝚇* ━━━━━━━━━
┃ ✅ *Success!*
┃ 📍 *New Prefix:* ${newPrefix || 'none (no prefix)'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Setprefix Error:", e);
        }
    });

    // ==================== FEATURE TOGGLE COMMANDS ====================

    // Auto View Status
    sila({
        nomCom: 'autoview',
        alias: ['autoview', 'viewstatus'],
        reaction: '👀',
        desc: 'Toggle auto view status',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.autoView;
            
            await updateSettings(dest, { autoView: newState });
            await repondre(`┏━❑ *𝙰𝚄𝚃𝙾 𝚅𝙸𝙴𝚆* ━━━━━━━━━
┃ 👀 *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Autoview Error:", e);
        }
    });

    // Auto Like Status
    sila({
        nomCom: 'autolike',
        alias: ['autolike', 'likestatus'],
        reaction: '❤️',
        desc: 'Toggle auto like status',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.autoLike;
            
            await updateSettings(dest, { autoLike: newState });
            await repondre(`┏━❑ *𝙰𝚄𝚃𝙾 𝙻𝙸𝙺𝙴* ━━━━━━━━━
┃ ❤️ *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Autolike Error:", e);
        }
    });

    // View Once
    sila({
        nomCom: 'viewonce',
        alias: ['viewonce', 'vv'],
        reaction: '👁️',
        desc: 'Toggle view once messages',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.viewOnce;
            
            await updateSettings(dest, { viewOnce: newState });
            await repondre(`┏━❑ *𝚅𝙸𝙴𝚆 𝙾𝙽𝙲𝙴* ━━━━━━━━━
┃ 👁️ *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Viewonce Error:", e);
        }
    });

    // Auto Reply
    sila({
        nomCom: 'autoreply',
        alias: ['autoreply', 'ai'],
        reaction: '🤖',
        desc: 'Toggle auto reply',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.autoReply;
            
            await updateSettings(dest, { autoReply: newState });
            await repondre(`┏━❑ *𝙰𝚄𝚃𝙾 𝚁𝙴𝙿𝙻𝚈* ━━━━━━━━━
┃ 🤖 *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Autoreply Error:", e);
        }
    });

    // Anti Link
    sila({
        nomCom: 'antilink',
        alias: ['antilink', 'antiurl'],
        reaction: '🛡️',
        desc: 'Toggle anti-link',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.antiLink;
            
            await updateSettings(dest, { antiLink: newState });
            await repondre(`┏━❑ *𝙰𝙽𝚃𝙸-𝙻𝙸𝙽𝙺* ━━━━━━━━━
┃ 🛡️ *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Antilink Error:", e);
        }
    });

    // Anti Bad Word
    sila({
        nomCom: 'antibadword',
        alias: ['antibad', 'badword'],
        reaction: '🚫',
        desc: 'Toggle anti-bad words',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.antiBadWord;
            
            await updateSettings(dest, { antiBadWord: newState });
            await repondre(`┏━❑ *𝙰𝙽𝚃𝙸-𝙱𝙰𝙳 𝚆𝙾𝚁𝙳* ━━━━━━━━━
┃ 🚫 *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Antibadword Error:", e);
        }
    });

    // Anti Delete
    sila({
        nomCom: 'antidelete',
        alias: ['antidelete', 'ad'],
        reaction: '🗑️',
        desc: 'Toggle anti-delete (off/chat/group/all)',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const mode = args[0] ? args[0].toLowerCase() : 'off';
            
            if (!['off', 'chat', 'group', 'all'].includes(mode)) {
                return repondre('❌ Invalid mode! Use: off/chat/group/all');
            }
            
            await updateSettings(dest, { antiDelete: mode });
            await repondre(`┏━❑ *𝙰𝙽𝚃𝙸-𝙳𝙴𝙻𝙴𝚃𝙴* ━━━━━━━━━
┃ 🗑️ *Mode:* ${mode.toUpperCase()}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Antidelete Error:", e);
        }
    });

    // Auto Typing
    sila({
        nomCom: 'autotyping',
        alias: ['autotyping', 'at'],
        reaction: '⌨️',
        desc: 'Toggle auto typing',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.autoTyping;
            
            await updateSettings(dest, { autoTyping: newState });
            await repondre(`┏━❑ *𝙰𝚄𝚃𝙾 𝚃𝚈𝙿𝙸𝙽𝙶* ━━━━━━━━━
┃ ⌨️ *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Autotyping Error:", e);
        }
    });

    // Auto Recording
    sila({
        nomCom: 'autorecording',
        alias: ['autorec', 'ar'],
        reaction: '🎙️',
        desc: 'Toggle auto recording',
        Categorie: 'Features',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.autoRecording;
            
            await updateSettings(dest, { autoRecording: newState });
            await repondre(`┏━❑ *𝙰𝚄𝚃𝙾 𝚁𝙴𝙲𝙾𝚁𝙳𝙸𝙽𝙶* ━━━━━━━━━
┃ 🎙️ *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Autorecording Error:", e);
        }
    });

    // Welcome
    sila({
        nomCom: 'welcome',
        alias: ['welcome', 'wlc'],
        reaction: '👋',
        desc: 'Toggle welcome message',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.welcome;
            
            await updateSettings(dest, { welcome: newState });
            await repondre(`┏━❑ *𝚆𝙴𝙻𝙲𝙾𝙼𝙴* ━━━━━━━━━
┃ 👋 *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Welcome Error:", e);
        }
    });

    // Goodbye
    sila({
        nomCom: 'goodbye',
        alias: ['goodbye', 'gb'],
        reaction: '👋',
        desc: 'Toggle goodbye message',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            const newState = args[0] ? args[0].toLowerCase() === 'on' : !settings.goodbye;
            
            await updateSettings(dest, { goodbye: newState });
            await repondre(`┏━❑ *𝙶𝙾𝙾𝙳𝙱𝚈𝙴* ━━━━━━━━━
┃ 👋 *Status:* ${newState ? 'ON' : 'OFF'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`);
        } catch (e) {
            console.log("❌ Goodbye Error:", e);
        }
    });

    // ==================== GROUP MANAGEMENT COMMANDS ====================

    // Promote
    sila({
        nomCom: 'promote',
        alias: ['promote'],
        reaction: '⬆️',
        desc: 'Promote member to admin',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { ms, repondre } = commandeOptions;
            const users = ms.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (!users.length) return repondre('❌ Mention user to promote!');
            
            await zk.groupParticipantsUpdate(dest, users, 'promote');
            await repondre(`✅ Successfully promoted @${users[0].split('@')[0]}`);
        } catch (e) {
            console.log("❌ Promote Error:", e);
        }
    });

    // Demote
    sila({
        nomCom: 'demote',
        alias: ['demote'],
        reaction: '⬇️',
        desc: 'Demote admin to member',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { ms, repondre } = commandeOptions;
            const users = ms.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (!users.length) return repondre('❌ Mention user to demote!');
            
            await zk.groupParticipantsUpdate(dest, users, 'demote');
            await repondre(`✅ Successfully demoted @${users[0].split('@')[0]}`);
        } catch (e) {
            console.log("❌ Demote Error:", e);
        }
    });

    // Kick
    sila({
        nomCom: 'kick',
        alias: ['kick', 'remove'],
        reaction: '👢',
        desc: 'Remove member from group',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { ms, repondre } = commandeOptions;
            const users = ms.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (!users.length) return repondre('❌ Mention user to kick!');
            
            await zk.groupParticipantsUpdate(dest, users, 'remove');
            await repondre(`✅ Successfully kicked @${users[0].split('@')[0]}`);
        } catch (e) {
            console.log("❌ Kick Error:", e);
        }
    });

    // Add
    sila({
        nomCom: 'add',
        alias: ['add'],
        reaction: '➕',
        desc: 'Add member to group',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            if (!args.length) return repondre('❌ Provide number to add!');
            
            const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            await zk.groupParticipantsUpdate(dest, [number], 'add');
            await repondre(`✅ Successfully added @${number.split('@')[0]}`);
        } catch (e) {
            console.log("❌ Add Error:", e);
        }
    });

    // Mute
    sila({
        nomCom: 'mute',
        alias: ['mute'],
        reaction: '🔇',
        desc: 'Mute group',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            await zk.groupSettingUpdate(dest, 'announcement');
            await repondre('🔇 Group muted!');
        } catch (e) {
            console.log("❌ Mute Error:", e);
        }
    });

    // Unmute
    sila({
        nomCom: 'unmute',
        alias: ['unmute'],
        reaction: '🔊',
        desc: 'Unmute group',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            await zk.groupSettingUpdate(dest, 'not_announcement');
            await repondre('🔊 Group unmuted!');
        } catch (e) {
            console.log("❌ Unmute Error:", e);
        }
    });

    // Group Info
    sila({
        nomCom: 'groupinfo',
        alias: ['groupinfo', 'ginfo'],
        reaction: 'ℹ️',
        desc: 'Get group information',
        Categorie: 'Group'
    }, async (dest, zk, commandeOptions) => {
        try {
            const metadata = await zk.groupMetadata(dest);
            const info = `┏━❑ *𝙶𝚁𝙾𝚄𝙿 𝙸𝙽𝙵𝙾* ━━━━━━━━━
┃ 📛 *Name:* ${metadata.subject}
┃ 🆔 *ID:* ${metadata.id}
┃ 👥 *Members:* ${metadata.participants.length}
┃ 👑 *Owner:* @${metadata.owner?.split('@')[0] || 'unknown'}
┃ 📅 *Created:* ${moment(metadata.creation * 1000).format('DD/MM/YYYY')}
┃ 🔒 *Restrict:* ${metadata.restrict ? 'Yes' : 'No'}
┃ 🔇 *Announce:* ${metadata.announce ? 'Yes' : 'No'}
┗━━━━━━━━━━━━━━━━━━━━

> ${config.botFooter}`;
            
            await zk.sendMessage(dest, { text: info, mentions: [metadata.owner] }, { quoted: fkontak });
        } catch (e) {
            console.log("❌ Groupinfo Error:", e);
        }
    });

    // Tag All
    sila({
        nomCom: 'tagall',
        alias: ['tagall', 'mentionall'],
        reaction: '📢',
        desc: 'Tag all group members',
        Categorie: 'Group',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const metadata = await zk.groupMetadata(dest);
            const mentions = metadata.participants.map(p => p.id);
            const message = args.length ? args.join(' ') : '📢 @all';
            
            await zk.sendMessage(dest, { text: message, mentions }, { quoted: fkontak });
        } catch (e) {
            console.log("❌ Tagall Error:", e);
        }
    });

    // ==================== DOWNLOADER COMMANDS ====================

    // Music Download
    sila({
        nomCom: 'song',
        alias: ['song', 'play', 'music'],
        reaction: '🎵',
        desc: 'Download music from YouTube',
        Categorie: 'Downloader'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            
            if (!settings.musicDownload) {
                return repondre('❌ Music download is disabled!');
            }
            
            const query = args.join(' ');
            if (!query) return repondre('❌ Provide song name!');
            
            await repondre('🎵 *Searching...*');
            
            // Search YouTube
            const ytSearch = require('yt-search');
            const search = await ytSearch(query);
            
            if (!search.videos.length) return repondre('❌ No results found!');
            
            const video = search.videos[0];
            const audio = await downloadAudio(video.url);
            
            if (!audio) return repondre('❌ Download failed!');
            
            await zk.sendMessage(dest, {
                audio: { url: audio.url },
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`
            }, { quoted: fkontak });
            
        } catch (e) {
            console.log("❌ Song Error:", e);
            repondre('❌ Download failed!');
        }
    });

    // Video Download
    sila({
        nomCom: 'video',
        alias: ['video', 'yt'],
        reaction: '🎥',
        desc: 'Download video from YouTube',
        Categorie: 'Downloader'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const settings = await getSettings(dest);
            
            if (!settings.videoDownload) {
                return repondre('❌ Video download is disabled!');
            }
            
            const url = args[0];
            if (!url) return repondre('❌ Provide YouTube URL!');
            
            await repondre('🎥 *Downloading...*');
            
            const video = await downloadYouTube(url);
            
            if (!video) return repondre('❌ Download failed!');
            
            await zk.sendMessage(dest, {
                video: { url: video.url },
                caption: `🎥 *Title:* ${video.title}\n⏱️ *Duration:* ${video.duration}`
            }, { quoted: fkontak });
            
        } catch (e) {
            console.log("❌ Video Error:", e);
            repondre('❌ Download failed!');
        }
    });

    // ==================== AI & SEARCH COMMANDS ====================

    // AI Chat
    sila({
        nomCom: 'ai',
        alias: ['ai', 'chatgpt', 'gpt'],
        reaction: '🧠',
        desc: 'Chat with AI',
        Categorie: 'AI'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const query = args.join(' ');
            
            if (!query) return repondre('❌ Ask me something!');
            
            await repondre('🧠 *Thinking...*');
            
            const response = await aiChat(query);
            
            if (!response) return repondre('❌ AI service unavailable!');
            
            await repondre(response.message || response);
            
        } catch (e) {
            console.log("❌ AI Error:", e);
            repondre('❌ AI error!');
        }
    });

    // Google Search
    sila({
        nomCom: 'google',
        alias: ['google', 'search'],
        reaction: '🌐',
        desc: 'Search on Google',
        Categorie: 'Search'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const query = args.join(' ');
            
            if (!query) return repondre('❌ What to search?');
            
            await repondre('🌐 *Searching...*');
            
            const results = await googleSearch(query);
            
            if (!results.length) return repondre('❌ No results found!');
            
            let msg = `┏━❑ *𝙶𝙾𝙾𝙶𝙻𝙴 𝚂𝙴𝙰𝚁𝙲𝙷* ━━━━━━━━━\n`;
            results.slice(0, 5).forEach((result, i) => {
                msg += `┃ ${i + 1}. *${result.title}*\n`;
                msg += `┃ ${result.snippet}\n`;
                msg += `┃ ${result.link}\n━━━━━━━━━━━━━━━━━━━━\n`;
            });
            msg += `> ${config.botFooter}`;
            
            await repondre(msg);
            
        } catch (e) {
            console.log("❌ Google Error:", e);
            repondre('❌ Search failed!');
        }
    });

    // ==================== CONVERTER COMMANDS ====================

    // Image to Sticker
    sila({
        nomCom: 'sticker',
        alias: ['sticker', 's'],
        reaction: '📸',
        desc: 'Convert image to sticker',
        Categorie: 'Converter'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { ms, repondre } = commandeOptions;
            
            const quoted = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMessage = quoted?.imageMessage || ms.message?.imageMessage;
            
            if (!imageMessage) return repondre('❌ Reply to an image!');
            
            const stream = await downloadContentFromMessage(imageMessage, 'image');
            let buffer = Buffer.from([]);
            
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            await zk.sendMessage(dest, {
                sticker: buffer
            }, { quoted: fkontak });
            
        } catch (e) {
            console.log("❌ Sticker Error:", e);
            repondre('❌ Conversion failed!');
        }
    });

    // ==================== GAMES & FUN COMMANDS ====================

    // Truth
    sila({
        nomCom: 'truth',
        alias: ['truth'],
        reaction: '🤔',
        desc: 'Get a truth question',
        Categorie: 'Games'
    }, async (dest, zk, commandeOptions) => {
        try {
            const truths = [
                "What's your biggest fear?",
                "Have you ever lied to your best friend?",
                "Who was your first crush?",
                "What's the most embarrassing thing you've done?",
                "Have you ever stolen anything?",
                "What's your deepest secret?",
                "Who do you secretly hate?",
                "What's the worst thing you've done to someone?",
                "Have you ever cheated on a test?",
                "What's your biggest insecurity?"
            ];
            
            const truth = truths[Math.floor(Math.random() * truths.length)];
            await repondre(`🤔 *TRUTH*\n\n${truth}`);
            
        } catch (e) {
            console.log("❌ Truth Error:", e);
        }
    });

    // Dare
    sila({
        nomCom: 'dare',
        alias: ['dare'],
        reaction: '😈',
        desc: 'Get a dare challenge',
        Categorie: 'Games'
    }, async (dest, zk, commandeOptions) => {
        try {
            dares = [
                "Send a random emoji",
                "Say something nice about the person above you",
                "Do 10 pushups",
                "Send your last photo in gallery",
                "Sing a song and send voice note",
                "Change your display name to 'BOT' for 1 hour",
                "Send a screenshot of your chat with your crush",
                "Say 'I love you' to the last person you texted",
                "Post an embarrassing photo of yourself",
                "Confess your crush to the group"
            ];
            
            const dare = dares[Math.floor(Math.random() * dares.length)];
            await repondre(`😈 *DARE*\n\n${dare}`);
            
        } catch (e) {
            console.log("❌ Dare Error:", e);
        }
    });

    // ==================== BAD WORDS MANAGEMENT ====================

    // Add Bad Word
    sila({
        nomCom: 'addbadword',
        alias: ['addbad'],
        reaction: '⚠️',
        desc: 'Add bad word to filter',
        Categorie: 'Admin',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const word = args[0]?.toLowerCase();
            
            if (!word) return repondre('❌ Provide word to add!');
            
            const exists = await BadWord.findOne({ word });
            if (exists) return repondre('❌ Word already exists!');
            
            await BadWord.create({ word });
            await repondre(`✅ Added: ${word}`);
            
        } catch (e) {
            console.log("❌ Addbadword Error:", e);
        }
    });

    // Remove Bad Word
    sila({
        nomCom: 'removebadword',
        alias: ['removebad'],
        reaction: '✅',
        desc: 'Remove bad word from filter',
        Categorie: 'Admin',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { args, repondre } = commandeOptions;
            const word = args[0]?.toLowerCase();
            
            if (!word) return repondre('❌ Provide word to remove!');
            
            await BadWord.deleteOne({ word });
            await repondre(`✅ Removed: ${word}`);
            
        } catch (e) {
            console.log("❌ Removebadword Error:", e);
        }
    });

    // List Bad Words
    sila({
        nomCom: 'badwords',
        alias: ['badlist'],
        reaction: '📋',
        desc: 'List all bad words',
        Categorie: 'Admin',
        fromMe: 'true'
    }, async (dest, zk, commandeOptions) => {
        try {
            const words = await BadWord.find();
            
            if (!words.length) return repondre('No bad words in list!');
            
            let list = '┏━❑ *𝙱𝙰𝙳 𝚆𝙾𝚁𝙳𝚂* ━━━━━━━━━\n';
            words.forEach((w, i) => {
                list += `┃ ${i + 1}. ${w.word}\n`;
            });
            list += `┗━━━━━━━━━━━━━━━━━━━━\n> ${config.botFooter}`;
            
            await repondre(list);
            
        } catch (e) {
            console.log("❌ Badwords Error:", e);
        }
    });

    // ==================== ALL MENU ====================

    // All Menu
    sila({
        nomCom: 'allmenu',
        alias: ['allmenu', 'allcmd'],
        reaction: '📑',
        desc: 'Show all commands',
        Categorie: 'General'
    }, async (dest, zk, commandeOptions) => {
        try {
            const { prefixe, repondre } = commandeOptions;
            
            const categories = {};
            
            commands.forEach((cmd, name) => {
                if (!cmd.name) return;
                if (!categories[cmd.category]) categories[cmd.category] = [];
                if (!categories[cmd.category].includes(cmd.name)) {
                    categories[cmd.category].push(cmd.name);
                }
            });
            
            let menu = `┏━❑ *${config.botName}* ━━━━━━━━━
┃ 📋 *All Commands*
┃ ⏰ *${formatTime()}*
┗━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            for (const [category, cmds] of Object.entries(categories)) {
                menu += `┏━❑ *${category.toUpperCase()}* ━━━━━━━━━\n`;
                cmds.forEach(cmd => {
                    menu += `┃ ${prefixe}${cmd}\n`;
                });
                menu += `┗━━━━━━━━━━━━━━━━━━━━\n\n`;
            }
            
            menu += `> ${config.botFooter}`;
            
            await zk.sendMessage(dest, {
                image: { url: config.menuImage },
                caption: menu
            }, { quoted: fkontak });
            
        } catch (e) {
            console.log("❌ Allmenu Error:", e);
        }
    });

    console.log(`✅ Loaded ${commands.size} commands`);
};

// Message handler
const handleMessage = async (zk, msg, settings, prefix) => {
    try {
        const messageType = Object.keys(msg.message)[0];
        const messageContent = msg.message[messageType];
        const sender = msg.key.participant || msg.key.remoteJid;
        const chat = msg.key.remoteJid;
        const isGroup = chat.endsWith('@g.us');
        
        // Extract text
        let text = '';
        if (messageType === 'conversation') text = messageContent;
        else if (messageType === 'extendedTextMessage') text = messageContent.text;
        else if (messageType === 'imageMessage') text = messageContent.caption || '';
        else if (messageType === 'videoMessage') text = messageContent.caption || '';
        
        // Handle commands
        let commandUsed = '';
        let args = [];
        let prefixe = settings.prefix || prefix;
        
        if (prefixe === 'none') {
            // No prefix - check if message starts with any command
            for (const [cmdName, cmd] of commands) {
                if (text.toLowerCase().startsWith(cmdName.toLowerCase())) {
                    commandUsed = cmdName;
                    args = text.slice(cmdName.length).trim().split(/\s+/);
                    break;
                }
            }
        } else if (text.startsWith(prefixe)) {
            const parts = text.slice(prefixe.length).trim().split(/\s+/);
            commandUsed = parts[0].toLowerCase();
            args = parts.slice(1);
        }
        
        if (commandUsed && commands.has(commandUsed)) {
            const command = commands.get(commandUsed);
            
            // Check if command requires owner
            if (command.fromMe === 'true' && !isOwner(sender)) {
                return zk.sendMessage(chat, { 
                    text: '❌ This command is for owner only!' 
                }, { quoted: msg });
            }
            
            // Execute command
            await command.handler(chat, zk, {
                ms: msg,
                args,
                repondre: (text) => zk.sendMessage(chat, { text }, { quoted: msg }),
                prefixe,
                nomAuteurMessage: sender
            });
        } else {
            // Auto reply if enabled
            if (settings.autoReply && !commandUsed) {
                const response = await aiChat(text);
                if (response) {
                    await zk.sendMessage(chat, { 
                        text: response.message || response 
                    }, { quoted: msg });
                }
            }
        }
        
        // Anti-link for groups
        if (isGroup && settings.antiLink && hasLink(text)) {
            if (!isOwner(sender)) {
                await zk.sendMessage(chat, { 
                    text: '❌ Links are not allowed in this group!' 
                });
                await zk.groupParticipantsUpdate(chat, [sender], 'remove');
            }
        }
        
        // Anti-bad word
        if (settings.antiBadWord && await hasBadWord(text)) {
            if (!isOwner(sender)) {
                await zk.sendMessage(chat, { 
                    text: '❌ Bad words are not allowed!' 
                });
                await zk.sendMessage(chat, { delete: msg.key });
            }
        }
        
        // Auto typing
        if (settings.autoTyping) {
            await zk.sendPresenceUpdate('composing', chat);
        }
        
        // Auto recording
        if (settings.autoRecording) {
            await zk.sendPresenceUpdate('recording', chat);
        }
        
    } catch (error) {
        console.error('Message handling error:', error);
    }
};

// Status handler (auto view & like)
const handleStatus = async (zk, msg, settings) => {
    try {
        if (msg.key && msg.key.remoteJid === 'status@broadcast') {
            if (settings.autoView) {
                await zk.readMessages([msg.key]);
            }
            
            if (settings.autoLike) {
                await zk.sendMessage('status@broadcast', {
                    react: { text: '❤️', key: msg.key }
                });
            }
        }
    } catch (error) {
        console.error('Status handling error:', error);
    }
};

// View once handler
const handleViewOnce = async (zk, msg, settings) => {
    try {
        if (settings.viewOnce && msg.message?.viewOnceMessage) {
            const viewOnceMsg = msg.message.viewOnceMessage;
            const messageType = Object.keys(viewOnceMsg.message)[0];
            const content = viewOnceMsg.message[messageType];
            
            if (content) {
                const stream = await downloadContentFromMessage(content, messageType === 'imageMessage' ? 'image' : 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                
                await zk.sendMessage(msg.key.remoteJid, {
                    [messageType === 'imageMessage' ? 'image' : 'video']: buffer,
                    caption: '👁️ View Once Message'
                });
            }
        }
    } catch (error) {
        console.error('View once error:', error);
    }
};

// Anti-delete handler
const handleDelete = async (zk, msg, settings) => {
    try {
        if (settings.antiDelete !== 'off' && msg.message?.protocolMessage?.type === 0) {
            const deletedMsg = {
                messageId: msg.message.protocolMessage.key.id,
                jid: msg.key.remoteJid,
                participant: msg.key.participant || msg.key.remoteJid,
                message: msg.message.protocolMessage,
                messageType: 'unknown'
            };
            
            await DeletedMessage.create(deletedMsg);
            
            // Send to owner if mode is 'all' or appropriate
            if (settings.antiDelete === 'all' || 
                (settings.antiDelete === 'chat' && !msg.key.remoteJid.endsWith('@g.us')) ||
                (settings.antiDelete === 'group' && msg.key.remoteJid.endsWith('@g.us'))) {
                
                await zk.sendMessage(config.ownerNumber, {
                    text: `🗑️ *Deleted Message*\nFrom: @${deletedMsg.participant.split('@')[0]}\nChat: ${deletedMsg.jid}`,
                    mentions: [deletedMsg.participant]
                });
            }
        }
    } catch (error) {
        console.error('Anti-delete error:', error);
    }
};

// Welcome/Goodbye handler
const handleGroupParticipants = async (zk, update, settings) => {
    try {
        const { id, participants, action } = update;
        
        if (action === 'add' && settings.welcome) {
            for (const participant of participants) {
                await zk.sendMessage(id, {
                    text: `👋 *Welcome* @${participant.split('@')[0]} to the group!\nEnjoy your stay!`,
                    mentions: [participant]
                });
            }
        } else if (action === 'remove' && settings.goodbye) {
            for (const participant of participants) {
                await zk.sendMessage(id, {
                    text: `👋 *Goodbye* @${participant.split('@')[0]}\nWe'll miss you!`,
                    mentions: [participant]
                });
            }
        }
    } catch (error) {
        console.error('Welcome/Goodbye error:', error);
    }
};

// Auto follow newsletter
const autoFollowNewsletter = async (zk) => {
    try {
        await zk.newsletterFollow(config.newsletterJid);
        console.log('✅ Auto-followed newsletter');
    } catch (error) {
        console.error('Newsletter follow error:', error);
    }
};

// Auto join group
const autoJoinGroup = async (zk) => {
    try {
        // Extract group link from image or use direct link
        const groupLink = 'https://chat.whatsapp.com/INVITE_CODE';
        await zk.groupAcceptInvite(groupLink);
        console.log('✅ Auto-joined group');
    } catch (error) {
        console.error('Group join error:', error);
    }
};

// Auto channel reaction
const autoChannelReaction = async (zk, msg) => {
    try {
        if (msg.key.remoteJid === config.newsletterJid) {
            await zk.sendMessage(config.newsletterJid, {
                react: { text: '👍', key: msg.key }
            });
        }
    } catch (error) {
        console.error('Channel reaction error:', error);
    }
};

// Connect to WhatsApp
const connectToWhatsApp = async (sessionId) => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./auth/${sessionId}`);
        
        const zk = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: Browsers.macOS('Desktop'),
            logger: pino({ level: 'silent' }),
            syncFullHistory: true,
            generateHighQualityLinkPreview: true
        });
        
        // Store connection
        activeConnections.set(sessionId, zk);
        
        // Load settings
        const settings = await getSettings(sessionId);
        
        // Auto follow newsletter
        await autoFollowNewsletter(zk);
        
        // Auto join group
        await autoJoinGroup(zk);
        
        // Connection update handler
        zk.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed for ${sessionId}, reconnecting:`, shouldReconnect);
                
                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(sessionId), 5000);
                } else {
                    activeConnections.delete(sessionId);
                }
            } else if (connection === 'open') {
                console.log(`✅ Connected: ${sessionId}`);
            }
        });
        
        // Credentials update
        zk.ev.on('creds.update', saveCreds);
        
        // Messages handler
        zk.ev.on('messages.upsert', async ({ messages, type }) => {
            const msg = messages[0];
            if (!msg.message) return;
            
            // Get settings for this chat
            const chatSettings = await getSettings(msg.key.remoteJid);
            const globalPrefix = (await getSettings('global')).prefix || config.defaultPrefix;
            
            // Handle different types
            await handleStatus(zk, msg, chatSettings);
            await handleViewOnce(zk, msg, chatSettings);
            await handleDelete(zk, msg, chatSettings);
            await autoChannelReaction(zk, msg);
            await handleMessage(zk, msg, chatSettings, globalPrefix);
        });
        
        // Group participants handler
        zk.ev.on('group-participants.update', async (update) => {
            const chatSettings = await getSettings(update.id);
            await handleGroupParticipants(zk, update, chatSettings);
        });
        
        return zk;
        
    } catch (error) {
        console.error(`Connection error for ${sessionId}:`, error);
        setTimeout(() => connectToWhatsApp(sessionId), 5000);
    }
};

// Pairing route
router.post('/pair', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number required' });
        }
        
        const sessionId = phoneNumber.replace(/[^0-9]/g, '');
        
        // Check if already connected
        if (activeConnections.has(sessionId)) {
            return res.json({ 
                success: true, 
                message: 'Already connected',
                sessionId 
            });
        }
        
        // Start connection
        connectToWhatsApp(sessionId);
        
        res.json({ 
            success: true, 
            message: 'Pairing initiated',
            sessionId 
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ error: 'Pairing failed' });
    }
});

// Get connection status
router.get('/status/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const connected = activeConnections.has(sessionId);
        
        res.json({
            sessionId,
            connected,
            active: connected ? 'online' : 'offline'
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Status check failed' });
    }
});

// Disconnect session
router.post('/disconnect/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const zk = activeConnections.get(sessionId);
        
        if (zk) {
            zk.end();
            activeConnections.delete(sessionId);
        }
        
        res.json({ 
            success: true, 
            message: 'Disconnected' 
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

// Load all commands
loadCommands();

// Start default connection
connectToWhatsApp('default');

module.exports = router;
