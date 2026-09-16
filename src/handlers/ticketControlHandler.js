const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    OverwriteType,
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const { clientConfig, categories } = require('../config/config');
const { setTicketClaimed, getTicketState } = require('../utils/ticketState');

/**
 * Determina si un miembro tiene rol de staff o permisos de Administrador
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').GuildChannel} channel
 * @returns {boolean}
 */
function isStaffMember(member, channel) {
    if (!member) return false;

    // Administradores siempre tienen acceso
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Recopilar todos los roles de staff configurados en todas las categorías
    const allStaffRoles = new Set();
    for (const cat of Object.values(categories)) {
        if (Array.isArray(cat.staffRoles)) {
            for (const r of cat.staffRoles) {
                allStaffRoles.add(r);
            }
        }
    }

    // Verificar si el usuario posee alguno de los roles de staff
    if (member.roles?.cache) {
        for (const roleId of allStaffRoles) {
            if (member.roles.cache.has(roleId)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Extrae el ID del usuario creador del ticket a partir del topic del canal o sus sobreescrituras
 * @param {import('discord.js').GuildChannel} channel
 * @returns {string|null}
 */
function getTicketCreatorId(channel) {
    if (!channel) return null;

    // 1. Intentar obtenerlo desde el topic del canal
    if (channel.topic) {
        const match = channel.topic.match(/\((\d{17,20})\)/);
        if (match && match[1]) {
            return match[1];
        }
    }

    // 2. Buscar en sobreescrituras de permisos individuales (no rol, no bot)
    const botId = channel.guild.members.me?.id || channel.client.user.id;
    for (const [id, overwrite] of channel.permissionOverwrites.cache) {
        if (overwrite.type === OverwriteType.Member && id !== botId) {
            return id;
        }
    }

    return null;
}

/**
 * Abre el modal de motivo al presionar el botón de cerrar ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleCloseTicket(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('modal_close_ticket_reason')
            .setTitle('Cierre de Ticket');

        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Motivo del cierre')
            .setPlaceholder('Ej: Caso resuelto / Inactividad / Reporte completado')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error al abrir modal de cierre:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al preparar el cierre: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

/**
 * Procesa el cierre definitivo del ticket tras enviar el motivo en el modal:
 * Genera transcripción HTML, envía copia a logs y MD, y elimina el canal con cuenta regresiva
 *
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleCloseTicketSubmit(interaction) {
    try {
        const reason = interaction.fields.getTextInputValue('close_reason')?.trim() || 'Sin motivo especificado';
        const channel = interaction.channel;
        const creatorId = getTicketCreatorId(channel);

        // Confirmar modal inmediatamente para evitar expiración
        await interaction.reply({
            content: '**Procesando cierre de ticket...** Generando transcripción y archivando.',
            ephemeral: true,
        });

        // Notificación visible en el canal
        const closingEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Ticket Cerrado')
            .setDescription(
                `Este ticket ha sido cerrado por **${interaction.user.tag}**.\n` +
                `**Motivo:** ${reason}\n\n` +
                '*El canal se eliminará definitivamente en 5 segundos...*'
            )
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        await channel.send({ embeds: [closingEmbed] });

        // Generar transcripción HTML completa
        let transcriptAttachment = null;
        try {
            transcriptAttachment = await discordTranscripts.createTranscript(channel, {
                limit: -1,
                returnType: 'attachment',
                fileName: `transcript-${channel.name}.html`,
                minify: true,
                saveImages: true,
                poweredBy: false,
            });
        } catch (transcriptError) {
            console.error('Error al generar transcripción HTML:', transcriptError);
        }

        // Enviar al canal de logs si está configurado
        if (clientConfig.logsChannelId && transcriptAttachment) {
            const logsChannel = interaction.guild.channels.cache.get(clientConfig.logsChannelId);
            if (logsChannel && logsChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(clientConfig.embedColor)
                    .setTitle('Ticket Cerrado - Transcripción Archivada')
                    .addFields(
                        { name: 'Canal / Ticket', value: `\`${channel.name}\``, inline: true },
                        { name: 'Cerrado por', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                        { name: 'Creador', value: creatorId ? `<@${creatorId}> (\`${creatorId}\`)` : '*Desconocido*', inline: true },
                        { name: 'Motivo de Cierre', value: reason, inline: false },
                        { name: 'Fecha y Hora', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: clientConfig.footerText })
                    .setTimestamp();

                await logsChannel.send({
                    embeds: [logEmbed],
                    files: [transcriptAttachment],
                }).catch(err => console.error('Error al enviar log de cierre:', err));
            }
        }

        // Intentar enviar transcripción por mensaje directo (DM) al usuario creador
        if (creatorId && transcriptAttachment) {
            try {
                const creatorUser = await interaction.client.users.fetch(creatorId);
                if (creatorUser) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(clientConfig.embedColor)
                        .setTitle('Tu ticket en ARREBATAO RP ha sido cerrado')
                        .setDescription(
                            `Hola <@${creatorId}>, tu ticket **#${channel.name}** ha finalizado.\n\n` +
                            `• **Cerrado por:** ${interaction.user.tag}\n` +
                            `• **Motivo:** ${reason}\n\n` +
                            'Adjunto a este mensaje encontrarás la **transcripción completa en formato HTML** con todos los mensajes y archivos compartidos.'
                        )
                        .setFooter({ text: clientConfig.footerText })
                        .setTimestamp();

                    await creatorUser.send({
                        embeds: [dmEmbed],
                        files: [transcriptAttachment],
                    });
                }
            } catch (dmErr) {
                console.log(`No se pudo enviar MD al creador (${creatorId}): ${dmErr.message}`);
            }
        }

        // Cuenta regresiva y eliminación segura del canal
        setTimeout(async () => {
            try {
                if (channel.deletable) {
                    await channel.delete(`Ticket cerrado por ${interaction.user.tag}: ${reason}`);
                }
            } catch (delErr) {
                console.error('Error al eliminar canal de ticket:', delErr);
            }
        }, 5000);
    } catch (error) {
        console.error('Error durante el proceso de cierre del ticket:', error);
    }
}

/**
 * Maneja el botón de reclamar ticket
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleClaimTicket(interaction) {
    try {
        // Verificar que quien reclama sea Staff o Admin
        if (!isStaffMember(interaction.member, interaction.channel)) {
            return interaction.reply({
                content: 'Solo los miembros del equipo de Staff autorizados pueden reclamar tickets.',
                ephemeral: true,
            });
        }

        // Verificar si el ticket ya fue reclamado en los componentes del mensaje
        const message = interaction.message;
        let isAlreadyClaimed = false;

        const updatedComponents = message.components.map(topComp => {
            const raw = topComp.toJSON();
            if (raw.type === 17 && Array.isArray(raw.components)) {
                raw.components = raw.components.map(child => {
                    if (child.type === 1 && Array.isArray(child.components)) {
                        child.components = child.components.map(btn => {
                            if (btn.custom_id === 'ticket_control_claim') {
                                if (btn.disabled) isAlreadyClaimed = true;
                                return {
                                    ...btn,
                                    label: `Reclamado por ${interaction.user.username}`,
                                    style: ButtonStyle.Secondary,
                                    disabled: true,
                                };
                            }
                            return btn;
                        });
                    }
                    return child;
                });
            } else if (raw.type === 1 && Array.isArray(raw.components)) {
                raw.components = raw.components.map(btn => {
                    if (btn.custom_id === 'ticket_control_claim') {
                        if (btn.disabled) isAlreadyClaimed = true;
                        return {
                            ...btn,
                            label: `Reclamado por ${interaction.user.username}`,
                            style: ButtonStyle.Secondary,
                            disabled: true,
                        };
                    }
                    return btn;
                });
            }
            return raw;
        });

        if (isAlreadyClaimed) {
            return interaction.reply({
                content: 'Este ticket ya ha sido reclamado previamente por un miembro del Staff.',
                ephemeral: true,
            });
        }

        // Actualizar los botones del mensaje original
        await message.edit({ components: updatedComponents });

        // Registrar reclamo y otorgar permisos de escritura al staff
        await setTicketClaimed(interaction.channel, interaction.user.id);

        // Avisar en el canal mediante un Embed profesional
        const claimEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Ticket Reclamado')
            .setDescription(`<@${interaction.user.id}> se ha hecho cargo de este ticket y te atenderá personalmente a partir de ahora.`)
            .addFields(
                { name: 'Staff Encargado', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                { name: 'Fecha y Hora', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        await interaction.channel.send({ embeds: [claimEmbed] });

        await interaction.reply({
            content: 'Has reclamado este ticket con éxito.',
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error al reclamar ticket:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al reclamar el ticket: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

// Mapa de enfriamiento para evitar spam del botón Notificar Staff (por canal)
const notifyStaffCooldowns = new Map();

/**
 * Maneja el botón de notificar al Staff cuando un usuario requiere atención
 * Envía una alerta con embed y ping de rol al canal de alertas del staff (1530125195694706769)
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleNotifyStaff(interaction) {
    try {
        const channel = interaction.channel;
        const now = Date.now();
        const cooldownTime = 3 * 60 * 1000; // 3 minutos de cooldown por ticket

        const lastNotified = notifyStaffCooldowns.get(channel.id);
        if (lastNotified && (now - lastNotified) < cooldownTime) {
            const remainingSeconds = Math.ceil((cooldownTime - (now - lastNotified)) / 1000);
            return interaction.reply({
                content: `Ya se ha enviado una alerta al Staff recientemente. Por favor espera ${remainingSeconds} segundo(s) antes de volver a notificar.`,
                ephemeral: true,
            });
        }

        // Obtener la categoría del ticket desde el topic del canal
        let categoryName = 'General';
        let staffMentions = '';
        if (channel.topic) {
            const match = channel.topic.match(/Categoría:\s*([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const categoryConfig = categories[match[1]];
                if (categoryConfig) {
                    categoryName = categoryConfig.name;
                    if (Array.isArray(categoryConfig.staffRoles) && categoryConfig.staffRoles.length > 0) {
                        staffMentions = categoryConfig.staffRoles.map(roleId => `<@&${roleId}>`).join(' ');
                    }
                }
            }
        }

        // Obtener el canal de alertas del Staff (1530125195694706769)
        const staffChannelId = clientConfig.staffAlertsChannelId || '1530125195694706769';
        const staffChannel = interaction.guild.channels.cache.get(staffChannelId);

        if (!staffChannel || !staffChannel.isTextBased()) {
            return interaction.reply({
                content: 'El canal de alertas del Staff no está disponible o no se encuentra configurado.',
                ephemeral: true,
            });
        }

        // Embed para el canal de alertas del Staff
        const alertEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Atención Staff Solicitada')
            .setDescription(`El usuario <@${interaction.user.id}> está esperando atención en su ticket.`)
            .addFields(
                { name: 'Ticket', value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true },
                { name: 'Solicitante', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
                { name: 'Categoría', value: categoryName, inline: true },
                { name: 'Hora', value: `<t:${Math.floor(now / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        // Botón de enlace directo para que el Staff vaya al canal del ticket con un clic
        const jumpRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ir al Ticket')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${channel.id}`)
        );

        // Enviar la alerta al canal del staff con mención a los roles encargados
        await staffChannel.send({
            content: staffMentions ? staffMentions : undefined,
            embeds: [alertEmbed],
            components: [jumpRow],
        });

        // Registrar timestamp de cooldown
        notifyStaffCooldowns.set(channel.id, now);

        // Notificación visible en el propio canal del ticket
        const ticketAlertEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Alerta de Staff Enviada')
            .setDescription('Se ha notificado al equipo de Staff sobre este ticket en el canal de guardia. Un miembro te atenderá en cuanto esté disponible.')
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        await channel.send({ embeds: [ticketAlertEmbed] });

        // Confirmar efímeramente al usuario
        await interaction.reply({
            content: 'Se ha notificado al equipo de Staff exitosamente.',
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error al notificar al staff:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `Ocurrió un error al enviar la notificación al Staff: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}

// Mantener compatibilidad de alias
const handleNotifyUser = handleNotifyStaff;

/**
 * Genera una transcripción HTML bajo demanda y la envía al canal y logs
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleGenerateTranscript(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const creatorId = getTicketCreatorId(channel);

        const transcriptAttachment = await discordTranscripts.createTranscript(channel, {
            limit: -1,
            returnType: 'attachment',
            fileName: `transcript-${channel.name}.html`,
            minify: true,
            saveImages: true,
            poweredBy: false,
        });

        const transcriptEmbed = new EmbedBuilder()
            .setColor(clientConfig.embedColor)
            .setTitle('Transcripción del Ticket Generada')
            .setDescription(`Transcripción generada bajo demanda por <@${interaction.user.id}>.`)
            .addFields(
                { name: 'Canal', value: `\`${channel.name}\``, inline: true },
                { name: 'Solicitado por', value: `${interaction.user.tag}`, inline: true },
                { name: 'Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: clientConfig.footerText })
            .setTimestamp();

        // Enviar al canal actual
        await channel.send({
            embeds: [transcriptEmbed],
            files: [transcriptAttachment],
        });

        // Enviar al canal de logs si está disponible
        if (clientConfig.logsChannelId) {
            const logsChannel = interaction.guild.channels.cache.get(clientConfig.logsChannelId);
            if (logsChannel && logsChannel.isTextBased()) {
                await logsChannel.send({
                    embeds: [transcriptEmbed],
                    files: [transcriptAttachment],
                }).catch(() => {});
            }
        }

        await interaction.editReply({
            content: 'Transcripción generada y enviada al canal correctamente.',
        });
    } catch (error) {
        console.error('Error al generar transcripción:', error);
        const errorMessage = `Ocurrió un error al generar la transcripción: ${error.message}`;
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
    isStaffMember,
    getTicketCreatorId,
    handleCloseTicket,
    handleCloseTicketSubmit,
    handleClaimTicket,
    handleNotifyStaff,
    handleNotifyUser,
    handleGenerateTranscript,
};
