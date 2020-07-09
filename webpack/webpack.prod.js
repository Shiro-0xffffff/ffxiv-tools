/**
 * Webpack 配置 - prod 环境
 */
const path = require('path')
const { merge } = require('webpack-merge')

// 插件

// 公共配置
const commonConfig = require('./webpack.common')

module.exports = merge(commonConfig, {
  // 生产模式
  mode: 'production',

  // 输出
  output: {
    filename: 'js/[name].[chunkhash:8].js',
    path: path.resolve(__dirname, '../dist'),
    publicPath: '/',
  },

  devtool: 'source-map',

  // 压缩
  optimization: {
    splitChunks: {
      name: true,
      cacheGroups: {
        'vendor': {
          name: 'vendor',
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
          priority: 1,
        },
      },
    },
    runtimeChunk: true,
  },

  // 插件
  plugins: [
  ],

  // 设置信息展示
  stats: 'normal',
})
