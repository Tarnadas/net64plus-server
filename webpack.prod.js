const webpack = require('webpack')
const path = require('path')
const MinifyPlugin = require('babel-minify-webpack-plugin')
const JavaScriptObfuscator = require('webpack-obfuscator')

const [ major, minor, patch ] = process.env.npm_package_compatVersion.split('.')

module.exports = [
  {
    target: 'node',
    entry: path.join(__dirname, 'src/index.ts'),
    output: {
      filename: 'index.js',
      path: path.join(__dirname, 'dist')
    },
    // devtool: 'source-map',
    node: {
      __dirname: false,
      __filename: false
    },
    plugins: [
      new webpack.EnvironmentPlugin({
        NODE_ENV: 'production',
        VERSION: process.env.npm_package_version,
        MAJOR: major,
        MINOR: minor,
        PATCH: patch
      }),
      new webpack.IgnorePlugin(/^\.\.\/compile\/uws$/),
      new MinifyPlugin(),
      new JavaScriptObfuscator()
    ],
    resolve: {
      extensions: [ '.js', '.ts', '.json' ]
    },
    externals: [require('webpack-node-externals')()],
    module: {
      loaders: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
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
              loader: 'awesome-typescript-loader'
            }
          ]
        }
      ]
    }
  }
]
