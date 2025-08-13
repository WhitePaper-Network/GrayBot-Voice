const { ButtonStyle, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { GenMessageButton, createButtonRow, awaitInteraction, awaitModal, genEmbedArray, awaitMsgResponse } = require("./utils.js");
const { allQuery, runQuery, readData } = require("./dataHandler.js");

module.exports = {
    async changeSettings(interaction) {
        const embed = new EmbedBuilder()
            .setTitle("設定画面")
            .setDescription("📙 辞書関連\n⚙ サーバー/ユーザー設定\n\n変更する設定を選択してください");

        const dictButton = GenMessageButton("📙", ButtonStyle.Primary, "dict");
        const settingsButton = GenMessageButton("⚙", ButtonStyle.Primary, "settings");
        const row = createButtonRow([dictButton, settingsButton]);

        await interaction.reply({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === interaction.user.id;
        const response = await awaitInteraction(interaction, filter);

        if (!response) return;

        await response.deferUpdate();

        if (response.customId === "dict") {
            await dictConfig(interaction);
        }

        if(response.customId === "settings") {
            await execSettings(interaction)
        }
    }
};

async function execSettings(interaction) {
    const serverJson = readData()[interaction.guildId];



    const embed = new EmbedBuilder()
        .setTitle("⚙ サーバー/ユーザー設定")
        .setDescription(`🔈 ユーザーの読み上げ音声を変更\n⏏️ ユーザーの声をランダムにする(現在: ${serverJson.disableRandomize? "無効": "有効"}`)
}

async function dictConfig(interaction) {
    const embed = new EmbedBuilder()
        .setTitle("📙 辞書設定")
        .setDescription(":page_with_curl: 辞書内容表示\n➕辞書に追加\n➖辞書から削除");

    const showButton = GenMessageButton("📃", ButtonStyle.Primary, "show");
    const addButton = GenMessageButton("➕", ButtonStyle.Primary, "add");
    const deleteButton = GenMessageButton("➖", ButtonStyle.Danger, "delete");
    const row = createButtonRow([showButton, addButton, deleteButton]);

    await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === interaction.user.id;
    const response = await awaitInteraction(interaction, filter);

    if (!response) return;

    switch (response.customId) {
        case "show":
            response.deferUpdate();
            await showDict(interaction);
            break;
        case "add":
            await addDict(interaction, response);
            break;
        case "delete":
            response.deferUpdate();
            await deleteDict(interaction, response);
            break;
    }
}

async function showDict(interaction) {
    if(!interaction.replied && !interaction.deferred ) await interaction.deferReply();

    const rows = await allQuery("SELECT textfrom, textto FROM dict WHERE serverId = ?", [interaction.guildId]);

    if (rows.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle("📙 辞書表示")
            .setDescription("表示する内容がありません");
        return interaction.editReply({ embeds: [embed], components: [] });
    }

    const textArray = rows.map(row => `${row.textfrom} → ${row.textto}`);
    const embeds = genEmbedArray(textArray, "辞書表示");

    await pagination(interaction, embeds);
}

async function addDict(interaction, initialResponse) {
    const modal = new ModalBuilder()
        .setCustomId("dictAddModal")
        .setTitle("Add to dict");

    const fromInput = new TextInputBuilder()
        .setCustomId("fromInput")
        .setLabel("word")
        .setStyle(TextInputStyle.Short);

    const toInput = new TextInputBuilder()
        .setCustomId("toInput")
        .setLabel("word reading")
        .setStyle(TextInputStyle.Short);

    modal.addComponents(new ActionRowBuilder().addComponents(fromInput), new ActionRowBuilder().addComponents(toInput));

    await initialResponse.showModal(modal);

    const filter = i => i.user.id === interaction.user.id && i.customId === 'dictAddModal';
    const modalResponse = await awaitModal(interaction, filter);

    if (!modalResponse) {
        const embed = new EmbedBuilder().setTitle("一定時間入力されなかったため、キャンセルしました。");
        return interaction.editReply({ embeds: [embed], components: [] });
    }

    await modalResponse.deferUpdate();

    const from = modalResponse.fields.getTextInputValue("fromInput");
    const to = modalResponse.fields.getTextInputValue("toInput");

    await runQuery("INSERT INTO dict(serverId, textfrom, textto) VALUES(?, ?, ?)", [interaction.guildId, from, to]);

    const embed = new EmbedBuilder()
        .setTitle("追加しました")
        .setDescription(`単語: ${from} \n読み: ${to}`);
        
    await interaction.editReply({ embeds: [embed], components: [] });
}

async function deleteDict(interaction, initialResponse) {
    if(!interaction.replied && !interaction.deferred ) await interaction.deferReply();

    const rows = await allQuery("SELECT textfrom, textto FROM dict WHERE serverId = ?", [interaction.guildId]);

    if (rows.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle("📙 辞書表示(削除モード)")
            .setDescription("削除できる内容がありません");
        return interaction.editReply({ embeds: [embed], components: [] });
    }

    const textArray = rows.map(row => `${row.textfrom} → ${row.textto}`);
    const embeds = genEmbedArray(textArray, "📙 辞書表示(削除モード)");

    let state = {
        deleteMsgAcquired: false,
        paginationStopped: false
    };
    interaction.editReply("削除したい単語を送信してください")

    pagination(interaction, embeds, state);

    const msgFilter = m => m.author.id == interaction.member.user.id;
    const channel = await interaction.client.channels.cache.get(interaction.channelId);

    while (true) {
        const text = await awaitMsgResponse(channel, msgFilter)

        if(!text && state.paginationStopped) {
            const embed = new EmbedBuilder()
                .setTitle("タイムアウトしました。")
            await interaction.editReply("", {embeds: [embed], components: []})
            break;
        }
        if(text) {
            state.deleteMsgAcquired = true;
            if(rows.some((row) => row.textfrom == text)) {
                await runQuery("DELETE FROM dict WHERE textfrom = ? AND serverId = ?", [text, interaction.guildId]);
                const embed = new EmbedBuilder()
                    .setTitle("削除しました")
                    .setDescription("GG")
                await interaction.editReply({embeds: [embed], components: []});
                await interaction.editReply("");
                break;
            }
        }
    }
}

async function pagination(interaction, embeds, state) {
    let page = 0;
    if(!state) state = {}; 

    const updateButtons = () => {
        const leftButton = GenMessageButton("←", ButtonStyle.Primary, "left", page === 0);
        const stopButton = GenMessageButton("⏹", ButtonStyle.Danger, "stop");
        const rightButton = GenMessageButton("→", ButtonStyle.Primary, "right", page === embeds.length - 1);
        return createButtonRow([leftButton, stopButton, rightButton]);
    };

    await interaction.editReply({ embeds: [embeds[page]], components: [updateButtons()] });

    const filter = i => i.user.id === interaction.user.id;
    
    while (true) {
        const response = await awaitInteraction(interaction, filter, 60000);

        if(state.deleteMsgAcquired) break;

        if (!response) {
            await interaction.editReply({ components: [] });
            state.paginationStopped = true;
            break;
        }

        await response.deferUpdate();

        if (response.customId === "stop") {
            await interaction.editReply({ components: [] });
            state.paginationStopped = true;
            break;
        }

        if (response.customId === "left" && page > 0) {
            page--;
        } else if (response.customId === "right" && page < embeds.length - 1) {
            page++;
        }

        await interaction.editReply({ embeds: [embeds[page]], components: [updateButtons()] });
    }
}
