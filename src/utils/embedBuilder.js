const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SectionBuilder,
    ThumbnailBuilder,
} = require('discord.js');
const { clientConfig, categories } = require('../config/config');

/**
 * Construye el contenedor Components V2 para el panel principal de tickets
 * @returns {ContainerBuilder}
 */
function createTicketContainer() {
    const quickButtonDefs = [
        { id: 'soporte', label: 'Soporte' },
        { id: 'reportes', label: 'Reportes' },
        { id: 'donaciones', label: 'Donaciones' },
        { id: 'reclamos', label: 'Reclamos' },
    ];

    // 4 botones rápidos dentro del contenedor
    const quickButtonsRow = new ActionRowBuilder();
    for (const item of quickButtonDefs) {
        const cat = categories[item.id];
        const btn = new ButtonBuilder()
            .setCustomId(`ticket_btn_open_${item.id}`)
            .setLabel(item.label)
            .setStyle(ButtonStyle.Secondary);

        if (cat?.emoji) {
            btn.setEmoji(cat.emoji);
        }
        quickButtonsRow.addComponents(btn);
    }

    // Menú de selección con las 11 categorías
    const selectMenuOptions = Object.values(categories).map(cat => {
        const option = {
            label: cat.name,
            value: cat.id,
            description: cat.description.length > 95 ? `${cat.description.slice(0, 92)}...` : cat.description,
        };
        if (cat.emoji) {
            option.emoji = cat.emoji;
        }
        return option;
    });

    const selectMenuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_select_category')
            .setPlaceholder('Selecciona una opción...')
            .addOptions(selectMenuOptions)
    );

    const container = new ContainerBuilder()
        .setAccentColor(0x990000)
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://banner.jpg')
            )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '> Haz clic en cualquier opción abajo para crear un ticket en **ARREBATAO RP**.\n\n' +
                '**¿Cómo funciona?**\n' +
                '**1.** Elige la opción que coincida con tu necesidad en el menú o botones.\n' +
                '**2.** Completa los datos requeridos en el formulario.\n' +
                '**3.** Envía tu ticket y continúa el proceso con nuestro equipo.'
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '**Soporte:** Dudas técnicas, problemas o atención al cliente.\n' +
                '**Reportes:** Reporte de usuarios por infringir normativas.\n' +
                '**Apelación:** Apelación de sanciones o baneos.\n' +
                '**Donaciones:** Compras, donaciones o información de la tienda.\n' +
                '**Organizaciones:** Creación o gestión de facciones y organizaciones.\n' +
                '**Reclamos:** Reclamos sobre compras de la tienda y rangos.\n' +
                '**Ck - Pkt:** Solicitud o reporte de muerte permanente.\n' +
                '**Reportar Staff:** Reportes que debe revisar la directiva sobre el staff.\n' +
                '**Streamer:** Solicitud del rol y beneficios de creador de contenido.\n' +
                '**Negocios:** Propuestas de negocios dentro del roleplay.\n' +
                '**Postulaciones:** Postulación para el equipo de staff.'
            )
        )
        .addActionRowComponents(quickButtonsRow)
        .addActionRowComponents(selectMenuRow)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '© ARREBATAO RP - Todos los derechos reservados.'
            )
        );

    return container;
}

/**
 * Construye el embed alternativo / clásico del panel de tickets (sin emojis)
 * @returns {EmbedBuilder}
 */
function createTicketPanelEmbed() {
    return new EmbedBuilder()
        .setColor(clientConfig.embedColor)
        .setTitle('ARREBATAO RP - Sistema de Tickets')
        .setDescription(
            '> Haz clic en cualquier opción abajo para crear un ticket en **ARREBATAO RP**.\n\n' +
            '**¿Cómo funciona?**\n' +
            '**1.** Elige la opción que coincida con tu necesidad en el menú o botones.\n' +
            '**2.** Completa los datos requeridos en el formulario.\n' +
            '**3.** Envía tu ticket y continúa el proceso con nuestro equipo.'
        )
        .setImage('attachment://banner.jpg')
        .setFooter({
            text: clientConfig.footerText,
        })
        .setTimestamp();
}

/**
 * Construye los componentes interactivos clásicos del panel de tickets (sin emojis)
 * @returns {Array<ActionRowBuilder>}
 */
function createTicketComponents() {
    const quickButtonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_btn_open_soporte')
            .setLabel('Soporte')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ticket_btn_open_reportes')
            .setLabel('Reportes')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ticket_btn_open_donaciones')
            .setLabel('Donaciones')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('ticket_btn_open_reclamos')
            .setLabel('Reclamos')
            .setStyle(ButtonStyle.Secondary)
    );

    const selectMenuOptions = Object.values(categories).map(cat => {
        const option = {
            label: cat.name,
            value: cat.id,
            description: cat.description.length > 95 ? `${cat.description.slice(0, 92)}...` : cat.description,
        };
        if (cat.emoji) {
            option.emoji = cat.emoji;
        }
        return option;
    });

    const selectMenuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_select_category')
            .setPlaceholder('Selecciona una opción...')
            .addOptions(selectMenuOptions)
    );

    return [quickButtonsRow, selectMenuRow];
}

/**
 * Construye el embed de bienvenida dentro del canal de ticket recién creado
 * @param {import('discord.js').User} user - Usuario creador del ticket
 * @param {object} categoryConfig - Configuración de la categoría
 * @param {Array<{label: string, value: string}>} fieldsData - Respuestas del modal
 * @returns {EmbedBuilder}
 */
