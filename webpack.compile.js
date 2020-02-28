const webpack = require('webpack')
const path = require('path')

const [ major, minor ] = process.env.npm_package_compatVersion.split('.')

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
        COMPAT_VERSION: process.env.npm_package_compatVersion,
        IS_EXECUTABLE: true,
        MAJOR: major,
        MINOR: minor
      }),
      new webpack.IgnorePlugin(/cws_(darwin|linux|win32)_.*/)
      // TODO add minification
      // new MinifyPlugin()
    ],
    resolve: {
      extensions: [ '.js', '.ts', '.json' ]
    },
    externals: /^.*(cws_|Release\/farmhash).*$/,
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
                      node: '12.14.1'
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
