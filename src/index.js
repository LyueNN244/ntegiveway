require('dotenv').config();

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

const giveaways = new Map();

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

function parseDuration(duration) {
  const match = duration.match(/^(\d+)(m|h|d)$/i);

  if (!match) return null;

  const amount = Number(match[1]);
  const type = match[2].toLowerCase();

  if (type === 'm') return amount * 60 * 1000;
  if (type === 'h') return amount * 60 * 60 * 1000;
  if (type === 'd') return amount * 24 * 60 * 60 * 1000;

  return null;
}

function formatDuration(duration) {
  return duration
    .replace('m', ' dakika')
    .replace('h', ' saat')
    .replace('d', ' gün');
}

function createGiveawayEmbed({ prize, winnersCount, duration, participantsCount, ended = false }) {
  return new EmbedBuilder()
    .setTitle(ended ? '🎉 Çekiliş Sona Erdi!' : '🎉 NTE Türkiye Çekilişi!')
    .setDescription(
      `🎁 **Ödül:** ${prize}\n\n` +
      `👑 **Kazanan Sayısı:** ${winnersCount}\n\n` +
      `⏳ **Süre:** ${formatDuration(duration)}\n\n` +
      `👥 **Katılımcı:** ${participantsCount}\n\n` +
      (ended ? 'Çekiliş tamamlandı.' : 'Katılmak için aşağıdaki butona bas!')
    )
    .setColor(ended ? 'Green' : 'Purple')
    .setFooter({ text: 'NTE Türkiye Giveaway' })
    .setTimestamp();
}

function pickWinners(participants, count) {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function deployCommands() {
  try {
    console.log('Slash komutları yükleniyor...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('Slash komutları yüklendi!');
  } catch (error) {
    console.error('Slash komut yükleme hatası:', error);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`${client.user.tag} aktif!`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'cekilis-baslat') {
        const prize = interaction.options.getString('ödül');
        const duration = interaction.options.getString('süre');
        const winnersCount = interaction.options.getInteger('kazanan');

        const durationMs = parseDuration(duration);

        if (!durationMs) {
          return interaction.reply({
            content: '❌ Süre formatı hatalı. Örnek: `10m`, `2h`, `1d`',
            ephemeral: true
          });
        }

        if (winnersCount < 1) {
          return interaction.reply({
            content: '❌ Kazanan sayısı en az 1 olmalı.',
            ephemeral: true
          });
        }

        const embed = createGiveawayEmbed({
          prize,
          winnersCount,
          duration,
          participantsCount: 0
        });

        const button = new ButtonBuilder()
          .setCustomId('join_giveaway')
          .setLabel('Katıl 🎉')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        const message = await interaction.reply({
          embeds: [embed],
          components: [row],
          fetchReply: true
        });

        giveaways.set(message.id, {
          prize,
          duration,
          winnersCount,
          participants: new Set(),
          channelId: interaction.channelId,
          messageId: message.id,
          ended: false
        });

        setTimeout(async () => {
          const giveaway = giveaways.get(message.id);
          if (!giveaway || giveaway.ended) return;

          const channel = await client.channels.fetch(giveaway.channelId);
          const participants = Array.from(giveaway.participants);

          giveaway.ended = true;

          const endedEmbed = createGiveawayEmbed({
            prize: giveaway.prize,
            winnersCount: giveaway.winnersCount,
            duration: giveaway.duration,
            participantsCount: participants.length,
            ended: true
          });

          const disabledButton = new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('Çekiliş Bitti')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

          const giveawayMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);

          if (giveawayMessage) {
            await giveawayMessage.edit({
              embeds: [endedEmbed],
              components: [disabledRow]
            });
          }

          if (participants.length === 0) {
            await channel.send(`❌ **${giveaway.prize}** çekilişine kimse katılmadı.`);
            giveaways.delete(message.id);
            return;
          }

          const winners = pickWinners(participants, giveaway.winnersCount);

          await channel.send(
            `🎉 **Çekiliş Bitti!**\n\n` +
            `🎁 Ödül: **${giveaway.prize}**\n` +
            `👑 Kazananlar: ${winners.map(id => `<@${id}>`).join(', ')}`
          );

          giveaways.delete(message.id);
        }, durationMs);

        return;
      }

      if (interaction.commandName === 'cekilis-iptal') {
        const messageId = interaction.options.getString('mesaj_id');
        const giveaway = giveaways.get(messageId);

        if (!giveaway) {
          return interaction.reply({
            content: '❌ Bu ID ile aktif çekiliş bulunamadı.',
            ephemeral: true
          });
        }

        giveaway.ended = true;
        giveaways.delete(messageId);

        const channel = await client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(messageId).catch(() => null);

        if (message) {
          const disabledButton = new ButtonBuilder()
            .setCustomId('join_giveaway')
            .setLabel('İptal Edildi')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true);

          const row = new ActionRowBuilder().addComponents(disabledButton);

          await message.edit({
            components: [row]
          });
        }

        return interaction.reply(`❌ **${giveaway.prize}** çekilişi iptal edildi.`);
      }

      if (interaction.commandName === 'cekilis-yeniden-cek') {
        const messageId = interaction.options.getString('mesaj_id');
        const giveaway = giveaways.get(messageId);

        if (!giveaway) {
          return interaction.reply({
            content: '❌ Bu çekiliş aktif değil veya bot yeniden başlatılmış olabilir.',
            ephemeral: true
          });
        }

        const participants = Array.from(giveaway.participants);

        if (participants.length === 0) {
          return interaction.reply({
            content: '❌ Bu çekilişte katılımcı yok.',
            ephemeral: true
          });
        }

        const winners = pickWinners(participants, giveaway.winnersCount);

        return interaction.reply(
          `🎉 **Yeniden çekiliş yapıldı!**\n\n` +
          `🎁 Ödül: **${giveaway.prize}**\n` +
          `👑 Yeni kazananlar: ${winners.map(id => `<@${id}>`).join(', ')}`
        );
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'join_giveaway') {
        const giveaway = giveaways.get(interaction.message.id);

        if (!giveaway || giveaway.ended) {
          return interaction.reply({
            content: '❌ Bu çekiliş sona ermiş.',
            ephemeral: true
          });
        }

        if (giveaway.participants.has(interaction.user.id)) {
          return interaction.reply({
            content: '❌ Zaten bu çekilişe katıldın.',
            ephemeral: true
          });
        }

        giveaway.participants.add(interaction.user.id);

        const updatedEmbed = createGiveawayEmbed({
          prize: giveaway.prize,
          winnersCount: giveaway.winnersCount,
          duration: giveaway.duration,
          participantsCount: giveaway.participants.size
        });

        await interaction.message.edit({
          embeds: [updatedEmbed]
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