const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { clientConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Muestra la latencia del bot y del WebSocket de Discord.'),

    async execute(interaction) {
        try {
            const sent = await interaction.deferReply({ fetchReply: true, ephemeral: false });
            const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
            const wsLatency = interaction.client.ws.ping;

            const pingEmbed = new EmbedBuilder()
                .setColor(clientConfig.embedColor)
                .setTitle('Pong - Estado de Latencia')
                .addFields(
                    {
                        name: 'Latencia de WebSocket',
                        value: `\`${wsLatency >= 0 ? wsLatency : 0} ms\``,
                        inline: true,
                    },
                    {
                        name: 'Tiempo de Respuesta',
                        value: `\`${roundtrip} ms\``,
                        inline: true,
                    }
                )
                .setFooter({ text: 'ARREBATAO RP - Estado del Sistema' })
                .setTimestamp();

            await interaction.editReply({ embeds: [pingEmbed] });
        } catch (error) {
            console.error('Error al ejecutar /ping:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Error al calcular el ping.' });
            } else {
                await interaction.reply({ content: 'Error al calcular el ping.', ephemeral: true });
            }
        }
    },
};
