const { Client,
		EmbedBuilder,
		SlashCommandBuilder,
		AttachmentBuilder,
		GatewayIntentBits,
		Partials,
		ClientApplication,
		Routes,
		REST
	} = require("discord.js");
	
const { joinVoiceChannel,
		createAudioPlayer,
		AudioPlayerStatus,
		createAudioResource 
	} = require("@discordjs/voice");

const client = new Client({
	intents: [Object.keys(GatewayIntentBits)],
	partials: [Partials.Message, Partials.MessageContent, Partials.Channels, Partials.Reaction]
});

const readQueueTmpl = 
	JSON.stringify({
		"messages": [],
		"player": {},
		"connection": {},
		"reading": false,
	});

const userDataTmpl = 
	JSON.stringify({
		"speaker": "",
		"emotion": "",
		"emotion_level": "",
		"pitch": ""
	});

const fs = require("fs")
const sqlite3 = require("sqlite3")

const config = require("./config.json");
if(!fs.existsSync("./data.json")) {
	console.log("Initializing data.json")
	const tmp = {"guildIds": []};
	return fs.writeFileSync("./data.json", JSON.stringify(tmp, null, '	'));
};

const {readText} = require("./func/readText.js")
const {changeSettings} = require("./func/changeSettings.js")

let serverQueue = {};

client.on("ready", async () => {
	console.log("Starting");
	
	const cmd = new SlashCommandBuilder()
		.setName(config.cmdName)
		.setDescription("GrayBot Commands")
		.addSubcommand(subcommand =>
			subcommand
				.setName("join")
				.setDescription("読み上げを開始します")
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("leave")
				.setDescription("読み上げを終了し退出します")
		)
		.addSubcommand(subcommand => 
			subcommand
				.setName("change_voice")
				.setDescription("声を変更します")
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("help")
				.setDescription("bot情報を表示します")
		)
	
	const commands = [cmd];
	
	console.log("Refresh SlashCommands...")
	const rest = new REST({version: "10"}).setToken(config.token)
	await rest.put(
		Routes.applicationCommands(client.user.id),
		{body: commands},
	);

	if(!fs.existsSync('./data.db')) {
		console.log('Initializing Data DB...')
		const dict = new sqlite3.Database("./data.db");
		await dict.run("create table if not exists dict(serverId,textfrom,textto)");
		await dict.run("create table if not exists userExts(serverId, ext, text)")
		await dict.close()
	}
	
	setInterval(() => {
		let stat;
		if(!config.status_text) {
			stat = `/${config.cmdName} | ${client.guilds.cache.size}servers / © 2023 WhitePaper`;
		} else {
			stat = `/${config.cmdName} | ${client.guilds.cache.size}servers / © 2023 WhitePaper / ${config.status_text}`;
		};
		client.user.setActivity({
			name: stat
		});
	}, 5000);
	
	console.log("Started.");
	
	const readDataJson = await JSON.parse(fs.readFileSync("./data.json", "utf-8"))
	let readData = readDataJson;
	
	readData.guildIds.forEach(async guildId => {
		if(readData[guildId] && readData[guildId].joined) {
			try {
			serverQueue[guildId] = JSON.parse(readQueueTmpl);
			let guild = await client.guilds.fetch(guildId)
			serverQueue[guildId].connection = await joinVoiceChannel({
				channelId: readData[guildId].vChannelId,
				guildId: guildId,
				adapterCreator: guild.voiceAdapterCreator,
			});
			console.log("Restored connection in guild " + guildId)
			} catch (e) {
				console.log("=======================================")
				console.log("Connection Error: \n" + e.stack + "\n=======================================")
				readData[guildId].joined = false;
				await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
			}
		}
	})
	
})

client.on("voiceStateUpdate", async (oldState, newState) => {
	const readDataJson = await JSON.parse(fs.readFileSync("./data.json", "utf-8"))
	let readData = readDataJson;
	const guildId = oldState.guild.id;
	if(!readData.guildIds.includes(guildId)) return
	if(readData[guildId].joined == true && oldState.channelId != null && newState.channelId != oldState.channelId) {
		if(oldState.channel.members.size == 1) {
			if(serverQueue[guildId] && serverQueue[guildId].connection) await serverQueue[guildId].connection.destroy()
			serverQueue[guildId] = {};
			readData[guildId].joined = false;
			await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
		}
	}
})

