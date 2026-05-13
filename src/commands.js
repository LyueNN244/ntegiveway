const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('cekilis-baslat')
    .setDescription('Yeni çekiliş başlatır')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('ödül')
        .setDescription('Çekiliş ödülü')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('süre')
        .setDescription('Örnek: 10m, 2h, 1d')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('kazanan')
        .setDescription('Kazanan sayısı')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cekilis-iptal')
    .setDescription('Aktif çekilişi iptal eder')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('mesaj_id')
        .setDescription('Çekiliş mesaj ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cekilis-yeniden-cek')
    .setDescription('Çekiliş için yeniden kazanan seçer')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option
        .setName('mesaj_id')
        .setDescription('Çekiliş mesaj ID')
        .setRequired(true)
    )
].map(command => command.toJSON());

module.exports = commands;