function createTicketWelcomeEmbed(user, categoryConfig, fieldsData = []) {
    const categoryDisplay = categoryConfig.emoji
        ? `${categoryConfig.emoji} ${categoryConfig.name}`
        : categoryConfig.name;

    const embed = new EmbedBuilder()
        .setColor(clientConfig.embedColor)
        .setTitle('ARREBATAO RP - Panel de Control del Ticket')
        .setDescription(
            `Hola <@${user.id}>, gracias por comunicarte con el equipo de **ARREBATAO RP**.\n` +
            'Un miembro del Staff te atenderá a la brevedad posible. Por favor, mantén la paciencia y sé respetuoso.\n\n' +
            '**Información proporcionada en el formulario:**'
        )
        .setThumbnail(user.displayAvatarURL({ forceStatic: false }))
        .addFields(
            { name: 'Usuario', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
            { name: 'Categoría', value: categoryDisplay, inline: true },
            { name: 'Creado', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        );

    // Agregar campos del formulario enviados por el usuario
    if (Array.isArray(fieldsData) && fieldsData.length > 0) {
        for (const field of fieldsData) {
            const rawVal = field.value && field.value.trim() ? field.value : 'No especificado';
            const formattedVal = rawVal.length > 1024 ? `${rawVal.slice(0, 1020)}...` : rawVal;
            embed.addFields({
                name: `${field.label}`,
                value: formattedVal,
                inline: false,
            });
        }
    }

    embed
        .setFooter({
            text: `ARREBATAO RP - Sistema de Tickets | ID Usuario: ${user.id}`,
        })
        .setTimestamp();

    return embed;
}

/**
 * Construye la botonera de control dentro del ticket (sin emojis)
 * @param {object} options - Opciones de estado (ej: claimed, claimedBy)
 * @returns {ActionRowBuilder}
 */
function createTicketActionButtons(options = {}) {
    const claimButton = new ButtonBuilder()
        .setCustomId('ticket_control_claim')
        .setStyle(options.claimed ? ButtonStyle.Secondary : ButtonStyle.Success);

    if (options.claimed) {
        claimButton
            .setLabel(options.claimedBy ? `Reclamado por ${options.claimedBy}` : 'Ticket Reclamado')
            .setDisabled(true);
    } else {
        claimButton.setLabel('Reclamar Ticket');
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ticket_control_close')
            .setLabel('Cerrar Ticket')
            .setStyle(ButtonStyle.Danger),
        claimButton,
        new ButtonBuilder()
            .setCustomId('ticket_control_notify')
            .setLabel('Notificar Staff')
            .setStyle(ButtonStyle.Secondary)
    );
}

/**
 * Construye el contenedor Components V2 de bienvenida con formulario y botones integrados
 * @param {import('discord.js').User} user
 * @param {object} categoryConfig
 * @param {Array<{label: string, value: string}>} fieldsData
 * @param {object} options
 * @returns {ContainerBuilder}
 */
function createTicketWelcomeContainer(user, categoryConfig, fieldsData = [], options = {}) {
    const actionButtonsRow = createTicketActionButtons(options);

    let formContent = '';
    if (Array.isArray(fieldsData) && fieldsData.length > 0) {
        for (const field of fieldsData) {
            const rawVal = field.value && field.value.trim() ? field.value : 'No especificado';
            const formattedVal = rawVal.length > 500 ? `${rawVal.slice(0, 497)}...` : rawVal;
            formContent += `**${field.label}:**\n${formattedVal}\n\n`;
        }
    } else {
        formContent = 'Sin información adicional registrada.';
    }

    const container = new ContainerBuilder()
        .setAccentColor(0x990000)
        .addSectionComponents(
            new SectionBuilder()
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(user.displayAvatarURL({ extension: 'png', forceStatic: false }))
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        '### ARREBATAO RP - Panel de Control del Ticket\n' +
                        `Hola <@${user.id}>, gracias por comunicarte con el equipo de **ARREBATAO RP**.\n` +
                        'Un miembro del Staff te atenderá a la brevedad posible. Por favor, mantén la paciencia y sé respetuoso.'
                    )
                )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Usuario:** <@${user.id}> (\`${user.id}\`)\n` +
                `**Categoría:** ${categoryConfig.name}\n` +
                `**Creado:** <t:${Math.floor(Date.now() / 1000)}:R>`
            )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '**Información proporcionada en el formulario:**\n\n' + formContent.trim()
            )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                categoryConfig.id === 'reclamos' || categoryConfig.id === 'donaciones'
                    ? '> **Comprobante de compra:** Si tienes capturas o fotos de tu recibo, adjúntalas directamente aquí en este chat.'
                    : '> **Pruebas o capturas:** Si tienes fotos, capturas o grabaciones, puedes adjuntarlas directamente aquí en este chat.'
            )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addActionRowComponents(actionButtonsRow)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `ARREBATAO RP - Sistema de Tickets | ID Usuario: ${user.id}`
            )
        );

    return container;
}

module.exports = {
    createTicketContainer,
    createTicketPanelEmbed,
    createTicketComponents,
    createTicketWelcomeEmbed,
    createTicketWelcomeContainer,
    createTicketActionButtons,
};

