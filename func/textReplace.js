const sqlite3 = require("sqlite3")
const config = require("../config.json")
const extlist = require("../extlist.json")

module.exports = {
	async textReplace(text, serverId, ext, userName) {
		return new Promise(async (resolve, reject) => {
			let texttmp = text;
			
			if(ext) {
				if(extlist[ext]) {
					if(extlist[ext] == "画像" || extlist[ext] == "動画") {
						texttmp = `${userName}さんが${extlist[ext]}を送信しました。${texttmp}`;
					} else {
						texttmp = `${userName}さんが${extlist[ext]}ファイルを送信しました。${texttmp}`;
					}
				} else {
					texttmp = `${userName}さんがファイルを送信しました。${texttmp}`;
				}
			}
			const dict = new sqlite3.Database("./data.db");
			const selectdict = 'select * from dict;'
			await dict.all(selectdict, async (err, rows) => {
				if (err) {
					throw err;
				}
				await dict.close();

				for (let i = 0; i < rows.length; i++) {
					if(serverId === rows[i].serverId) {
						if(texttmp.includes(rows[i].textfrom)) {
							texttmp = texttmp.replace(new RegExp(rows[i].textfrom,"g"), rows[i].textto);
						}
					}
				};
			
				if (texttmp.length > config.textlimit) {
					let sliced = texttmp.slice(0, config.textlimit);
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
}