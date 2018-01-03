const webpack = require('webpack')
const path = require('path')

module.exports = [
  {
    target: 'node',
    entry: path.join(__dirname, 'src/index.js'),
    output: {
      filename: 'index.js',
      path: path.join(__dirname, 'compile')
    },
    node: {
      __dirname: false,
      __filename: false
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        NODE_ENV: 'production',
        VERSION: process.env.npm_package_version,
        TARGET_ENV: 'win32'
      }),
      new webpack.IgnorePlugin(/^uws$/)
    ],
    module: {
      loaders: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            babelrc: false,
            presets: [
              ['env', {
                targets: {
                  node: 'current'
                }
              }]
            ]
          }
        },
        {
          test: /\.node$/,
          loader: 'node-loader'
        }
      ]
    }
  }
]
