# Net64+ Server

[![GitHub All Releases](https://img.shields.io/github/downloads/Tarnadas/net64plus-server/total)](https://github.com/Tarnadas/net64plus-server/releases)
[![GitHub Releases](https://img.shields.io/github/downloads/Tarnadas/net64plus-server/latest/total)](https://github.com/Tarnadas/net64plus-server/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/tarnadas/net64plus-server)](https://hub.docker.com/r/tarnadas/net64plus-server)
[![Docker Image Size](https://img.shields.io/docker/image-size/tarnadas/net64plus-server)](https://hub.docker.com/r/tarnadas/net64plus-server)
[![LGTM Grade](https://img.shields.io/lgtm/grade/javascript/github/Tarnadas/net64plus)](https://lgtm.com/projects/g/Tarnadas/net64plus)
[![Discord](https://discordapp.com/api/guilds/559982917049253898/widget.png)](https://discord.gg/GgGUKH8)
[![Build Status](https://api.travis-ci.org/Tarnadas/net64plus-server.svg?branch=master)](https://travis-ci.org/Tarnadas/net64plus-server)
[![Coverage Status](https://coveralls.io/repos/github/Tarnadas/net64plus-server/badge.svg?branch=master)](https://coveralls.io/github/Tarnadas/net64plus-server?branch=master)

Net64 aka SM64O allows playing Super Mario 64 in an online multiplayer mode. Net64+ is the official continuation of the program and features an integrated server list.

This repository includes the dedicated server software. For the client please visit the [client repository](https://github.com/Tarnadas/net64plus).

## Server List

There is a [public server list](https://net64-mod.github.io/servers) of all Net64+ server, that have enabled listing.

## Downloads

For user servers, there is a prebuilt Windows version with a few limitations, but it is much easier to host in general.
The prebuilt version is bundled with the [Net64+ Client](https://github.com/Tarnadas/net64plus/releases), but you can also download it in the [release section](https://github.com/Tarnadas/net64plus-server/releases).

## Installation

- download and install [Node 12](https://nodejs.org/en/download/)
  - you can try using a later version of Node, but you will need to install C++ compilers
    - on Windows you can do the following: `npm i -g windows-build-tools` / or use `yarn global add`
- install yarn. It's a package manager for npm, which is generally faster
- `git clone` this repository or [download as zip](https://github.com/Tarnadas/net64plus-server/archive/master.zip)
- modify `settings.json`

```js
{
  "port": "3678", // make sure your port is forwarded
  "enableWebHook": false, // set this to true, if you want your server to be listed
  "gamemode": 1, // the initial gamemode
  "enableGamemodeVote": true, // whether gamemode voting should be enabled
  "passwordRequired": false, // whether password is required to join this server
  "name": "A Net64+ Server", // display name for public server list
  "domain": "", // domain of your server for public server list. keep it empty, if you don't have a domain
  "description": "The **best** Net64+ server ever\n\n:unicorn_face:", // description for public server list
  "apiKey": "" // this is required, if you want your server to be listed
}
```

- (OPTIONAL) if you want your server to be listed, go to [SMMDB](https://smmdb.net), login with Google, go to profile and get your API key
  - _Do not share your API key, because it gives full access to your account_
  - You can only list one server per API key
  - `name` will be shortened to 40 characters at most
  - `description` will be shortened to 200 characters at most
  - `description` supports [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) and [emojis](https://raw.githubusercontent.com/omnidan/node-emoji/master/lib/emoji.json)
- open a terminal in the folder of your server and execute the following commands

```bash
$ yarn install
$ yarn start
```

- (OPTIONAL) if you want to run your server indefinitely with auto restarts, I suggest to use pm2

```bash
$ yarn global add pm2
$ yarn build
$ pm2 start ./dist --name="net64 server"
```

## Docker

You can also pull [Net64+ Server from Docker Hub](https://hub.docker.com/r/tarnadas/net64plus-server).

Make sure that [Docker is installed](https://docs.docker.com/get-docker/) and running.
Then execute the following commands:

```bash
$ docker run --rm -it -p 3678:3678 tarnadas/net64plus-server
$
$ # or run it detached in background
$ docker run --rm -it -d -p 3678:3678 tarnadas/net64plus-server
```

You will still need to port-forward in order for this to work.

The Docker Container accepts all arguments that the regular Net64+ Server executable accepts as well.

```bash
Optional arguments:
  -h, --help            Show this help message and exit.
  --port PORT, -P PORT
  --gamemode GAMEMODE, -g GAMEMODE
  --disableGamemodeVote, -G
  --passwordRequired, -pr
  --password PASSWORD, -p PASSWORD
  --name NAME, -n NAME
  --domain DOMAIN, -D DOMAIN
  --description DESCRIPTION, -d DESCRIPTION
  --enableWebHook, -w
  --apiKey APIKEY, -k APIKEY
  --verbose, -v
  --skipPortCheck, -s
```

An example to host a public server on port 8080:

```bash
$ docker run --rm -it -d -p 8080:8080 tarnadas/net64plus-server -P 8080 -w -k $API_KEY -n "Public Net64+ Server" -d "This is a publicly hosted Net64+ Server"
```
