const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");

function GenMessageButton(label, style, customId, disabled = false) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setStyle(style)
        .setLabel(label)
        .setDisabled(disabled);
}

function createButtonRow(buttons) {
    return new ActionRowBuilder().addComponents(buttons);
}

async function awaitInteraction(interaction, filter, time = 20000) {
    try {
        const msg = await interaction.fetchReply();
        return await msg.awaitMessageComponent({ filter, time });
    } catch (err) {
        return null;
    }
}

async function awaitModal(interaction, filter, time = 30000) {
    try {
        return await interaction.awaitModalSubmit({ filter, time });
    } catch (err) {
        return null;
    }
}

function genEmbedArray(textarray, title, itemsPerPage = 10) {
    const embeds = [];
    let overallCount = 0;

    for (let i = 0; i < textarray.length; i += itemsPerPage) {
        const chunk = textarray.slice(i, i + itemsPerPage);
        const description = chunk.map((text) => {
            overallCount++;
            return `${overallCount}. ${text}`;
        }).join('\n');

        const page = Math.floor(i / itemsPerPage) + 1;
        const totalPages = Math.ceil(textarray.length / itemsPerPage);

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: `Page: ${page}/${totalPages}` });
        
        embeds.push(embed);
    }

    return embeds;
}

async function awaitMsgResponse(channel, filter) {
	return new Promise(async (resolve, reject) => {
		channel.awaitMessages({ filter, max: 1, time: 1000, errors: ['time'] }).then(async collected => {
			const content = collected.first().content;
			resolve(content)
		}).catch(collected => {
			resolve(null)
		})
	})
}

module.exports = {
    GenMessageButton,
    createButtonRow,
    awaitInteraction,
    awaitModal,
    genEmbedArray,
    awaitMsgResponse,
};
