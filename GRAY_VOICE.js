const Discord = require('discord.js');
var request = require('request');
const fs = require('fs');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const config = require("./config.json")
const data = require("./data.json")
var dispatcher = null;
prefix = new RegExp(config.prefix);
let voiceQueue = new Array();
client.once("ready", () => {
	console.log("VOICE-SYSTEM Started.");
});

async function playVoice(text,speaker,emotion,emotion_level,pitch,uid,timestamp){
    if(dispatcher == null){
      var voiceConnection = client.voice.connections.first()
      if (voiceConnection) {
        if(voiceQueue.length>0) voiceQueue.shift();
        if (text.length > config.textlimit) {
          sliced = text.slice(0, config.textlimit);
          edit = sliced + "、以下略"
      } else edit = text
      const outFile = await fs.createWriteStream(`./${timestamp}.wav`);
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
    const res = await request(options);
        await res.pipe(outFile);
          res.on('end', function() {
              outFile.close();
              const voicewav = (`./${timestamp}.wav`)
              dispatcher = voiceConnection.play(voicewav)
              dispatcher.on('error', console.error);
              dispatcher.on('finish', () => {
                dispatcher = null;
                try {
                  fs.unlinkSync(`./${timestamp}.wav`);
                } catch (error) {
                  throw error;
                }
                const djson = require("./data.json")
                var userData = djson.find((popo)=>popo.user_id == uid)
                var date = new Date();
                var unixTimestamp = date.getTime()
                if(voiceQueue.length > 0) playVoice(voiceQueue[0],userData.speaker,userData.emotion,userData.emotion_level,userData.pitch,uid,unixTimestamp);
              });
          });
      }
    }else{
        await voiceQueue.push(text);
      }
  }



client.on('message', async message => {
  if(message.author.bot) return;
  const voiceChannel = message.member.voice.channel;
	if (message.content === config.prefix + 'join') {
    if (!voiceChannel) return message.channel.send("あれー？あなたボイスチャンネル、入ってなくなーい？")
    if(data.find((popo)=>popo.guild_id == message.guild.id))
    {
      var guildData = data.find((popo)=>popo.guild_id == message.guild.id)
      guildData.speak_channel = message.channel.id
      fs.writeFileSync("./data.json" , JSON.stringify(data, null, ' '));
      delete require.cache[require.resolve("./data.json")];
    }
    else 
    {
      data.push({"guild_id":message.guild.id,"speak_channel":message.channel.id});
      fs.writeFileSync("./data.json" , JSON.stringify(data, null, ' '));
      delete require.cache[require.resolve("./data.json")];
    }
    message.channel.send("やっほー")
		message.member.voice.channel.join()
	}
  if (message.content === config.prefix + 'leave') {
    if (!voiceChannel) return message.channel.send("あれー？あなたボイスチャンネル、入ってなくなーい？")
    message.channel.send("ばいばーい")
		message.member.guild.voice.channel.leave()
  }
  var guildData = data.find((popo)=>popo.guild_id == message.guild.id)
	if (message.channel.id === guildData.speak_channel) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return;
    var userData = data.find((popo)=>popo.user_id == message.author.id)
    if(data.find((popo)=>popo.user_id == message.author.id))
    {
      if (message.content.match(prefix)) return;
    }
    else
    {
      var speakernum = Math.floor( Math.random() * 5 );
      var emotionnum = Math.floor( Math.random() * 3 );
      var emotion_level = 1 + Math.floor( Math.random() * 4 );
      var pitch = 50 + Math.floor( Math.random() * 150 );
      const speaker = ["haruka","hikari","takeru","santa","bear"]
      const emotion = ["happiness","anger","sadness"]
      data.push({"user_id":message.author.id,"speaker":speaker[speakernum],"emotion":emotion[emotionnum],"emotion_level":emotion_level,"pitch":pitch});
      var userData = data.find((popo)=>popo.user_id == message.author.id)
      fs.writeFileSync("./data.json" , JSON.stringify(data, null, ' '));
      delete require.cache[require.resolve("./data.json")];
      if (message.content.match(prefix)) return;
      
    }
    var date = new Date();
    var unixTimestamp = date.getTime()
    await playVoice(message.content,userData.speaker,userData.emotion,userData.emotion_level,userData.pitch,message.author.id,unixTimestamp)
	}
});
client.login(config.token)