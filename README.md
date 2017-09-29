# Net64+ Server

This is a dedicated server for Net64 aka Sm64O, that uses the Websocket protocol.

## Server List

There is a [public server list](http://smmdb.ddns.net/net64) of all Net64+ server, that have enabled listing.

## Installation

- download and install [Node 8](https://nodejs.org/en/download/current/)
- `git clone` this repository or [download as zip](https://github.com/Tarnadas/sm64o-ded/archive/master.zip)
- modify `settings.json`
```json
{
  "port": "3678", // make sure your port is forwarded
  "enableWebHook": false, // set this to true, if you want your server to be listed
  "name": "A Net64+ Server", // display name for public server list
  "domain": "", // domain of your server for public server list. keep it empty, if you don't have a domain
  "description": "The **best** Net64+ server ever\n\n:unicorn_face:", // description for public server list
  "apiKey": "" // this is required
}
```
- (OPTIONAL) if you want your server to be listed, go to [SMMDB](http://smmdb.ddns.net), login with Google, go to profile and get your API key
  - *Do not share your API key, because it gives full access to your account*
  - You can only list one server per API key
  - `name` will be shortened to 40 characters at most
  - `description` will be shortened to 200 characters at most
  - `description` supports [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) and [emojis](https://raw.githubusercontent.com/omnidan/node-emoji/master/lib/emoji.json)
- open a terminal in the folder of your server and execute the following commands
```
$ npm install
$ npm start
```
- (OPTIONAL) if you want to run your server indefinitely with auto restarts, I suggest to use pm2
```
$ npm i -g pm2
$ npm run compile
$ pm2 start ./dist --name="net64 server"
```

## Why?

Because the official client uses the [Hazel protocol](https://github.com/DarkRiftNetworking/Hazel-Networking) and I want to make a dedicated server with Node.js.
The Hazel protocol is only implemented in C# and honestly, noone uses it (sorry).

With this server no official client will be able to join. You can only connect to this servers with my [modified client](https://github.com/Tarnadas/sm64o).

If you want to get the original client, please go [here](https://github.com/Guad/sm64o). If you only want to play with friends, the official client is a better choice.

## Differences

**__Performance__**

Performance is the major goal of this. Even though it uses TCP, it will outperform the original Net64 software by far and I will explain to you why:

### Networking and Bandwidth

Player data is what makes 95% of the bandwith while hosting a Net64 server.
- Net64 sends one packet per player per player to be sent. Net64+ sends one packet that contains all player data and sends it to all players.
- Net64 does not use compression. Net64+ uses Gzip compression. This is only possible, because packets for player data are united in one large packet, otherwise Gzip header data would add additional overhead.

Here is a table to break down Networking performance with an example:

| | Net64 | Net64+ |
| --- | --- | --- |
| # of packets to send to N clients | O(N<sup>2</sup>) | O(N) |
| # of bytes to send to N clients (with a player data length of 24) | N<sup>2</sup> * (24 + 4 *(bytes used for memory offset)* + headers) | N * (N * 24 * *Gzip compression size* + headers) |
| # of bytes to send for 24 clients (assume 10 bytes for all headers and an average Gzip compression size of 60%) | 24<sup>2</sup> * (24 + 4 + 10) = 21888B = **21.375KB** | 24 * (24 * 24 * 0.6 + 10 + 10 *(Gzip header)*) = 8775B = **8.57KB** |
| # of bytes/s to send for 24 clients with an update rate of 16ms | 21.375KB / 0.016s = 1335.94KB/s = **1.3MB/s** | 8.57KB / 0.016s = 535.63KB/s = **0.52MB/s**

### CPU

Net64+ server is written in JavaScript and runs with Node.js, which uses Google's super fast V8 engine.
It is platform independent and you don't have to run an emulator for hosting a dedicated server. However Gzip compression requires CPU, but it should not affect gameplay that much.