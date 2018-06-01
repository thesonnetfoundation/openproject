// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

var webpack = require('webpack');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var pathConfig = require('./rails-plugins.conf');
var autoprefixer = require('autoprefixer');
var dllManifest = require('./dist/vendors-dll-manifest.json')

var TypeScriptDiscruptorPlugin = require('./webpack/typescript-disruptor.plugin.js');
var ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
var HappyPack = require('happypack');
var MiniCssExtractPlugin = require("mini-css-extract-plugin");
var CleanWebpackPlugin = require('clean-webpack-plugin');
var UglifyJsPlugin = require('uglifyjs-webpack-plugin');
var AngularCompilerPlugin = require('@ngtools/webpack').AngularCompilerPlugin;

var mode = (process.env['RAILS_ENV'] || 'production').toLowerCase();
var production = (mode !== 'development');
var debug_output = (!production || !!process.env['OP_FRONTEND_DEBUG_OUTPUT']);

var node_root = path.resolve(__dirname, 'node_modules');
var output_root = path.resolve(__dirname, '..', 'app', 'assets', 'javascripts');
var translations_root = path.resolve(__dirname, '..', 'config', 'locales', 'crowdin');
var bundle_output = path.resolve(output_root, 'bundles');

var pluginEntries = _.reduce(pathConfig.pluginNamesPaths, function (entries, pluginPath, name) {
  entries[name.replace(/^openproject\-/, '')] = path.resolve(pluginPath, 'frontend', 'app', name + '-app.js');
  return entries;
}, {});

var pluginAliases = _.reduce(pathConfig.pluginNamesPaths, function (entries, pluginPath, name) {
  entries[name] = path.basename(pluginPath);
  return entries;
}, {});

/** Extract available locales from openproject-translations plugin */
var localeIds = ['en'];
fs.readdirSync(translations_root).forEach(function (file) {
  var matches = file.match(/^js-(.+)\.yml$/);
  if (matches && matches.length > 1) {
    localeIds.push(matches[1]);
  }
});

var loaders = [
  {
    test: /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/,
    include: [
      path.resolve(__dirname, 'common'),
      path.resolve(__dirname, 'src'),
      path.resolve(__dirname, 'tests')
    ].concat(_.values(pathConfig.pluginNamesPaths)),
    exclude: [
      path.resolve(__dirname, 'legacy')
    ],
    use: [
      {
        loader: '@ngtools/webpack'
      }

    ]
  },
  {
    test: /\.css$/,
    use: [
      MiniCssExtractPlugin.loader,
      'css-loader',
      'postcss-loader'
    ]
  },
  {
    test: /\.html$/,
    use: [
      'raw-loader'
    ]
  },
  {
    test: /\.png$/,
    use: [
      {
        loader: 'url-loader',
        options: {
          limit: '100000',
          mimetype: 'image/png'
        }
      }
    ]
  },
  {
    test: /\.gif$/,
    use: ['file-loader']
  },
  {
    test: /\.jpg$/,
    use: ['file-loader']
  },
];

function getWebpackMainConfig() {
  config = {
    mode: mode,

    devtool: 'source-map',

    context: path.resolve(__dirname, 'src'),

    entry: _.merge({
      'core-app': './main'
    }, pluginEntries),

    output: {
      filename: 'openproject-[name].js',
      path: bundle_output,
      publicPath: '/assets/bundles/'
    },

    module: {
      rules: loaders
    },

    resolve: {
      modules: [
        'node_modules',
      ],

      extensions: ['.ts', '.tsx', '.js'],

      // Allow empty import without extension
      // enforceExtension: true,

      alias: _.merge({
        'locales': './../../config/locales',
        'core-app': path.resolve(__dirname, 'src', 'app'),
        'core-components': path.resolve(__dirname, 'src', 'app', 'components'),

        'select2': path.resolve(__dirname, 'vendor', 'select2'),
        'lodash': path.resolve(node_root, 'lodash', 'lodash.min.js'),
        // prevents using crossvent from dist and by that
        // reenables debugging in the browser console.
        // https://github.com/bevacqua/dragula/issues/102#issuecomment-123296868
        'crossvent': path.resolve(node_root, 'crossvent', 'src', 'crossvent.js')
      }, pluginAliases)
    },

    externals: {
      "I18n": "I18n"
    },

    optimization: {
      splitChunks: {
        cacheGroups: {
          common: {
            name: "common",
            chunks: "initial",
            minChunks: 2
          }
        }
      }
    },

    plugins: [
      // Add a simple fail plugin to return a status code of 2 if
      // errors are detected (this includes TS warnings)
      // It is ONLY executed when `ENV[CI]` is set or `--bail` is used.
      TypeScriptDiscruptorPlugin,

      // required for Angular (2+) to avoid error message:
      // > WARNING in ../node_modules/@angular/core/@angular/core.es5.js
      // > 5659:15-36 Critical dependency: the request of a dependency is an expression
      new webpack.ContextReplacementPlugin(
        /angular([\\\/])core/,
        path.resolve(__dirname, '../src')
      ),

      // Define modes for debug output
      new webpack.DefinePlugin({
        DEBUG: !!debug_output,
        PRODUCTION: !!production
      }),

      // Clean the output directory
      new CleanWebpackPlugin(['bundles'], {
        root: output_root,
        verbose: true,
        exclude: ['openproject-vendors.js']
      }),

      // Reference the vendors bundle
      new webpack.DllReferencePlugin({
        context: path.resolve(__dirname),
        manifest: dllManifest
      }),

      new AngularCompilerPlugin({
        tsConfigPath: path.resolve(__dirname, './tsconfig.json'),
        mainPath: 'src/main.ts',
        entryModule: 'src/app/app.module#AppModule',
        sourceMap: true
      }),

      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: "openproject-[name].css",
        chunkFilename: "[id].css"
      }),

      // Global variables provided in all entries
      // We should avoid this since it reduces webpack
      // strengths to discover dependency use.
      new webpack.ProvidePlugin({
        '_': 'lodash'
      }),

      // Restrict loaded ngLocale locales to the ones we load from translations
      new webpack.ContextReplacementPlugin(
        /(angular-i18n)/,
        new RegExp('angular-locale_(' + localeIds.join('|') + ')\.js$', 'i')
      ),

      // Restrict loaded moment locales to the ones we load from translations
      new webpack.ContextReplacementPlugin(/moment[\/\\]locale$/, new RegExp('(' + localeIds.join('|') + ')\.js$', 'i')),

      // Uncomment to analyze current bundle size
      // new BundleAnalyzerPlugin()

      // Uncomment to analyze potential cyclic dependencies between, e.g., Angular services.
      // For simple imports in webpack, these are not a problem.
      // new CircularDependencyPlugin({
      //   // exclude detection of files based on a RegExp
      //   exclude: /node_modules/,
      //   // add errors to webpack instead of warnings
      //   failOnError: false,
      //   // set the current working directory for displaying module paths
      //   cwd: process.cwd(),
      // })
    ]
  };

  if (production) {
    console.log("Applying webpack.optimize plugins for production.");
    // Add compression and optimization plugins
    // to the webpack build.
    config.optimization.minimizer = [
      // we specify a custom UglifyJsPlugin here to get source maps in production
      new UglifyJsPlugin({
        cache: true,
        parallel: true,
        uglifyOptions: {
          compress: true,
          mangle: true,
          ecma: 5,
        },
        sourceMap: true
      })
    ];


    config.plugins.push(
      new webpack.LoaderOptionsPlugin({
        // Let loaders know that we're in minification mode
        minimize: true
      })
    );
  }

  return config;
}

module.exports = getWebpackMainConfig;
