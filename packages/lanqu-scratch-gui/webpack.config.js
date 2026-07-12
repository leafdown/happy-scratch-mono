const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const ScratchWebpackConfigBuilder = require('scratch-webpack-configuration');

const cssModuleExceptions = [
    /\.raw\.css$/
];

const baseConfig = new ScratchWebpackConfigBuilder({
    rootPath: path.resolve(__dirname),
    enableReact: true,
    enableTs: false,
    shouldSplitChunks: false,
    cssModuleExceptions
})
    .setTarget('browserslist')
    .merge({
        output: {
            publicPath: '',
            assetModuleFilename: 'static/assets/[name].[hash][ext][query]'
        },
        resolve: {
            symlinks: false
        }
    })
    .addModuleRule({
        test: /\.(svg|png|wav|mp3|gif|jpg)$/,
        resourceQuery: /^$/,
        type: 'asset'
    });

// Dist library build (bundles react etc, like scratch-gui standalone).
const distConfig = baseConfig.clone()
    .merge({
        entry: {
            'lanqu-scratch-gui': path.join(__dirname, 'src/index.js')
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            publicPath: 'auto'
        }
    });

// Playground build (dev server + html).
const buildConfig = baseConfig.clone()
    .enableDevServer(process.env.PORT || 8602)
    .merge({
        entry: {
            gui: './src/playground/render-gui.jsx',
            player: './src/playground/player.jsx',
            blocksonly: './src/playground/blocks-only.jsx'
        },
        output: {
            path: path.resolve(__dirname, 'build'),
            publicPath: ''
        }
    })
    .addPlugin(new HtmlWebpackPlugin({
        chunks: ['gui'],
        template: 'src/playground/index.ejs',
        title: 'Lanqu Scratch GUI'
    }))
    .addPlugin(new HtmlWebpackPlugin({
        chunks: ['player'],
        template: 'src/playground/index.ejs',
        filename: 'player.html',
        title: 'Lanqu Scratch GUI: Player'
    }))
    .addPlugin(new HtmlWebpackPlugin({
        chunks: ['blocksonly'],
        template: 'src/playground/index.ejs',
        filename: 'blocks-only.html',
        title: 'Lanqu Scratch GUI: Blocks Only'
    }))
    .addPlugin(new CopyWebpackPlugin({
        patterns: [
            {
                from: 'static',
                to: 'static',
                noErrorOnMissing: true
            },
            {
                from: '../../node_modules/scratch-blocks/media',
                to: 'static/blocks-media/default'
            },
            {
                from: '../../node_modules/scratch-blocks/media',
                to: 'static/blocks-media/high-contrast'
            },
            {
                context: '../../node_modules/@scratch/scratch-vm/dist/web',
                from: 'extension-worker.{js,js.map}',
                noErrorOnMissing: true
            }
        ]
    }));

if (!process.env.CI) {
    buildConfig.addPlugin(new webpack.ProgressPlugin());
    distConfig.addPlugin(new webpack.ProgressPlugin());
}

const buildDist = process.env.NODE_ENV === 'production' || process.env.BUILD_TYPE === 'dist';

switch (process.env.BUILD_TYPE) {
case 'dist':
    module.exports = distConfig.get();
    break;
default:
    module.exports = buildDist ? buildConfig.get() : buildConfig.get();
}
