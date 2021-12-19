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


// Internal Library Includes
const compile = require('./compiler.js');
const jestcss = require('./jestcss.js');

// Standard Library Includes
const path = require('path');
const fs = require('fs');


// Change the operating directory to where our styles are located.
__testdir = path.join(__dirname, "stylesheets");



test('Loader doesn\'t modify the control group.', async () => {
	let code = fs.readFileSync(path.join(__testdir, "control.css")).toString();

  let output = await compile(code);

	// This is our control group test, the output should be equivalent to the input.
  expect(output).toBe(code);
});

/* Extract the realavent tests from our stylesheet test files. */
fs.readdirSync(__testdir).forEach((stylesheet)=>{
	if (stylesheet == "control.css") return; // Skip our control group.

	// Open and grab all our styles from their respective files.
	let filePath = path.join(__testdir, stylesheet);
	let style = fs.readFileSync(filePath).toString();

	//console.log(`Running tests for '${filePath}'`);
	jestcss(compile, style, { source: filePath, async: true });

	//console.log(JSON.stringify(ast.stylesheet.rules));
});
