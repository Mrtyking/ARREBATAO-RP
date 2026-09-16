const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendBoostNotification } = require('../utils/welcomeBoost');
const { clientConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-boost')
        .setDescription('Simula y envía la alerta oficial de Nitro Boost con embed e imagen')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario para simular el boost (opcional)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('usuario') || interaction.user;
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => interaction.member);

            await sendBoostNotification(targetMember);

            await interaction.editReply({
                content: `Mensaje de boost simulado exitosamente en <#${clientConfig.boostChannelId}> para <@${targetMember.id}>.`,
            });
        } catch (error) {
            console.error('Error al ejecutar /test-boost:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: `Error al probar boost: ${error.message}`,
                });
            } else {
                await interaction.reply({
                    content: `Error al probar boost: ${error.message}`,
                    ephemeral: true,
                });
            }
        }
    },
};
