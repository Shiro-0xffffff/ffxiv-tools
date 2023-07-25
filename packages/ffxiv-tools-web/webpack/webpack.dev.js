/**
 * Webpack 配置 - 开发环境
 */
const { merge } = require('webpack-merge')

// 插件

// 公共配置
const commonConfig = require('./webpack.common')

module.exports = merge(commonConfig, {
  // 开发模式
  mode: 'development',

  // 输出
  output: {
    filename: 'js/[name].js',
    publicPath: `http://127.0.0.1:4600/`,
  },

  // DEV 配置
  devtool: 'eval-cheap-module-source-map',
  devServer: {
    host: '127.0.0.1',
    port: 4600,
    historyApiFallback: { disableDotRule: true },
  },
})
