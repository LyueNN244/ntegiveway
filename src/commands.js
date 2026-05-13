const { SlashCommandBuilder } = require('discord.js');

const commands = [

new SlashCommandBuilder()
.setName('cekilis-baslat')
.setDescription('Yeni çekiliş başlatır')
.addStringOption(option =>
option.setName('ödül')
.setDescription('Çekiliş ödülü')
.setRequired(true))
.addIntegerOption(option =>
option.setName('kazanan')
.setDescription('Kazanan sayısı')
.setRequired(true))
.addIntegerOption(option =>
option.setName('dakika')
.setDescription('Kaç dakika sürecek')
.setRequired(true))

].map(command => command.toJSON());

module.exports = commands;