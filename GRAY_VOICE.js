const Discord = require('discord.js');
const {ClientApplication} = require('discord.js');
var request = require('request');
const fs = require('fs');
const client = new Discord.Client({intents: [Object.keys(Discord.Intents.FLAGS)], partials: ['MESSAGE', 'CHANNEL', 'REACTION']});
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus, createAudioResource } = require('@discordjs/voice');
const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require("./config.json");
const datajson = require("./data.json");
const sqlite3 = require('sqlite3');
var connection;
let dictEditFlag = false;
let readFlag = false;
prefix = new RegExp(config.prefix);
let voiceQueue = new Array();
let voiceCon = new Array();
let voiceUID = new Array();

client.once("ready", async () => {
	console.log('VOICE_SYSTEM Started.')
	const cmd =  new SlashCommandBuilder()
		.setName('gray')
		.setDescription('GrayBot Slash Commands(Beta)')
		.addStringOption(option =>
			option.setName('action')
				.setDescription('実行するコマンド')
				.setRequired(true)
				.addChoice('join', 'join')
				.addChoice('leave', 'leave')
				.addChoice('voc', 'voc')
				.addChoice('help', 'help')
				.addChoice('invite', 'invite')
				.addChoice('dicedit', 'dicedit'))
	const commands = [cmd];
	client.application = new ClientApplication(client, {});
	await client.application.fetch();
	client.application.commands.set(commands);
	console.log('Startup Command Registration Success!')
	
	console.log('Init/Check Dictionary DB')
	const dict = new sqlite3.Database("./dictionary.db");
	await dict.run("create table if not exists dict(serverId,textfrom,textto)");
	await dict.close()
	setInterval(() => {
		client.user.setActivity({
			name: `${config.prefix}help | ${client.guilds.cache.size}servers`
		})
	}, 5000)
});

async function editText(text, serverId) {
	return new Promise(async (resolve, reject) => {
		let texttmp = text;
		const dict = new sqlite3.Database("./dictionary.db");
		const selectdict = 'select * from dict;'
		await dict.all(selectdict, async (err, rows) => {
			if (err) {
				throw err;
			}
			await dict.close();

			for (let i = 0; i < rows.length; i++) {
				if(serverId === rows[i].serverId) {
					if(texttmp.includes(rows[i].textfrom)) {
						texttmp = texttmp.replace(rows[i].textfrom, rows[i].textto)
					}
				}
			};
		
			if (texttmp.length > config.textlimit) {
				sliced = texttmp.slice(0, config.textlimit);
				texttmp = sliced + "、以下略"
			}
			texttmp = texttmp.replace(/https?:\/\/\S+/g, '');
			const url = texttmp.match(/https?:\/\/\S+/);
			if(url) texttmp = `URL省略${texttmp}`;
			texttmp = texttmp.replace('　', "、");
			texttmp = texttmp.replace(' ', "、");
			resolve(texttmp);
		})
	})
}


async function playVoice(message,userData,con,serverId){
    if(readFlag == false){
		readFlag = true
		var voiceConnection = await con
		if (voiceConnection) {
			if(voiceQueue.length>0) voiceQueue.shift();
			if(voiceCon.length>0) voiceCon.shift();
			if(voiceUID.length>0) voiceUID.shift();
			const edit = await editText(message.content, serverId);
			const data = `text=${edit}&speaker=${userData.speaker}&emotion=${userData.emotion}&emotion_level=${userData.emotion_level}&pitch=${userData.pitch}&speed=110`;
			const options = {
				url: 'https://api.voicetext.jp/v1/tts',
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				method: 'POST',
				body: data,
				auth: {
					'user':  config.vtapi,
					'pass': ''
				}
			};
			const player = createAudioPlayer();
			const res = createAudioResource(request(options))
			player.play(res)
			voiceConnection.subscribe(player)
			player.on(AudioPlayerStatus.Idle, () => {
				player.stop();
				userData = datajson.find((popo)=>popo.user_id == voiceUID[0])
				readFlag = false;
				if(voiceQueue.length > 0) playVoice(voiceQueue[0],userData,voiceCon[0],serverId);
			});
		}
	} else {
		await voiceQueue.push(message);
        await voiceCon.push(con);
        await voiceUID.push(message.author.id);
    }
}

