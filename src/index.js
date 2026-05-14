require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const commands = require('./commands');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const dbPath = path.join(__dirname, '..', 'database.json');
const timers = new Map();

function loadDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ giveaways: {} }, null, 2));
  }

  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function parseDuration(input) {
  const regex = /(\d+)(d|h|m|s)/gi;
  let total = 0;
  let match;
  let matchedText = '';

  while ((match = regex.exec(input)) !== null) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    matchedText += match[0];

    if (unit === 'd') total += amount * 24 * 60 * 60 * 1000;
    if (unit === 'h') total += amount * 60 * 60 * 1000;
    if (unit === 'm') total += amount * 60 * 1000;
    if (unit === 's') total += amount * 1000;
  }

  if (matchedText.toLowerCase() !== input.toLowerCase()) return null;
  if (total <= 0) return null;

  return total;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];

  if (d) parts.push(`${d} gün`);
  if (h) parts.push(`${h} saat`);
  if (m) parts.push(`${m} dakika`);
  if (s) parts.push(`${s} saniye`);

  return parts.join(' ') || '0 saniye';
}

function createGiveawayEmbed(giveaway, ended = false) {
  const remaining = Math.max(giveaway.endTime - Date.now(), 0);

  return new EmbedBuilder()
    .setTitle(ended ? '🎉 Çekiliş Sona Erdi!' : '🎉 NTE Türkiye Çekilişi!')
    .setDescription(
      `🎁 **Ödül:** ${giveaway.prize}\n\n` +
      `👑 **Kazanan Sayısı:** ${giveaway.winnersCount}\n\n` +
      `⏳ **Kalan Süre:** ${ended ? 'Bitti' : formatDuration(remaining)}\n\n` +
      `👥 **Katılımcı:** ${giveaway.participants.length}\n\n` +
      (ended ? 'Çekiliş tamamlandı.' : 'Katılmak için aşağıdaki butona bas!')
    )
    .setColor(ended ? 'Green' : 'Purple')
    .setFooter({ text: 'NTE Türkiye Giveaway' })
    .setTimestamp();
}

function pickWinners(participants, count) {
  return [...participants].sort(() => Math.random() - 0.5).slice(0, count);
}

async function endGiveaway(messageId) {
  const db = loadDB();
  const giveaway = db.giveaways[messageId];

  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);

  const disabledButton = new ButtonBuilder()
    .setCustomId('join_giveaway')
    .setLabel('Çekiliş Bitti')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row = new ActionRowBuilder().addComponents(disabledButton);

  if (message) {
    await message.edit({
      embeds: [createGiveawayEmbed(giveaway, true)],
      components: [row]
    }).catch(() => {});
  }

  if (giveaway.participants.length === 0) {
    await channel.send(`❌ **${giveaway.prize}** çekilişine kimse katılmadı.`);
    saveDB(db);
    return;
  }

  const winners = pickWinners(giveaway.participants, giveaway.winnersCount);
  giveaway.winners = winners;

  await channel.send(
    `🎉 **Çekiliş Bitti!**\n\n` +
    `🎁 Ödül: **${giveaway.prize}**\n` +
    `👑 Kazananlar: ${winners.map(id => `<@${id}>`).join(', ')}`
  );

  saveDB(db);
}

function scheduleGiveaway(messageId) {
  const db = loadDB();
  const giveaway = db.giveaways[messageId];

  if (!giveaway || giveaway.ended) return;

  const remaining = giveaway.endTime - Date.now();

  if (remaining <= 0) {
    endGiveaway(messageId);
    return;
  }

  if (timers.has(messageId)) {
    clearTimeout(timers.get(messageId));
  }

  const timer = setTimeout(() => {
    endGiveaway(messageId);
  }, remaining);

  timers.set(messageId, timer);
}

