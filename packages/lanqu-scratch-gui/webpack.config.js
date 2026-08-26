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
// publicPath MUST be an absolute path ('/scratch3/'), not 'auto'.
// webpack's 'auto' publicPath relies on import.meta.url / document.currentScript,
// which don't work for a UMD library build (output.library.type umd2) loaded via
// a <script> tag. webpack silently falls back to '/', so runtime chunk URLs
// (fetch-worker, tutorial steps) resolve to /chunks/... instead of /scratch3/chunks/...
// — they 404 against the SPA and return index.html, breaking scratch-storage's
// FetchWorkerTool (Unexpected token '<') and cancelling all asset fetches.
//
// scratch-storage's FetchWorkerTool creates its worker via
// `new URL('./FetchWorkerTool.worker', import.meta.url)`. When webpack compiles
// this from source (the published dist/ isn't always present), it emits a nested
// webpack runtime whose publicPath is NOT controlled by output.publicPath — it
// falls back to '/'. workerPublicPath overrides that nested runtime's chunk
// base, so the worker resolves to /scratch3/chunks/fetch-worker.*.js.
const LANQU_PUBLIC_PATH = process.env.LANQU_PUBLIC_PATH || '/scratch3/';
const distConfig = baseConfig.clone()
    .merge({
        entry: {
            'lanqu-scratch-gui': path.join(__dirname, 'src/index.js')
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            publicPath: LANQU_PUBLIC_PATH,
            workerPublicPath: LANQU_PUBLIC_PATH
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
            // Absolute public path matching the teaching-open deployment location
            // (web/public/scratch3/ served at /scratch3/). Worker URLs resolve
            // against this so fetch-worker loads from /scratch3/chunks/ not /chunks/.
            publicPath: process.env.LANQU_PUBLIC_PATH || '/scratch3/'
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
            },
            {
                // scratch-storage fetch workers (loaded at runtime for asset fetches)
                context: '../../node_modules/scratch-storage/dist/web',
                from: 'chunks/fetch-worker.*.{js,js.map}',
                to: 'chunks/[name][ext]',
                noErrorOnMissing: true
            },
            {
                // scratch-gui built assets: tutorial icons, library images, etc.
                context: '../scratch-gui/dist',
                from: 'static/**/*',
                to: '.',
                noErrorOnMissing: true
            },
            {
                // scratch-gui built chunks: tutorial steps, fetch-worker variants
                context: '../scratch-gui/dist',
                from: 'chunks/**/*',
                to: '.',
                noErrorOnMissing: true
            }
        ]
    }));

if (!process.env.CI) {
    buildConfig.addPlugin(new webpack.ProgressPlugin());
    distConfig.addPlugin(new webpack.ProgressPlugin());
}

// scratch-storage's FetchWorkerTool creates its worker via
// `new Worker(new URL('./FetchWorkerTool.worker', import.meta.url))`. When webpack
// compiles this from source it emits a nested webpack runtime whose publicPath
// is hardcoded to '/' — unaffected by output.publicPath / output.workerPublicPath
// in a UMD library build. The worker URL therefore resolves to /chunks/...
// instead of /scratch3/chunks/..., 404s against the SPA fallback, and returns
// index.html (Unexpected token '<'), which breaks scratch-storage and cancels
// every asset fetch.
//
// Fix at runtime: wrap the global Worker constructor so any worker URL pointing
// at /chunks/fetch-worker.*.js is rewritten to /scratch3/chunks/... before the
// worker is spawned. BannerPlugin prepends this to the UMD bundle so it runs
// before scratch-storage initializes.
const LANQU_WORKER_REWRITE_BANNER = [
    '(function(){',
    '  if (typeof window==="undefined") return;',
    '  var O = window.Worker;',
    '  if (!O || O.__lanquPatched) return;',
    '  function W(u, o){',
    '    if (typeof u==="string" && u.indexOf("/chunks/fetch-worker")!==-1 && u.indexOf("/scratch3/")===-1){',
    '      u = u.replace("/chunks/", "/scratch3/chunks/");',
    '    }',
    '    return new O(u, o);',
    '  }',
    '  W.__lanquPatched = true;',
    '  W.prototype = O.prototype;',
    '  window.Worker = W;',
    '})();'
].join('');

const buildDist = process.env.NODE_ENV === 'production' || process.env.BUILD_TYPE === 'dist';

// Apply the worker-URL rewrite banner to both the dist library build (loaded by
// /scratch3/index.html via lanqu-scratch-gui.js) AND the playground build (loaded
// by /scratch3/player.html, /scratch3/blocks-only.html via gui.js/player.js/
// blocksonly.js). Both have the same nested-runtime publicPath bug — the player
// page also uses scratch-storage to fetch project assets, so its worker must be
// rewritten too, otherwise project assets fail to load and works display partly.
distConfig.addPlugin(new webpack.BannerPlugin({
    raw: true,
    banner: LANQU_WORKER_REWRITE_BANNER,
    entryOnly: true
}));
buildConfig.addPlugin(new webpack.BannerPlugin({
    raw: true,
    banner: LANQU_WORKER_REWRITE_BANNER,
    entryOnly: true
}));

switch (process.env.BUILD_TYPE) {
case 'dist':
    module.exports = distConfig.get();
    break;
default:
    module.exports = buildDist ? buildConfig.get() : buildConfig.get();
}
