/**
 * Webpack 配置 - 公共配置
 */
const path = require('path')

// 插件
const autoprefixer = require('autoprefixer')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TsConfigPathsPlugin = require('tsconfig-paths-webpack-plugin')

module.exports = {
  // 应用入口
  entry: ['./src'],

  // 主路径
  context: path.resolve(__dirname, '../'),

  // 路径及别名配置
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.less'],
    plugins: [
      new TsConfigPathsPlugin({
        configFile: './tsconfig.json',
        extensions: ['.ts', '.tsx', '.js', '.less'],
      }),
    ],
  },

  // loader 配置
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [{
          loader: 'ts-loader',
        }],
      },
      {
        test: /(?<!\.module)\.less$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1 } },
          { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer] } } },
          { loader: 'less-loader' },
        ],
      },
      {
        test: /\.module\.less$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1, modules: true } },
          { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer] } } },
          { loader: 'less-loader' },
        ],
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1 } },
          { loader: 'postcss-loader', options: { postcssOptions: { plugins: [autoprefixer] } } },
        ],
      },
      /*{
        test: /\.(jpe?g|png|gif|svg)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
              name: '/assets/[name].[hash:8].[ext]',
              publicPath: CONSTANTS.DEV_PATH,
            },
          },
        ],
      },*/
    ],
  },

  // 插件
  plugins: [
    // html 模板处理
    new HtmlWebpackPlugin({ template: './src/index.html' }),
  ],

  performance: {
    hints: false,
  },

  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
  },

  stats: 'normal',
}
