# Net64+ Server

[![Discord](https://discord.gg/net64)](https://discord.gg/SPZsgSe)

Net64 aka SM64O allows playing Super Mario 64 in an online multiplayer mode. Net64+ is the official continuation of the program and features an integrated server list.

This repository includes the dedicated server software. For the client please visit the [client repository](https://github.com/Tarnadas/net64plus).

## Server List

There is a [public server list](https://smmdb.ddns.net/net64) of all Net64+ server, that have enabled listing.

## Downloads

For user servers, there is a prebuilt Windows version with a few limitations, but it is much easier to host in general.
The prebuilt version is bundled with the [Net64+ Client](https://github.com/Tarnadas/net64plus/releases), but you can also download it in the [release section](https://github.com/Tarnadas/net64plus-server/releases).

## Installation

- download and install [Node 8](https://nodejs.org/en/download/)
  - you can try using a later version of Node, but you will need to install C++ compilers
- `git clone` this repository or [download as zip](https://github.com/Tarnadas/net64plus-server/archive/master.zip)
- modify `settings.json`
```js
{
  "port": "3678", // make sure your port is forwarded
  "enableWebHook": false, // set this to true, if you want your server to be listed
  "gamemode": 1, // the initial gamemode
  "enableGamemodeVote": true, // whether gamemode voting should be enabled
  "name": "A Net64+ Server", // display name for public server list
  "domain": "", // domain of your server for public server list. keep it empty, if you don't have a domain
  "description": "The **best** Net64+ server ever\n\n:unicorn_face:", // description for public server list
  "apiKey": "" // this is required, if you want your server to be listed
}
```
- (OPTIONAL) if you want your server to be listed, go to [SMMDB](https://smmdb.ddns.net), login with Google, go to profile and get your API key
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
$ npm run build
$ pm2 start ./dist --name="net64 server"
```