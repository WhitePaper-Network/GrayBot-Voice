import fetch from 'node-fetch';
const apiEndpoint = 'https://discord.com/api/v8/applications/bot user id here/commands
const botToken = 'bot token here'
const commandData = {
  "name": "gray",
  "description": "GrayBot Slash Commands(Beta)",
  "options":  [
    {
        "name": "action",
        "description": "実行するコマンド",
        "type": 3,
        "required": true,
        "choices": [
            {
                "name": "join",
                "value": "join"
            },
            {
                "name": "leave",
                "value": "leave"
            },
            {
                "name": "voc",
                "value": "voc"
            },
            {
              "name": "help",
              "value": "help",
            },
            {
              "name": "invite",
              "value": "invite"
            }
        ]
    },
]
}

async function main () {
  const response = await fetch(apiEndpoint, {
    method: 'post',
    body: JSON.stringify(commandData),
    headers: {
      'Authorization': 'Bot ' + botToken,
      'Content-Type': 'application/json'
    }
  })
  const json = await response.json()

  console.log(json)
}
main()
