const nexe = require('nexe')
const fs = require('fs')
const path = require('path')
const pjson = require('./package.json')

const supportedPlatforms = [
  [ 'win32', 'windows', 'x64' ],
  [ 'linux', 'linux', 'x64' ]
]

for (const [ platform, platformName, arch ] of supportedPlatforms) {
  build(platform, platformName, arch)
}

function build (platform, platformName, arch) {
  const buildPath = `./compile/index_${platform}-${arch}.js`

  fs.writeFileSync(
    buildPath,
    String(fs.readFileSync('./compile/index.js'))
      .replace(/ \.\/uws_/g, ` require("./uws_`)
      .replace(/\.node;/g, `.node");`)
      .replace(/\.node /g, `.node") `)
      .replace(
        `./build/Release/farmhash`,
        `module.exports = require("./farmhash.node_${platform}_57");`
      )
  )

  nexe.compile({
    input: buildPath,
    output: path.join('compile', `net64plus-server_${pjson.version}_${platform}-${arch}`),
    target: `${platformName}-${arch}-8.15.0`,
    native: {
      uws: {
        additionalFiles: [
          `./compile/uws_${platform}_57.node`
        ]
      },
      farmhash: {
        additionalFiles: [
          './compile/farmhash.node'
        ]
      }
    }
  })
}
