const {ActionRowBuilder, ButtonBuilder} = require("discord.js")
module.exports = {
	async GenMessageButton(buttonname, style, customid, Bt2, disabledflag) {
		return new Promise(async (resolve, reject) => {
			if(!disabledflag) disabledflag = false;
			if(Bt2 == null | !Bt2) {
				const Bt = new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(customid)
							.setStyle(style)
							.setLabel(buttonname)
							.setDisabled(disabledflag)
					)
				resolve(Bt)
			} else {
				Bt2.addComponents(
					new ButtonBuilder()
						.setCustomId(customid)
						.setStyle(style)
						.setLabel(buttonname)
						.setDisabled(disabledflag)
				)
				resolve(Bt2)
			}
		})
	},
	async awaitInteractionResp(interaction, filter, type) {
		return new Promise(async (resolve, reject) => {
			const msg = await interaction.fetchReply()
			await msg.awaitMessageComponent({filter, componentType: type, time: 20000})
				.then(interaction => {
					resolve(interaction)
				})
				.catch(err => {
					resolve(null)
				})
		})
	}
}
