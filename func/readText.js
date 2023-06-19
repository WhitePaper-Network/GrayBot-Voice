const {textReplace} = require("../func/textReplace.js");
const { createAudioPlayer,
		AudioPlayerStatus,
		createAudioResource 
	} = require('@discordjs/voice');
const fetch = require("node-fetch")
const config = require("../config.json")
const extlist = require("../extlist.json")
const fs = require("fs")

module.exports = {
	async readText(message, readQueue) {
		if(readQueue.messages[0] && readQueue.messages[0].id == message.id) readQueue.messages.shift();
		let ext;
		if(message.attachments && message.attachments.size) {
			ext = message.attachments.first().url.substring(message.attachments.first().url.lastIndexOf(".") +1);
		}
		let readDataJson = JSON.parse(fs.readFileSync("./data.json", "utf-8"))
		let readData = readDataJson;
		
		let guildData = readData[message.guildId]
		let userData = guildData.userData[message.author.id]
		const reptext = await textReplace(message.content, message.guildId, ext, message.member.displayName);
		
		const data = `text=${reptext}`+
					 `&speaker=${userData.speaker}`+
					 `&emotion=${userData.emotion}`+
					 `&emotion_level=${userData.emotion_level}`+
					 `&pitch=${userData.pitch}&speed=120`;
					 
		const options = {
			method: 'POST',
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Authorization": "Basic "+Buffer.from(config.vtapi+":").toString("base64"),
			},
			body: data,
		};
		
		const snd = await fetch("https://api.voicetext.jp/v1/tts", options);
		const res = createAudioResource(snd.body);
		readQueue.player = await createAudioPlayer();
		readQueue.player.play(res);
		readQueue.connection.subscribe(readQueue.player);
		
		readQueue.player.on(AudioPlayerStatus.Idle, () => {
			readQueue.player.stop();
			if(readQueue.messages[0]) {
				return module.exports.readText(readQueue.messages[0], readQueue)
			} else {
				readQueue.reading = false;
				return;
			};
		});
	}
};