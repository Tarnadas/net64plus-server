const webpack = require('webpack')
const path = require('path')
const MinifyPlugin = require('babel-minify-webpack-plugin')

const [ major, minor, patch ] = process.env.npm_package_compatVersion.split('.')

module.exports = [
  {
    target: 'node',
    entry: path.join(__dirname, 'src/index.ts'),
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
        TARGET_ENV: 'win32',
        MAJOR: major,
        MINOR: minor,
        PATCH: patch
      }),
      new webpack.IgnorePlugin(/^uws$/)
      // TODO add minification
      // new MinifyPlugin()
    ],
    resolve: {
      extensions: [ '.js', '.ts', '.json' ]
    },
    externals: /^.*(uws_win32|Release\/farmhash).*$/,
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
