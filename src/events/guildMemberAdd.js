const { Events } = require('discord.js');
const { sendWelcomeNotification } = require('../utils/welcomeBoost');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        // Ignorar bots
        if (member.user.bot) return;

        await sendWelcomeNotification(member);
    },
};