client.on("interactionCreate", async interaction => {
	if (!interaction.isChatInputCommand()) return;
	
	if(interaction.commandName == config.cmdName) {
		const cmd = interaction.options.getSubcommand()
		const readDataJson = JSON.parse(fs.readFileSync("./data.json", "utf-8"))
		let readData = readDataJson;
		let guildId = interaction.guildId;
		let userId = interaction.user.id;
		if(cmd == "join") {
			if(interaction.member.voice.channel == null) return interaction.reply("ボイスチャンネルに参加してから実行してねっ！");
			if(!readData.guildIds.includes(interaction.guildId)) readData.guildIds.push(interaction.guildId)
			const voiceChannel = interaction.member.voice.channel;
			if(!readData[guildId]) {
				readData[guildId] = {};
				readData[guildId].userData = {};
				readData[guildId].joined = false;
			};
			
			if(!readData[guildId].tChannelIds.includes(interaction.channelId)) {
				readData[guildId].tChannelIds.push(interaction.channelId)
				await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
				if(readData[guildId] && readData[guildId].joined == true && serverQueue[guildId]) {
					return interaction.reply("読み上げチャンネルを追加しました！");
				}
			}
			
			if(readData[guildId] && readData[guildId].joined == true && serverQueue[guildId]) {
				return interaction.reply("すでに参加してるよ！");
			};
			
			serverQueue[guildId] = JSON.parse(readQueueTmpl);

			serverQueue[guildId].connection = await joinVoiceChannel({
				channelId: voiceChannel.id,
				guildId: voiceChannel.guild.id,
				adapterCreator: voiceChannel.guild.voiceAdapterCreator,
			});

			readData[guildId].joined = true;
			readData[guildId].vChannelId = voiceChannel.id;
			
			if(!readData[guildId].tChannelIds) readData[guildId].tChannelIds = []
			
			await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
			interaction.reply("やっほー！");
			return;
		}
		
		if(cmd == "leave") {
			readData[guildId].joined = false;
			if(serverQueue[guildId] && serverQueue[guildId].connection) await serverQueue[guildId].connection.destroy()
			serverQueue[guildId] = {};
			
			await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
			return interaction.reply("さよーならー！")
		}
		
		if(cmd == "change_voice") {
			if(!readData[guildId]) readData[guildId] = {};
			if(!readData[guildId].userData) readData[guildId].userData = {}
			readData[guildId].userData[userId] = {};
			const speaker = ["haruka","hikari","takeru","santa","bear"]
			const emotion = ["happiness","anger","sadness"]
			let speakernum = Math.floor( Math.random() * 5 );
			let emotionnum = Math.floor( Math.random() * 3 );
			let emotion_level = 1 + Math.floor( Math.random() * 4 );
			let pitch = 50 + Math.floor( Math.random() * 150 );
			
			readData[guildId].userData[userId].speaker = speaker[speakernum]
			readData[guildId].userData[userId].emotion = emotion[emotionnum]
			readData[guildId].userData[userId].emotion_level = emotion_level 
			readData[guildId].userData[userId].pitch = pitch
			
			await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
			
			return interaction.reply("声をかえてみたよ～っ！")
		}
		
		if(cmd == "settings") {
			return changeSettings(interaction, readData)
		}
		
		if(cmd == "help") {
			let embed = new EmbedBuilder()
				.setTitle("Help")
				.setDescription(config.helptext)
			if(config.botinvite)embed.addFields({name: "導入用URL", value:"[URL](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=3164160&scope=bot%20applications.commands)"})
			embed.setFooter({text: `GrayBot | ${interaction.createdTimestamp - Date.now()}ms`, iconURL: client.user.avatarURL()})
				
			return interaction.reply({embeds: [embed]})
		}
		
		return;
	}
	return;
})

client.on("messageCreate", async message => {
	if(message.author.bot) return;
	
	let readDataJson = JSON.parse(fs.readFileSync("./data.json", "utf-8"))
	let readData = readDataJson;
	if(!readData[message.guildId] || !serverQueue[message.guildId]) return;
	if(readData[message.guildId] && !readData[message.guildId].joined) return;
	if(!readData[message.guildId].tChannelIds.includes(message.channel.id)) return;
	
	if(!readData[message.guildId].userData[message.author.id]) {
		readData[message.guildId].userData[message.author.id] = {};
		const speaker = ["haruka","hikari","takeru","santa","bear"]
		const emotion = ["happiness","anger","sadness"]
		
		let speakernum = Math.floor( Math.random() * 5 );
		let emotionnum = Math.floor( Math.random() * 3 );
		let emotion_level = 1 + Math.floor( Math.random() * 4 );
		let pitch = 50 + Math.floor( Math.random() * 150 );
		
		readData[message.guildId].userData[message.author.id].speaker = speaker[speakernum]
		readData[message.guildId].userData[message.author.id].emotion = emotion[emotionnum]
		readData[message.guildId].userData[message.author.id].emotion_level = emotion_level 
		readData[message.guildId].userData[message.author.id].pitch = pitch
		
		await fs.writeFileSync("./data.json" , JSON.stringify(readData, null, ' '));
		delete require.cache[require.resolve("./data.json")];
	}
	
	if(serverQueue[message.guildId].reading) {
		serverQueue[message.guildId].messages.push(message)
	} else {
		serverQueue[message.guildId].reading = true;
		await readText(message, serverQueue[message.guildId]);
	}
	
	
})

client.login(config.token)