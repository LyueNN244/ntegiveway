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
  Events,
} = require('discord.js');

const commands = require('./commands');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const giveaways = new Map();

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

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

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'cekilis-baslat') {
        const prize = interaction.options.getString('ödül');
        const winnersCount = interaction.options.getInteger('kazanan');
        const minutes = interaction.options.getInteger('dakika');

        const embed = new EmbedBuilder()
          .setTitle('🎉 Yeni Çekiliş Başladı!')
          .setDescription(
            `🎁 **Ödül:** ${prize}\n\n` +
            `👑 **Kazanan Sayısı:** ${winnersCount}\n\n` +
            `⏳ **Süre:** ${minutes} dakika\n\n` +
            `Katılmak için aşağıdaki butona bas!`
          )
          .setColor('Purple')
          .setFooter({ text: 'NTE Türkiye Giveaway' })
          .setTimestamp();

        const button = new ButtonBuilder()
          .setCustomId('join_giveaway')
          .setLabel('Katıl 🎉')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        const message = await interaction.reply({
          embeds: [embed],
          components: [row],
          fetchReply: true,
        });

        giveaways.set(message.id, {
          prize,
          winnersCount,
          participants: new Set(),
          channelId: interaction.channelId,
        });

        setTimeout(async () => {
          const giveaway = giveaways.get(message.id);
          if (!giveaway) return;

          const channel = await client.channels.fetch(giveaway.channelId);
          const participants = Array.from(giveaway.participants);

          if (participants.length === 0) {
            await channel.send(`❌ **${giveaway.prize}** çekilişine kimse katılmadı.`);
            giveaways.delete(message.id);
            return;
          }

          const shuffled = participants.sort(() => Math.random() - 0.5);
          const winners = shuffled.slice(0, giveaway.winnersCount);

          await channel.send(
            `🎉 **Çekiliş Bitti!**\n\n` +
            `🎁 Ödül: **${giveaway.prize}**\n` +
            `👑 Kazananlar: ${winners.map(id => `<@${id}>`).join(', ')}`
          );

          giveaways.delete(message.id);
        }, minutes * 60 * 1000);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'join_giveaway') {
        const giveaway = giveaways.get(interaction.message.id);

        if (!giveaway) {
          return interaction.reply({
            content: '❌ Bu çekiliş sona ermiş.',
            ephemeral: true,
          });
        }

        if (giveaway.participants.has(interaction.user.id)) {
          return interaction.reply({
            content: '❌ Zaten bu çekilişe katıldın.',
            ephemeral: true,
          });
        }

        giveaway.participants.add(interaction.user.id);

        return interaction.reply({
          content: '🎉 Çekilişe başarıyla katıldın!',
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    console.error('Interaction hatası:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true,
      });
    }
  }
});

deployCommands();
client.login(process.env.TOKEN);