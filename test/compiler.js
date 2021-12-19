/**
 * MIT License
 *
 * Copyright (c) 2019 Ruby Allison Rose
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// External Library Imports
const InertEntryPlugin = require('inert-entry-webpack-plugin');
const memoryfs = require('memory-fs');
const unionfs = require('unionfs');
const webpack = require('webpack');

// Standard Library Imports
const path = require('path');
const fs = require('fs');

/***
 * Applies a webpack build to the input source code for testing the loader
 * this library maintains. Third party loaders are applied to accomodate the
 * expected operating parameters of our internal loader. The options argument
 * is available explicitly for changeing the operational parameters of the
 * loader we're testing.
 */
module.exports = (code, options = {}) => {
	// Create memory filesystem for holding our compiled test code.
	let vfs = new memoryfs();

	// Create the in-memory file for holding out source so that webpack may
	// access it.
	vfs.mkdirpSync("/memory/");
	vfs.writeFileSync(path.join("/memory/", "test.css"), code, "utf-8");

	// Join the native filesystem and the memory filesystem so we can
	// resolve our webpack loaders.
	unionfs.ufs
		.use(fs)
		.use(vfs);

  const compiler = webpack({
		// Make sure the context doesn't change so webpack can find out loaders.
		// which means we have to resolve the input file to an absolute path.
    entry: '/memory/test.css',
    output: {
      path: "/memory/",
      filename: '[name].qss',
    },
    module: {
      rules: [
					{
		        test: /\.css$/,
						exclude: /node_modules/,
		        use: [
							// Because the css-loader outputs a javascript module, we want to
							// use the extract loader to remove the javascript bootstrap
							// and access our native source.
							"extract-loader",
							{
								loader: path.resolve(__dirname, '../lib/qss-translation-loader.js'),
								options: options
							},
							// Chain the css-loader first as we want our loader to be able to
							// be used inside javascript module format.
							"css-loader"
						]
	      }
			]
    },
		plugins: [
			// Allows webpack to use non-javascript files as module entries.
			new InertEntryPlugin(),
		]
  });

	// These are needed for making the virtual filesystem available to webpack.
	compiler.resolvers.normal.fileSystem = unionfs.ufs;
	compiler.resolvers.context.fileSystem = unionfs.ufs;
	compiler.inputFileSystem = unionfs.ufs;
  compiler.outputFileSystem = unionfs.ufs;

	// XXX:
	//	for some reason this was throwing an error and webpack was expecting
	//	a function which accepts the same arguments as path.join. This is a
	//	temporary fix. It doesn't seem to break anything atm.
	//
	//compiler.outputFileSystem.join = path.join;
	compiler.outputFileSystem.join = function(...args){ return };

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err || stats.hasErrors()) {
				// Make sure we redirect the errors output from webpack to the console
				// when they happen so we know to investigate them.
				console.error(stats.compilation.errors);

				// and reject with our run error data.
				reject(err);
			}

			// We only have one output file so we can simplify the stats output to
			// the result of our compilation.
      resolve(stats.compilation.assets['main.qss'].source());
    });
  });
};
