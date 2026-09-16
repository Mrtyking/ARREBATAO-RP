const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
} = require('discord.js');
const { clientConfig, categories } = require('../config/config');
const { getTicketPermissions } = require('../utils/permissions');
const {
    createTicketWelcomeEmbed,
    createTicketWelcomeContainer,
    createTicketActionButtons,
} = require('../utils/embedBuilder');

/**
 * Busca los tickets activos de un usuario en el servidor
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 * @returns {Array<import('discord.js').GuildTextBasedChannel>}
 */
function getUserActiveTickets(guild, userId) {
    const allPrefixes = Object.values(categories).map(c => c.ticketPrefix.toLowerCase());

    return guild.channels.cache.filter(channel => {
        if (!channel.isTextBased() || channel.isThread()) return false;

        // Comprobar si el nombre del canal inicia con algún prefijo de ticket
        const hasPrefix = allPrefixes.some(prefix =>
            channel.name.toLowerCase().startsWith(`${prefix}-`)
        );
        if (!hasPrefix) return false;

        // Comprobar si el usuario tiene permiso explícito o si está en el topic
        const userOverwrite = channel.permissionOverwrites?.cache?.get(userId);
        const hasPermission = userOverwrite && userOverwrite.allow.has(PermissionFlagsBits.ViewChannel);
        const inTopic = channel.topic?.includes(userId);

        return Boolean(hasPermission || inTopic);
    });
}

/**
 * Maneja el disparador de apertura de ticket (botón o select menu)
 * Verifica límites y muestra el modal con las preguntas de la categoría
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {string} categoryId - Identificador de la categoría (ej: 'soporte', 'reportes')
 */
