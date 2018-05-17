# Net64+ Server

This is a dedicated server for Net64 aka Sm64O, that uses the Websocket protocol.

## Server List

There is a [public server list](https://smmdb.ddns.net/net64) of all Net64+ server, that have enabled listing.

## Downloads

For user servers, there is a prebuilt Windows version with a few limitations, but it is much easier to host in general.
The prebuilt version is bundled with the [Net64+ Client](https://github.com/Tarnadas/net64plus/releases).

## Installation

- download and install [Node](https://nodejs.org/en/download/current/)
- `git clone` this repository or [download as zip](https://github.com/Tarnadas/sm64o-ded/archive/master.zip)
- modify `settings.json`
```js
{
  "port": "3678", // make sure your port is forwarded
  "enableWebHook": false, // set this to true, if you want your server to be listed
  "gamemode": 1, // the gamemode that will be used when the server boots
  "enableGamemodeVote": true, // whether gamemode voting should be enabled
  "name": "A Net64+ Server", // display name for public server list
  "domain": "", // domain of your server for public server list. keep it empty, if you don't have a domain
  "description": "The **best** Net64+ server ever\n\n:unicorn_face:", // description for public server list
  "apiKey": "" // this is required, if you want your server to be listed
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
$ pm2 start ./dist --name="net64 server"
```