async function deployCommands() {
  try {
    console.log('Slash komutları yükleniyor...');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('Slash komutları yüklendi!');
  } catch (error) {
    console.error('Slash komut yükleme hatası:', error);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.user.setPresence({
  activities: [{
    name: '🎉 Managing giveaways & rewards',
    type: 0
  }],
  status: 'online'
});
  const db = loadDB();

  for (const messageId of Object.keys(db.giveaways)) {
    scheduleGiveaway(messageId);
  }

  console.log(`${client.user.tag} aktif!`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'cekilis-baslat') {
        const prize = interaction.options.getString('ödül');
        const durationInput = interaction.options.getString('süre');
        const winnersCount = interaction.options.getInteger('kazanan');

        const durationMs = parseDuration(durationInput);

        if (!durationMs) {
          return interaction.reply({
            content: '❌ Süre formatı hatalı. Örnek: `30m`, `1h23m`, `2d5h30m`, `45m20s`',
            ephemeral: true
          });
        }

        if (winnersCount < 1) {
          return interaction.reply({
            content: '❌ Kazanan sayısı en az 1 olmalı.',
            ephemeral: true
          });
        }

        const tempGiveaway = {
          prize,
          winnersCount,
          durationInput,
          endTime: Date.now() + durationMs,
          participants: [],
          ended: false,
          winners: []
        };

        const button = new ButtonBuilder()
          .setCustomId('join_giveaway')
          .setLabel('Katıl 🎉')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        const message = await interaction.reply({
          embeds: [createGiveawayEmbed(tempGiveaway)],
          components: [row],
          fetchReply: true
        });

        const db = loadDB();

        db.giveaways[message.id] = {
          ...tempGiveaway,
          messageId: message.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId
        };

        saveDB(db);
        scheduleGiveaway(message.id);

        return;
      }

      if (interaction.commandName === 'cekilis-iptal') {
        const messageId = interaction.options.getString('mesaj_id');
        const db = loadDB();
        const giveaway = db.giveaways[messageId];

        if (!giveaway || giveaway.ended) {
          return interaction.reply({
            content: '❌ Bu ID ile aktif çekiliş bulunamadı.',
            ephemeral: true
          });
        }

        giveaway.ended = true;
        saveDB(db);

        if (timers.has(messageId)) {
          clearTimeout(timers.get(messageId));
          timers.delete(messageId);
        }

        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;

        if (message) {
          const disabledButton = new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('İptal Edildi')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true);

          const row = new ActionRowBuilder().addComponents(disabledButton);

          await message.edit({ components: [row] }).catch(() => {});
        }

        return interaction.reply(`❌ **${giveaway.prize}** çekilişi iptal edildi.`);
      }

      if (interaction.commandName === 'cekilis-yeniden-cek') {
        const messageId = interaction.options.getString('mesaj_id');
        const db = loadDB();
        const giveaway = db.giveaways[messageId];

        if (!giveaway) {
          return interaction.reply({
            content: '❌ Bu ID ile çekiliş bulunamadı.',
            ephemeral: true
          });
        }

        if (giveaway.participants.length === 0) {
          return interaction.reply({
            content: '❌ Bu çekilişte katılımcı yok.',
            ephemeral: true
          });
        }

        const winners = pickWinners(giveaway.participants, giveaway.winnersCount);

        giveaway.winners = winners;
        saveDB(db);

        return interaction.reply(
          `🎉 **Yeniden çekiliş yapıldı!**\n\n` +
          `🎁 Ödül: **${giveaway.prize}**\n` +
          `👑 Yeni kazananlar: ${winners.map(id => `<@${id}>`).join(', ')}`
        );
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'join_giveaway') {
        const messageId = interaction.message.id;
        const db = loadDB();
        const giveaway = db.giveaways[messageId];

        if (!giveaway || giveaway.ended) {
          return interaction.reply({
            content: '❌ Bu çekiliş sona ermiş.',
            ephemeral: true
          });
        }

        if (giveaway.participants.includes(interaction.user.id)) {
          return interaction.reply({
            content: '❌ Zaten bu çekilişe katıldın.',
            ephemeral: true
          });
        }

        giveaway.participants.push(interaction.user.id);
        saveDB(db);

        await interaction.message.edit({
          embeds: [createGiveawayEmbed(giveaway)]
        });

        return interaction.reply({
          content: '🎉 Çekilişe başarıyla katıldın!',
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('Interaction hatası:', error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true
      });
    }
  }
});

deployCommands();
client.login(process.env.TOKEN);

const app = express();

app.get('/', (req, res) => {
  res.send('NTE Giveaway bot aktif!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Web server ${PORT} portunda çalışıyor.`);
});