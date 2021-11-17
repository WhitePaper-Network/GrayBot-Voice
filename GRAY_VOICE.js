const Discord = require('discord.js');
const {ClientApplication} = require('discord.js')
var request = require('request');
const fs = require('fs');
const client = new Discord.Client({intents: [Object.keys(Discord.Intents.FLAGS)], partials: ['MESSAGE', 'CHANNEL', 'REACTION']});
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus, createAudioResource } = require('@discordjs/voice');
const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require("./config.json")
const datajson = require("./data.json")
var connection;
var readFlag = false; //読み上げ中かのフラグ
prefix = new RegExp(config.prefix);
let voiceQueue = new Array();
let voiceCon = new Array();
let voiceUID = new Array();
client.once("ready", async () => {
	console.log('VOICE_SYSTEM Started.')
	//SlashCommand登録(自動更新)機能
	//コマンドが重複することはない...はず
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
				.addChoice('invite', 'invite'))
	const commands = [cmd];
	client.application = new ClientApplication(client, {});
	await client.application.fetch();
	client.application.commands.set(commands);
	console.log('Startup Command Registration Success!')
	
	setInterval(() => {
		client.user.setActivity({
			name: `${config.prefix}help | ${client.guilds.cache.size}servers`
		})
	}, 5000)
});

async function editText(text) {
	if (text.length > config.textlimit) {
		sliced = text.slice(0, config.textlimit);
		texttmp = sliced + "、以下略"
	} else edit = text;
	texttmp = text.replace(/https?:\/\/\S+/g, '');
	const url = text.match(/https?:\/\/\S+/);
	if(url) edit = `URL省略${edit}`;
	texttmp = texttmp.replace('　', "、");
	texttmp = texttmp.replace(' ', "、");
	//todo: dictionary read / replace function
}


async function playVoice(text,speaker,emotion,emotion_level,pitch,uid,timestamp,con){
    if(readFlag == false){
		readFlag = true
		var voiceConnection = await con
		if (voiceConnection) {
			if(voiceQueue.length>0) voiceQueue.shift();
			if(voiceCon.length>0) voiceCon.shift();
			if(voiceUID.length>0) voiceUID.shift();
			const edit = editText(text);
			const data = `text=${edit}&speaker=${speaker}&emotion=${emotion}&emotion_level=${emotion_level}&pitch=${pitch}&speed=110`;
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
				var userData = datajson.find((popo)=>popo.user_id == voiceUID[0])
				var date = new Date();
				var unixTimestamp = date.getTime()
				readFlag = false;
				if(voiceQueue.length > 0) playVoice(voiceQueue[0],userData.speaker,userData.emotion,userData.emotion_level,userData.pitch,uid,unixTimestamp,voiceCon[0]);
			});
		}
	} else {
		await voiceQueue.push(text)
        await voiceCon.push(con);
        await voiceUID.push(uid);
    }
}

client.on('interactionCreate', async interaction => {
	const commandName = interaction.options._hoistedOptions[0].value //choice
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
		connection.destroy(); //VC切断
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
})

client.on('messageCreate', async message => {
	if(message.author.bot) return;
	const voiceChannel = message.member.voice.channel;
	if (message.content == `${config.prefix}join`) {
		if (!voiceChannel) return message.channel.send("あれー？あなたボイスチャンネル、入ってなくなーい？")
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
		message.channel.send("やっほー")
		connection = message.member.voice.channel.join()
	}
	if (message.content == `${config.prefix}leave`) {
		if (!voiceChannel) return message.channel.send("あれー？あなたボイスチャンネル、入ってなくなーい？")
		message.channel.send("ばいばーい")
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
			message.channel.send("声をかえてみたよ！")
		} else {
			message.channel.send("ぷろふぃーるなくない？一回ボクを呼んでから喋ってみてね！")
		}
	}
	if (message.content == `${config.prefix}help`) {
		message.channel.send({
			embed: {
				title: "ヘルプ",
				color: 0x2ecc71,
				footer: {
					icon_url: client.user.avatarURL,
					text: `GrayBot | ${client.ws.ping}ms`
				},
				fields: [{
					name: `${config.prefix}join`,
					value: "ボイスチャンネルにボットを参加させるよ。",
					inline: true
				},
				{
					name: `${config.prefix}leave`,
					value: "ボイスチャンネルからボットを退出させるよ。",
					inline: true
				},
				{
					name: `${config.prefix}voc`,
					value: "読み上げる声を変更するよ。",
					inline: true
				},
				{
					name: `${config.prefix}invite`,
					value: "ボットの招待リンクを送信するよ。",
					inline:true,
				}]
			}
		});
	}
	if (message.content == `${config.prefix}invite`) {
		message.channel.send({
			embed: {
				title: "BOT招待リンク",
				description:"Botを招待するには、[こちら](https://discord.com/api/oauth2/authorize?client_id=876646496945205308&permissions=8&scope=bot) もしくは以下のリンクをクリックしてください。  https://discord.com/api/oauth2/authorize?client_id=876646496945205308&permissions=8&scope=bot"
			}
		})
	}
	if (datajson.find((popo)=>popo.guild_id == message.guild.id)) {
		if (message.channel.id === guildData.speak_channel) {
			const voiceChannel = message.member.voice.channel;
			if (!voiceChannel) return;
			var userData = datajson.find((popo)=>popo.user_id == message.author.id)
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
				var userData = datajson.find((popo)=>popo.user_id == message.author.id)
				fs.writeFileSync("./data.json" , JSON.stringify(datajson, null, ' '));
				delete require.cache[require.resolve("./data.json")];
				if (message.content.match(prefix)) return;
			}
		var date = new Date();
		var unixTimestamp = date.getTime()
		var con = await joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
		});
		var userData = datajson.find((popo)=>popo.user_id == message.author.id)
		await playVoice(message.content,userData.speaker,userData.emotion,userData.emotion_level,userData.pitch,message.author.id,unixTimestamp,con)
		}
	}
});
client.login(config.token)
