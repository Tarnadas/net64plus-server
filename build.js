const nexe = require('nexe')
const fs = require('fs')
const path = require('path')
const pjson = require('./package.json')

const supportedPlatforms = [
  ['win32', 'windows', 'x64'],
  ['linux', 'linux', 'x64']
]

if (process.env.DOCKER) {
  build('linux', 'linux', 'x64', '12.16.2')
} else {
  for (const [platform, platformName, arch] of supportedPlatforms) {
    build(platform, platformName, arch, '12.14.1')
  }
}

function build (platform, platformName, arch, nodeVersion) {
  const buildPath = `./compile/index_${platform}-${arch}.js`

  fs.writeFileSync(
    buildPath,
    String(fs.readFileSync('./compile/index.js'))
      .replace(
        './build/Release/farmhash.node',
        `require("../farmhash_${platform}_72.node")`
      )
      .replace(
        /return __webpack_require__.*\(`\.\/cws_\${process\.platform}_\${process\.versions\.modules}`\)/,
        // eslint-disable-next-line no-template-curly-in-string
        'return require(`../cws_${process.platform}_${process.versions.modules}`)'
      )
  )

  nexe.compile({
    input: buildPath,
    output: path.join('compile', `net64plus-server_${pjson.version}_${platform}-${arch}`),
    target: `${platformName}-${arch}-${nodeVersion}`,
    native: {
      cws: {
        additionalFiles: [
          `./compile/cws_${platform}_72.node`
        ]
      },
      farmhash: {
        additionalFiles: [
          `./compile/farmhash_${platform}_72.node`
        ]
      }
    }
  })
}