async function handleTicketOpenTrigger(interaction, categoryId) {
    try {
        const categoryConfig = categories[categoryId];
        if (!categoryConfig) {
            return interaction.reply({
                content: 'Categoría de ticket no válida.',
                ephemeral: true,
            });
        }

        // 1. Verificación de límites de tickets activos del usuario
        const userTickets = getUserActiveTickets(interaction.guild, interaction.user.id);

        // Límite total de tickets por usuario (máx 2)
        if (userTickets.size >= clientConfig.maxTicketsPerUser) {
            const ticketLinks = userTickets.map(c => `<#${c.id}>`).join(', ');
            return interaction.reply({
                content:
                    `**Has alcanzado el límite máximo de tickets activos (${clientConfig.maxTicketsPerUser}).**\n` +
                    `Actualmente tienes abiertos: ${ticketLinks}.\n` +
                    'Por favor, concluye tus solicitudes actuales antes de abrir un nuevo ticket.',
                ephemeral: true,
            });
        }

        // Límite por categoría (máx 1)
        const categoryTickets = userTickets.filter(channel =>
            channel.name.toLowerCase().startsWith(`${categoryConfig.ticketPrefix.toLowerCase()}-`) ||
            channel.parentId === categoryConfig.categoryId
        );

        if (categoryTickets.size >= clientConfig.maxTicketsPerCategory) {
            const existingTicket = categoryTickets.first();
            return interaction.reply({
                content:
                    `**Ya posees un ticket abierto en ${categoryConfig.name} (<#${existingTicket.id}>).**\n` +
                    'Por favor utiliza dicho canal para continuar con tu consulta o solicitud.',
                ephemeral: true,
            });
        }

        // 2. Construcción del Modal de la categoría
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${categoryId}`)
            .setTitle(categoryConfig.modalTitle.slice(0, 45));

        const formRows = (categoryConfig.modalFields || []).slice(0, 5).map(field => {
            const input = new TextInputBuilder()
                .setCustomId(field.id)
                .setLabel(field.label.slice(0, 45))
                .setStyle(field.style)
                .setRequired(false) // Quita el asterisco (*) que Discord añade automáticamente
                .setMaxLength(field.maxLength || 1000);

            if (field.placeholder) {
                input.setPlaceholder(field.placeholder.slice(0, 100));
            }

            return new ActionRowBuilder().addComponents(input);
        });

        modal.addComponents(formRows);

        // Desplegar el modal al usuario
        await interaction.showModal(modal);
    } catch (error) {
        console.error(`Error al abrir modal para categoría ${categoryId}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al preparar el formulario: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

/**
 * Maneja el envío del formulario del modal y crea el canal seguro de ticket
 *
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleTicketModalSubmit(interaction) {
    try {
        const categoryId = interaction.customId.replace('ticket_modal_', '');
        const categoryConfig = categories[categoryId];

        if (!categoryConfig) {
            return interaction.reply({
                content: 'Configuración de categoría no encontrada.',
                ephemeral: true,
            });
        }

        // Defer reply para evitar timeouts durante la creación del canal
        await interaction.deferReply({ ephemeral: true });

        // 1. Extraer los datos ingresados en el formulario
        const fieldsData = (categoryConfig.modalFields || []).map(field => {
            let userVal = '';
            try {
                userVal = interaction.fields.getTextInputValue(field.id);
            } catch {
                userVal = '';
            }
            return {
                id: field.id,
                label: field.label,
                value: userVal && userVal.trim() ? userVal.trim() : 'No especificado',
            };
        });

        // 2. Calcular los permisos dinámicos del canal
        const permissionOverwrites = getTicketPermissions(
            interaction.guild,
            interaction.user,
            categoryConfig
        );

        // 3. Normalizar el nombre del canal
        const cleanUsername = interaction.user.username
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 15) || 'ticket';
        const channelName = `${categoryConfig.ticketPrefix}-${cleanUsername}`;

        // 4. Obtener la categoría padre en Discord si existe
        let parentCategory = null;
        if (categoryConfig.categoryId) {
            parentCategory = interaction.guild.channels.cache.get(categoryConfig.categoryId) || null;
        }

        // 5. Crear el canal de texto del ticket
        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parentCategory ? parentCategory.id : null,
            topic: `Ticket: ${categoryConfig.name} | Creador: ${interaction.user.tag} (${interaction.user.id}) | Categoría: ${categoryConfig.id}`,
            permissionOverwrites: permissionOverwrites,
            reason: `Ticket de ${categoryConfig.name} abierto por ${interaction.user.tag}`,
        });

        // 6. Preparar menciones y mensaje de bienvenida V2
        const staffMentions = Array.isArray(categoryConfig.staffRoles) && categoryConfig.staffRoles.length > 0
            ? categoryConfig.staffRoles.map(roleId => `<@&${roleId}>`).join(' ')
            : '';
        const userMention = `<@${interaction.user.id}>`;

        // Notificación de mención para alertar al usuario y staff
        await ticketChannel.send({
            content: `${userMention} ${staffMentions}`.trim(),
        });

        // Contenedor Components V2 con formulario y botones integrados dentro del embed
        const welcomeContainer = createTicketWelcomeContainer(interaction.user, categoryConfig, fieldsData);
        await ticketChannel.send({
            components: [welcomeContainer],
            flags: MessageFlags.IsComponentsV2,
        });

        // 7. Enviar registro al canal de logs si está configurado
        if (clientConfig.logsChannelId) {
            const logsChannel = interaction.guild.channels.cache.get(clientConfig.logsChannelId);
            if (logsChannel && logsChannel.isTextBased()) {
                const categoryDisplay = categoryConfig.emoji
                    ? `${categoryConfig.emoji} ${categoryConfig.name}`
                    : categoryConfig.name;

                const logEmbed = new EmbedBuilder()
                    .setColor(clientConfig.embedColor)
                    .setTitle('Nuevo Ticket Creado')
                    .addFields(
                        { name: 'Canal', value: `${ticketChannel} (\`${ticketChannel.name}\`)`, inline: true },
                        { name: 'Usuario', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                        { name: 'Categoría', value: categoryDisplay, inline: true },
                        { name: 'Fecha y Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: clientConfig.footerText })
                    .setTimestamp();

                await logsChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        // 8. Confirmar creación al usuario
        await interaction.editReply({
            content: `Tu ticket de **${categoryConfig.name}** ha sido creado exitosamente en ${ticketChannel}. Por favor dirígete allí.`,
        });
    } catch (error) {
        console.error('Error al procesar envío de modal de ticket:', error);
        const errorMessage = `Ocurrió un error al crear tu ticket: ${error.message}`;
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: errorMessage,
            });
        } else {
            await interaction.reply({
                content: errorMessage,
                ephemeral: true,
            });
        }
    }
}

module.exports = {
    getUserActiveTickets,
    handleTicketOpenTrigger,
    handleTicketModalSubmit,
};
