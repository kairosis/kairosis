const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode:    'production',
  devtool: false,
  context: __dirname,
  entry: {
    background: './src/background.ts',
    popup:      './src/popup.ts',
  },
  output: {
    path:     path.resolve(__dirname, '../../dist/apps/browser-extension'),
    filename: '[name].js',
    clean:    true,
  },
  module: {
    rules: [
      {
        test:    /\.tsx?$/,
        use:     {
          loader:  'ts-loader',
          options: { configFile: path.resolve(__dirname, 'tsconfig.json') },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'popup.html' },
        { from: 'icons', to: 'icons', noErrorOnMissing: true },
      ],
    }),
  ],
};
