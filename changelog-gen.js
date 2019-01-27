const standardChangelog = require('standard-changelog')
const pjson = require('./package.json')
const fs = require('fs')
const path = require('path')

const changelogPath = path.join(__dirname, 'changelog')
if (!fs.existsSync(changelogPath)) {
  fs.mkdirSync(changelogPath)
}

const changelogFilePath = path.join(changelogPath, `${pjson.version}.md`)
const fileStream = fs.createWriteStream(changelogFilePath, {
  encoding: 'utf8'
})
standardChangelog()
  .pipe(fileStream)
