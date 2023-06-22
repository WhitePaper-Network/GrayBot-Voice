const utils = require("./utils.js");
const { ButtonStyle, EmbedBuilder } = require("discord.js")
const sqlite3 = require("sqlite3")


module.exports = {
	async changeSettings(interaction, readData) {
		let embed = new EmbedBuilder()
			.setTitle("設定画面")
			.setDescription("📙 辞書関連\n⚙ ユーザー設定\n\n変更する設定を選択してください")

        let button = await utils.GenMessageButton("📙", ButtonStyle.Primary, "dict")
        button = await utils.GenMessageButton("⚙", ButtonStyle.Primary, "settings", button)

		await interaction.reply({embeds: [embed], components: [button]})

        let message = await interaction.fetchReply()
        let filter = i => {
            return i.user.id === interaction.user.id && i.message.id === message.id;
        };

        let ret = await utils.awaitInteractionResp(interaction, filter)
        ret.deferUpdate();
        if(ret.customId == "dict") return dictConfig(interaction)
	}
}

async function dictConfig(interaction) {

    let embed = new EmbedBuilder()
        .setTitle("📙 辞書設定")
        .setDescription(":page_with_curl: 辞書内容表示\n➕辞書に追加\n➖辞書から削除")

    let button = await utils.GenMessageButton("📃", ButtonStyle.Primary, "show")
    button = await utils.GenMessageButton("➕", ButtonStyle.Primary, "add", button)
    button = await utils.GenMessageButton("➖", ButtonStyle.Danger, "delete", button)

    await interaction.editReply({embeds: [embed], components: [button]})

    let message = await interaction.fetchReply()
    let filter = i => {
        return i.user.id === interaction.user.id && i.message.id === message.id;
    };

    let ret = await utils.awaitInteractionResp(interaction, filter)

    ret.deferUpdate();

    if(ret.customId == "show") {
        const dict = new sqlite3.Database("./data.db");
        const selectdict = 'select * from dict;'
        await dict.all(selectdict, async (err, rows) => {
            if (err) {
                throw err;
            }
            await dict.close();

            let textarray = new Array();

            for (let i = 0; i < rows.length; i++) {
                if(serverId === rows[i].serverId) {
                    textarray.push(`${rows[i].textfrom} → ${rows[i].textto}`)
                }
            };

            if(!textarray[0]) {
                embed = new EmbedBuilder()
                    .setTitle("📙 辞書表示")
                    .setDescription("表示する内容がありません")
                return interaction.editReply({embeds: [embed], components: []})
            }

            let embeds = await genEmbedArray(textarray, "辞書表示")

            let button = await utils.GenMessageButton("←", ButtonStyle.Primary, "left", null, true)
            await utils.GenMessageButton("⏹", ButtonStyle.Danger, "stop", button)
            let flag = false;
            if(!embeds[1]) flag = true
            await utils.GenMessageButton("→", ButtonStyle.Primary, "right", button, flag)

            await interaction.editReply({embeds: [embeds[0]], components: [button]})

            let page = 1;
            let i = 0;
            while(true) {
                ret = await utils.awaitInteractionResp(interaction, filter, ComponentType.Button)
                if(ret == null) {
                    i++;
                    if(i == 3) {
                        interaction.editReply({embeds: [embeds[page-1]], components: []});
                        break;
                    }
                } else {
                    if(ret.customId == "left") {
                        ret.deferUpdate();
                        if(page == 1) continue;
                        page--;
                        let leftDisabled = false;
                        let rightDisabled = false;
                        if(!embeds[page-2]) leftDisabled = true;
                        if(!embeds[page]) rightDisabled = true;

                        button = await utils.GenMessageButton("←", ButtonStyle.Primary, "left", null, leftDisabled)
                        await utils.GenMessageButton("⏹", ButtonStyle.Danger, "stop", button)
                        await utils.GenMessageButton("→", ButtonStyle.Primary, "right", button, rightDisabled)

                        interaction.editReply({embeds: [embeds[page-1]], components:[button]})
                    }

                    if(ret.customId == "right") {
                        ret.deferUpdate();
                        if(embeds[page]) {

                            page++;
                            let leftDisabled = false;
                            let rightDisabled = false;

                            if(!embeds[page-2]) leftDisabled = true;
                            if(!embeds[page]) rightDisabled = true;

                            button = await utils.GenMessageButton("←", ButtonStyle.Primary, "left", null, leftDisabled)
                            await utils.GenMessageButton("⏹", ButtonStyle.Danger, "stop", button)
                            await utils.GenMessageButton("→", ButtonStyle.Primary, "right", button, rightDisabled)

                            interaction.editReply({embeds: [embeds[page-1]], components:[button]})
                        } else continue;
                    }

                    if(ret.customId == "stop" ) {
                        interaction.editReply({embeds: [embeds[page-1]], components: []});
                        break;
                    }
                }
            }
        });

        return;
    }
}

async function genEmbedArray(textarray, modetext) {
    let embeds = new Array()
    let embcount = 0;
    let addcount = 0;
    let desc = "";
    for(const text of textarray) {
        if(!embeds[embcount]) {
            embeds[embcount] = new EmbedBuilder()
            embeds[embcount].setTitle("📙 辞書表示")
        }
        addcount++;

        desc = desc + `${addcount}. ${text}\n`

        if((addcount % 10) == 0 ) {
            embeds[embcount].setDescription(desc)
            embcount++;
            desc = ""
        }
    }
    embcount = 1;
    for(const embed of embeds) {
        embed.setFooter({text: `Page: ${embcount}/${embeds.length} | Mode: ${modetext}`})
        embcount++;
    }

    return embeds;

}
