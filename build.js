const nexe = require('nexe')
const fs = require('fs')

fs.writeFileSync('./compile/index.js', String(fs.readFileSync('./compile/index.js')).replace('./uws_win32_57.node', 'require("./uws_win32_57.node")'))

nexe.compile({
  input: './compile/index.js',
  output: 'net64plus-ded',
  native: {
    uws: {
      additionalFiles: [
        './compile/uws_win32_57.node'
      ]
    }
  }
})