async function dictTimeout(editMsg, flag1, flag2) {
	embed = new Discord.MessageEmbed()
		.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
	if(flag1 == 0) embed.setTitle('キャンセルしました');
	if(flag1 == 1) embed.setTitle('タイムアウトしました');
	editMsg.edit({embeds: [embed]});
	if(flag2 == 1) editMsg.reactions.removeAll();
	dictEditFlag = false;
	return;
}

client.on('interactionCreate', async interaction => {
	const commandName = interaction.options._hoistedOptions[0].value
	await interaction.deferReply();
	if(commandName == 'join') {
		if(interaction.member.voice.channel == null) return interaction.editReply('ボイスチャンネルに参加してから実行してねっ！');
		const guild = client.guilds.cache.get(interaction.guildId);
		const user = guild.members.cache.get(interaction.member.user.id);
		const voiceChannel = user.voice.channel;
		if (!user.voice.channel || user.voice.channel == null) return interaction.editReply('ボイスチャンネルに参加してから実行してねっ！');
		if(datajson.find((popo)=>popo.guild_id == interaction.guildId)) {
			var guildData = datajson.find((popo)=>popo.guild_id == interaction.guildId)
			guildData.speak_channel = interaction.channelId
			fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
			delete require.cache[require.resolve("./data.json")];
		} else {
			datajson.push({"guild_id":interaction.guildId,"speak_channel":interaction.channelId});
			fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
			delete require.cache[require.resolve("./data.json")];
		}
		joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		});
		interaction.editReply('やっほー！')
	}
	if(commandName == 'leave') {
		const guild = client.guilds.cache.get(interaction.guildId);
		const user = guild.members.cache.get(interaction.member.user.id);
		connection = getVoiceConnection(guild.id);
		connection.destroy();
		var guildData = datajson.find((popo)=>popo.guild_id == interaction.guildId)
		guildData.speak_channel = null
		fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
		delete require.cache[require.resolve("./data.json")];
		interaction.editReply('さよーならー！')
	}
	if(commandName == 'voc') {
		if(datajson.find((popo)=>popo.user_id == interaction.member.user.id)) {
			var speakernum = Math.floor( Math.random() * 5 );
			var emotionnum = Math.floor( Math.random() * 3 );
			var emotion_level = 1 + Math.floor( Math.random() * 4 );
			var pitch = 50 + Math.floor( Math.random() * 150 );
			const speaker = ["haruka","hikari","takeru","santa","bear"]
			const emotion = ["happiness","anger","sadness"]
			var userData = datajson.find((popo)=>popo.user_id == interaction.member.user.id)
			userData.speaker = speaker[speakernum]
			userData.emotion = emotion[emotionnum]
			userData.emotion_level = emotion_level 
			userData.pitch = pitch
			interaction.editReply('声をかえてみたよ～っ！')
		} else {
			interaction.editReply('うーん..データがないみたい...一度ボクを呼んでから喋ってくれるかな？')
		}
	}
	if(commandName == 'help') {
		const helpembed = new Discord.MessageEmbed()
			.setTitle('ヘルプ')
			.setColor(0x2ecc71)
			.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
			.addFields(
				{name: `${config.prefix}join`, value: 'ボイスチャンネルにボットを参加させるよ。', inline: true },
				{name: `${config.prefix}leave`, value: 'ボイスチャンネルにからボットを退出させるよ。', inline: true },
				{name: `${config.prefix}voc`, value: '読み上げる声を変更するよ。', inline: true },
				{name: `${config.prefix}invite`, value: 'ボットの招待リンクを送信するよ。', inline: true },
				{name: `${config.prefix}help`, value: 'このヘルプ画面を送信するよ。', inline: true },
				{name: `${config.prefix}dicedit`, value: "辞書を確認/編集するよ。", inline: true}
			)
		interaction.editReply({embeds: [helpembed] })
	}
	if(commandName == 'invite') {
		const inviteembed = new Discord.MessageEmbed()
			.setTitle('BOT招待リンク')
			.setDescription(`Botを招待するには、[こちら](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=3164160&scope=bot%20applications.commands) \n` +
			`もしくは以下のリンクをクリックしてください。  https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=3164160&scope=bot%20applications.commands`)
		interaction.editReply({embeds: [inviteembed] })
	}
	
	if(commandName == 'dicedit') {
		if(dictEditFlag == true) return interaction.editReply('重複防止のため、少々待ってからコマンドを再度実行してください。')
		dictEditFlag = true;
		
		const dictembedbase = new Discord.MessageEmbed()
			.setTitle('辞書編集(β)')
			.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
			
		let embed = dictembedbase
		embed.setDescription('実行したい操作を選択してください\n:one::登録内容を確認する\n:two::辞書内容を編集する')
		const checkmsg = await interaction.editReply({embeds: [embed]})
		await checkmsg.react('1️⃣').then(checkmsg.react('2️⃣'))
		const emojfilterminus1 = (reaction, user) => {
			return (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣') && user.id === interaction.user.id;
		};
		checkmsg.awaitReactions({filter: emojfilterminus1, max: 1, time: 20000, errors: ['time'] }).then(async collectedminus1 => {
			let reaction = collectedminus1.first()
			await checkmsg.reactions.removeAll()
			if(reaction.emoji.name == '1️⃣') {
				let embDesc;
				const dict = new sqlite3.Database("./dictionary.db");
				const selectdict = 'select * from dict;'
				await dict.all(selectdict, async (err, rows) => {
					if (err) {
						throw err;
					}
					let i = 0;
					for (const row of rows) {
						if(interaction.guildId === row.serverId) {
							if(i==0) {
								embDesc = row.textfrom + ' → ' + row.textto
								i++;
							} else {
								embDesc = embDesc + '\n' + row.textfrom + ' → ' + row.textto
							}
						}
					};
					if(!embDesc) embDesc = '辞書には何もありませんでした...'
					await dict.close();
					const dictcheckembed = new Discord.MessageEmbed()
						.setTitle('現在の登録内容')
						.setDescription(embDesc)
						.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
					await interaction.editReply({embeds: [dictcheckembed]})
					dictEditFlag = false;
					return;
				})
			}
			
			if(reaction.emoji.name == '2️⃣') {
				embed.setDescription('実行したい操作を選択してください\n:one::辞書に登録する\n:two::辞書から削除する')
				checkmsg.edit({embeds: [embed]})
				await checkmsg.react('1️⃣').then(checkmsg.react('2️⃣'))
				checkmsg.awaitReactions({filter: emojfilterminus1, max: 1, time: 20000, errors: ['time'] }).then(async collectedzero => {
					checkmsg.reactions.removeAll();
					reaction = collectedzero.first()
					if(reaction.emoji.name == '1️⃣') {
							embed.setDescription('読み上げ方を変更したい単語を送信してください')
						await interaction.editReply({embeds: [embed]})
						let channel = await client.channels.cache.get(interaction.channelId)
						let filter = m => m.author.id == interaction.member.user.id;
						interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).then(async collected => {
							let text1 = collected.first().content.toLowerCase();
							if(text1.length > config.textlimit) text1 = text1.slice(0, config.textlimit)
							await collected.first().delete();
								embed.setDescription(`単語:${text1}\n読み上げ方を送信してください`)
							await interaction.editReply({embeds: [embed]})
							interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).then(async collected2 => {
								let text2 = collected2.first().content.toLowerCase();
								if(text2.length > config.textlimit) text2 = text2.slice(0, config.textlimit)
								await collected2.first().delete();
								await interaction.deleteReply();
								let embed2 = dictembedbase
									embed2.addField(`単語:${text1}`, `**読み:${text2}**`)
									embed2.addField(`上記の通りで登録します。`,`よろしければ、:ok:を押してください。よろしくなければ、:ng:を押すとキャンセルできます。`)
								const message = await interaction.channel.send({embeds: [embed2]})
								message.react('🆗').then(message.react('🆖'))
								const emojfilter = (reaction, user) => {
									return (reaction.emoji.name == '🆗' || reaction.emoji.name == '🆖') && user.id === interaction.user.id;
								};
								message.awaitReactions({filter: emojfilter, max: 1, time: 30000, errors: ['time'] }).then(async collected3 => {
									reaction = collected3.first()
									if(reaction.emoji.name == '🆗') {
										message.reactions.removeAll()
										const dict = new sqlite3.Database("./dictionary.db");
										await dict.run(`insert into dict(serverId,textfrom,textto) values(?,?,?)`, interaction.guildId, text1, text2)
										await dict.close()
										let embed3 = new Discord.MessageEmbed()
											.setTitle('登録完了')
											.setDescription('正常に登録しました。')
											.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
										await message.edit({embeds: [embed3]})
										dictEditFlag = false;
										return;
									} else {
										if(reaction.emoji.name == '🆖') {
											dictTimeout(message, 0, 1)
										}
									}	
								}).catch(collected3 => {
									dictTimeout(checkmsg, 1, 1)
								})
							}).catch(collected => {
								dictTimeout(checkmsg, 1, 0)
							})
						}).catch(collected => {
							dictTimeout(checkmsg, 1, 0)
						})
					}
					if(reaction.emoji.name == '2️⃣') {
						dictEditFlag = false;
						checkmsg.reactions.removeAll();
						let embDesc;
						let textcheck;
						let dicts = new Array;
						const dict = new sqlite3.Database("./dictionary.db");
						const selectdict = 'select * from dict;'
						await dict.all(selectdict, async (err, rows) => {
							if (err) {
								throw err;
							}
							let i = 0
							for (const row of rows) {
								if(interaction.guildId === row.serverId) {
									if(i==0) {
										textcheck = row.textfrom
										embDesc = row.textfrom + ' → ' + row.textto
										i++;
									} else {
										textcheck = textcheck + row.textfrom
										embDesc = embDesc + '\n' + row.textfrom + ' → ' + row.textto
									}
								}
							};
							await dict.close();
							if(!embDesc) {
								let embed4 = new Discord.MessageEmbed()
								.setTitle('辞書編集(β)')
								.setDescription('辞書には何もありませんでした...')
								.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
								checkmsg.edit({embeds: [embed4]})
								return
							}
							
							let embed4 = new Discord.MessageEmbed()
								.setTitle('削除したい項目の変換元の単語をを送信してください')
								.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
								.setDescription(embDesc)
							checkmsg.edit({embeds: [embed4]})
							let delfilter = m => m.author.id == interaction.member.user.id;
							interaction.channel.awaitMessages({ filter: delfilter, max: 1, time: 30000, errors: ['time'] }).then(async collectedfour => {
								const textfrom = collectedfour.first().content.toLowerCase();
								if(!textcheck.includes(textfrom)) {
									collectedfour.first().delete()
									let embed45 = new Discord.MessageEmbed()
										.setTitle('辞書編集(β)')
										.setDescription('送信された単語を辞書から発見できませんでした。\nもう一度確認してからやり直してください。')
										.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
									checkmsg.edit({embeds: [embed45]})
									return;
								}
								const dict = new sqlite3.Database("./dictionary.db");
								await dict.run('DELETE FROM dict WHERE textfrom = ?', textfrom, err => {
									if (err) {
										return console.error(err.message);
									}
								});
								await dict.close();
								collectedfour.first().delete()
								let embed5 = new Discord.MessageEmbed()
									.setTitle('削除に成功しました')
									.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
								checkmsg.edit({embeds: [embed5]})
							}).catch(collected => {
								dictTimeout(checkmsg, 1, 0)
							})
						})
					}
				}).catch(collected3 => {
					dictTimeout(checkmsg, 1, 0)
				})
			}
		}).catch(collected => {
			dictTimeout(checkmsg, 1, 1)
		})
	}
});

