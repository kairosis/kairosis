const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDev = process.env.NODE_ENV === 'development';

module.exports = {
  mode:    isDev ? 'development' : 'production',
  devtool: isDev ? 'cheap-module-source-map' : false,
  target:  'web',
  entry:  path.resolve(__dirname, 'src/renderer/index.tsx'),
  output: {
    path:     path.resolve(__dirname, '../../dist/apps/electron/renderer'),
    filename: 'index.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: { configFile: path.resolve(__dirname, 'tsconfig.renderer.json') },
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ global: 'globalThis' }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
    }),
  ],
  devServer: {
    port:   4000,
    hot:    true,
    static: path.resolve(__dirname, '../../dist/apps/electron/renderer'),
  },
};