client.on('messageCreate', async message => {
	if(message.author.bot) return;
	const voiceChannel = message.member.voice.channel;
	if (message.content == `${config.prefix}join`) {
		if (!voiceChannel) return message.reply("あれー？あなたボイスチャンネル、入ってなくなーい？")
		if(datajson.find((popo)=>popo.guild_id == message.guild.id)) {
			var guildData = datajson.find((popo)=>popo.guild_id == message.guild.id)
			guildData.speak_channel = message.channel.id
			fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
			delete require.cache[require.resolve("./data.json")];
		} else {
			datajson.push({"guild_id":message.guild.id,"speak_channel":message.channel.id});
			fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
			delete require.cache[require.resolve("./data.json")];
		}
		message.reply("やっほー")
		connection = message.member.voice.channel.join()
	}
	if (message.content == `${config.prefix}leave`) {
		if (!voiceChannel) return message.reply("あれー？あなたボイスチャンネル、入ってなくなーい？")
		message.reply("ばいばーい")
		message.member.guild.voice.channel.leave()
		var guildData = datajson.find((popo)=>popo.guild_id == message.guild.id)
		guildData.speak_channel = null
		fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
		delete require.cache[require.resolve("./data.json")];
	}
	var guildData = datajson.find((popo)=>popo.guild_id == message.guild.id)
	if (message.content == `${config.prefix}voc`) {
		if(datajson.find((popo)=>popo.user_id == message.author.id)) {
			var speakernum = Math.floor( Math.random() * 5 );
			var emotionnum = Math.floor( Math.random() * 3 );
			var emotion_level = 1 + Math.floor( Math.random() * 4 );
			var pitch = 50 + Math.floor( Math.random() * 150 );
			const speaker = ["haruka","hikari","takeru","santa","bear"]
			const emotion = ["happiness","anger","sadness"]
			var userData = datajson.find((popo)=>popo.user_id == message.author.id)
			userData.speaker = speaker[speakernum]
			userData.emotion = emotion[emotionnum]
			userData.emotion_level = emotion_level 
			userData.pitch = pitch
			message.reply("声をかえてみたよ！")
		} else {
			message.reply("ぷろふぃーるなくない？一回ボクを呼んでから喋ってみてね！")
		}
	}
	if (message.content == `${config.prefix}help`) {
		const embed = new Discord.MessageEmbed()
			.setTitle("ヘルプ")
			.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
			.addFields(
				{name: `${config.prefix}join`, value: "ボイスチャンネルにボットを参加させるよ。", inline: true},
				{name: `${config.prefix}leave`, value: "ボイスチャンネルからボットを退出させるよ。", inline: true},
				{name: `${config.prefix}voc`, value: "読み上げる声を変更するよ。", inline: true},
				{name: `${config.prefix}invite`, value: "ボットの招待リンクを送信するよ。", inline: true},
				{name: `${config.prefix}help`, value: 'このヘルプ画面を送信するよ。', inline: true },
				{name: `${config.prefix}dicedit`, value: "辞書を確認/編集するよ。", inline: true}
			)
		message.reply({embeds: [embed]});
	}
	if (message.content == `${config.prefix}invite`) {
		const embed = new Discord.MessageEmbed()
			.setTitle("BOT招待リンク")
			.setDescription("Botを招待するには、[こちら](https://discord.com/api/oauth2/authorize?client_id=876646496945205308&permissions=8&scope=bot) もしくは以下のリンクをクリックしてください。  https://discord.com/api/oauth2/authorize?client_id=876646496945205308&permissions=8&scope=bot")
		message.reply({embeds: [embed]})
	}
	
	if(message.content == `${config.prefix}dicedit`) {
		if(dictEditFlag == true) return message.reply('重複防止のため、少々待ってからコマンドを再度実行してください。')
		dictEditFlag = true;
		const dictembedbase = new Discord.MessageEmbed()
			.setTitle('辞書編集(β)')
			.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
			
		let embed = dictembedbase
		embed.setDescription('実行したい操作を選択してください\n:one::登録内容を確認する\n:two::辞書内容を編集する')
		const checkmsg = await message.reply({embeds: [embed]})
		await checkmsg.react('1️⃣').then(checkmsg.react('2️⃣'))
		const emojfilterminus1 = (reaction, user) => {
			return (reaction.emoji.name == '1️⃣' || reaction.emoji.name == '2️⃣') && user.id === message.member.user.id;
		};
		checkmsg.awaitReactions({filter: emojfilterminus1, max: 1, time: 20000, errors: ['time'] }).then(async collectedminus1 => {
			let reaction = collectedminus1.first()
			await checkmsg.reactions.removeAll()
			if(reaction.emoji.name == '1️⃣') {
				let embDesc;
				const dict = new sqlite3.Database("./dictionary.db");
				const selectdict = 'select * from dict;'
				await dict.all(selectdict, async (err, rows) => {
					if (err) {
						throw err;
					}
					let i = 0;
					for (const row of rows) {
						if(checkmsg.guildId === row.serverId) {
							if(i==0) {
								embDesc = row.textfrom + ' → ' + row.textto
								i++;
							} else {
								embDesc = embDesc + '\n' + row.textfrom + ' → ' + row.textto
							}
						}
					};
					if(!embDesc) embDesc = '辞書には何もありませんでした...'
					await dict.close();
					const dictcheckembed = new Discord.MessageEmbed()
						.setTitle('現在の登録内容')
						.setDescription(embDesc)
						.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
					await checkmsg.edit({embeds: [dictcheckembed]})
					dictEditFlag = false;
					return;
				})
			}
			
			if(reaction.emoji.name == '2️⃣') {
				embed.setDescription('実行したい操作を選択してください\n:one::辞書に登録する\n:two::辞書から削除する')
				checkmsg.edit({embeds: [embed]})
				await checkmsg.react('1️⃣').then(checkmsg.react('2️⃣'))
				checkmsg.awaitReactions({filter: emojfilterminus1, max: 1, time: 20000, errors: ['time'] }).then(async collectedzero => {
					checkmsg.reactions.removeAll();
					reaction = collectedzero.first()
					if(reaction.emoji.name == '1️⃣') {
						embed.setDescription('読み上げ方を変更したい単語を送信してください')
						await checkmsg.edit({embeds: [embed]})
						let filter = m => m.author.id == message.member.user.id;
						checkmsg.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).then(async collected => {
							const text1 = collected.first().content.toLowerCase();
							if(text1.length > config.textlimit) text1 = text1.slice(0, config.textlimit)
							await collected.first().delete();
							embed.setDescription(`単語:${text1}\n読み上げ方を送信してください`)
							await checkmsg.edit({embeds: [embed]})
							checkmsg.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] }).then(async collected2 => {
								const text2 = collected2.first().content.toLowerCase();
								if(text2.length > config.textlimit) text2 = text2.slice(0, config.textlimit)
								await collected2.first().delete();
								await checkmsg.delete();
								let embed2 = dictembedbase
									embed2.addField(`単語:${text1}`, `**読み:${text2}**`)
									embed2.addField(`上記の通りで登録します。`,`よろしければ、:ok:を押してください。よろしくなければ、:ng:を押すとキャンセルできます。`)
								const checkmsg2 = await checkmsg.channel.send({embeds: [embed2]})
								checkmsg2.react('🆗').then(checkmsg2.react('🆖'))
								const emojfilter = (reaction, user) => {
									return (reaction.emoji.name == '🆗' || reaction.emoji.name == '🆖') && user.id === message.author.id;
								};
								checkmsg2.awaitReactions({filter: emojfilter, max: 1, time: 30000, errors: ['time'] }).then(async collected3 => {
									reaction = collected3.first()
									if(reaction.emoji.name == '🆗') {
										checkmsg2.reactions.removeAll()
										const dict = new sqlite3.Database("./dictionary.db");
										await dict.run(`insert into dict(serverId,textfrom,textto) values(?,?,?)`, checkmsg2.guildId, text1, text2)
										await dict.close()
										let embed3 = new Discord.MessageEmbed()
											.setTitle('登録完了')
											.setDescription('正常に登録しました。')
											.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
										await checkmsg2.edit({embeds: [embed3]})
										dictEditFlag = false;
										return;
									} else {
										if(reaction.emoji.name == '🆖') {
											dictTimeout(checkmsg2, 0, 1)
										}
									}	
								}).catch(collected3 => {
									dictTimeout(checkmsg2, 1, 1)
								})
							}).catch(collected => {
								dictTimeout(checkmsg, 1, 0)
							})
						}).catch(collected => {
							dictTimeout(checkmsg, 1, 0)
						})
					}
					if(reaction.emoji.name == '2️⃣') {
						dictEditFlag = false;
						checkmsg.reactions.removeAll();
						let embDesc;
						let textcheck;
						let dicts = new Array;
						const dict = new sqlite3.Database("./dictionary.db");
						const selectdict = 'select * from dict;'
						await dict.all(selectdict, async (err, rows) => {
							if (err) {
								throw err;
							}
							let i = 0
							for (const row of rows) {
								if(checkmsg.guildId === row.serverId) {
									if(i==0) {
										textcheck = row.textfrom
										embDesc = row.textfrom + ' → ' + row.textto
										i++;
									} else {
										textcheck = textcheck + row.textfrom
										embDesc = embDesc + '\n' + row.textfrom + ' → ' + row.textto
									}
								}
							};
							await dict.close();
							if(!embDesc) {
								let embed4 = new Discord.MessageEmbed()
								.setTitle('辞書編集(β)')
								.setDescription('辞書には何もありませんでした...')
								.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
								checkmsg.edit({embeds: [embed]})
								return;
							}
							
							let embed4 = new Discord.MessageEmbed()
								.setTitle('削除したい項目の変換元の単語をを送信してください')
								.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
								.setDescription(embDesc)
							checkmsg.edit({embeds: [embed4]})
							let delfilter = m => m.author.id == message.author.id;
							checkmsg.channel.awaitMessages({ filter: delfilter, max: 1, time: 30000, errors: ['time'] }).then(async collectedfour => {
								const textfrom = collectedfour.first().content.toLowerCase();
								if(!textcheck.includes(textfrom)) {
									let embed45 = new Discord.MessageEmbed()
										.setTitle('辞書編集(β)')
										.setDescription('送信された単語を辞書から発見できませんでした。\nもう一度確認してからやり直してください。')
										.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
									checkmsg.edit({embeds: [embed45]})
									collectedfour.first().delete()
									return;
								}
								const dict = new sqlite3.Database("./dictionary.db");
								await dict.run('DELETE FROM dict WHERE textfrom = ?', textfrom, err => {
									if (err) {
										return console.error(err.message);
									}
								});
								await dict.close();
								collectedfour.first().delete()
								let embed5 = new Discord.MessageEmbed()
									.setTitle('削除に成功しました')
									.setFooter(`GrayBot | ${client.ws.ping}ms`, client.user.avatarURL)
								checkmsg.edit({embeds: [embed5]})
							}).catch(collected => {
								dictTimeout(checkmsg, 1, 0)
							})
						})
					}
				}).catch(collected3 => {
					dictTimeout(checkmsg, 1, 0)
				})
			}
		}).catch(collected3 => {
			dictTimeout(checkmsg, 1, 0)
		})
	}
	
	if (datajson.find((popo)=>popo.guild_id == message.guild.id)) {
		if (message.channel.id === guildData.speak_channel) {
			const voiceChannel = message.member.voice.channel;
			if (!voiceChannel) return;
			let userData = datajson.find((popo)=>popo.user_id == message.author.id)
			if(datajson.find((popo)=>popo.user_id == message.author.id)) {
				if (message.content.match(prefix)) return;
			} else {
				var speakernum = Math.floor( Math.random() * 5 );
				var emotionnum = Math.floor( Math.random() * 3 );
				var emotion_level = 1 + Math.floor( Math.random() * 4 );
				var pitch = 50 + Math.floor( Math.random() * 150 );
				const speaker = ["haruka","hikari","takeru","santa","bear"]
				const emotion = ["happiness","anger","sadness"]
				datajson.push({"user_id":message.author.id,"speaker":speaker[speakernum],"emotion":emotion[emotionnum],"emotion_level":emotion_level,"pitch":pitch});
				userData = datajson.find((popo)=>popo.user_id == message.author.id)
				fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
				delete require.cache[require.resolve("./data.json")];
				if (message.content.match(prefix)) return;
			}
			let con = await joinVoiceChannel({
				channelId: voiceChannel.id,
				guildId: voiceChannel.guild.id,
				adapterCreator: voiceChannel.guild.voiceAdapterCreator,
			});
			userData = datajson.find((popo)=>popo.user_id == message.author.id)
			await playVoice(message,userData,con,voiceChannel.guild.id)
		}
	}
});
client.login(config.token)
