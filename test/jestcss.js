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


// External Library Includes
const css = require('css');


/***
 * Outputs an array of sets representing the hashed paths of all
 * properties contained within the supplied object.
 */
if (!Object.prototype.hashPaths){
	// Not-So-Polyfill
	Object.defineProperty(Object.prototype, "hashPaths",{
		value: function(){
			if (this == null)
        throw new TypeError('"this" is null or not defined');

			// define an inner function for recursion into the array elements
			let inner = function(element, hash){
				if ( ( typeof element === "object" )    // avoid primitives,
					&& ( element instanceof Object   ) ){ // undefined and null values.

					let map = [];
					for (let key in element)
						map.push(inner(element[key], key));

					if (hash === undefined)
						return map.flat();

					return map.flat().map((e)=>[hash].concat(e));
				}

				else
					return [[hash]];
			};

			return inner(this);
		}
	});
}

if (!Object.prototype.getValueAtHashPath){
	Object.defineProperty(Object.prototype, "getValueAtHashPath",{
		value: function(path){
			if (this == null)
        throw new TypeError('"this" is null or not defined');

			let l = 0;
			let value = this;
			while ( l < path.length ){
				if (value[path[l]] === undefined)
					return undefined;

				value = value[path[l]];
				l++;
			}
			return value;
		}
	});
}

if (!Object.prototype.setValueAtHashPath){
	/***
	 * Obviously right now, this is defined using the latest syntax and as such
	 * it's not a polyfill. Will work on later.
	 */
	Object.defineProperty(Object.prototype, "setValueAtHashPath",{
		value: function(path, newValue){
			if (this == null)
        throw new TypeError('"this" is null or not defined');

			path = path
				.map((hash) => {
					// Sanitize the hashes to prevent js injection using eval.
					return hash
						.split("")
						.map((char)=>{
							// Escape the javascript string characters to prevent any
							// arbitray code execution. If the caller can add unescaped
							// apostrophy characters, they can control the code passed to eval.
							switch(char){
								case "\'": case "\\": case "\"": case "\`":
									return "\\".concat(char);
							}
						})
						.join("")
				})
				.map((hash)=>`['${hash}']`);

			return eval(`this${path} = newValue`);
		}
	});
}

/***
 * A function that converts object to json strings to check them for
 * equivalence. Used for simplicity over speed.
 */
function JSONEqual(a, b){
	return JSON.stringify(a) == JSON.stringify(b);
}

/***
 * This object converts an object to an array preserving indexes
 */
function objectToArray(obj){
	let output = [];
	Object.entries(obj).forEach((entry)=>{
		output[entry[0]] = entry[1];
	});
	return output;
}

/***
 * Outputs an array of sets representing the index paths of all
 * objects in a multi-dimentional array.
 */
function arrayPaths(arr){
	// define an inner function for recursion into the array elements
	let inner = (element, index) => {
		if (Array.isArray(element))
			// flatmap the initial output to squash the array biproduct
			// of mapping a recursive target, then use concat to chain the indexes of
			// each path together which will reduce any other arrays.
			return element.flatMap(inner).map((e)=>[index].concat(e));
		else
			// since the first itteration of array mapping will leave an extra
			// container array holding our recursive target outputs, we'll remove
			// it by adding an extra array object to each first level element,
			// and we'll use flatMap on the whole output to reduce the first layer.
			return [[index]];
	};
	return arr.flatMap(inner);
}

/***
 * Since we're only testing CSS syntax, We'll define our tests within that
 * language. This function will translate the css test insructions into
 * an AST.
 *
 * Only apply to rules for now. I currently see no need to support other groups.
 */
const testTypes = {
	expect: / !\%expect\%(?: )!(.+)/g,
	toBe: / !\%toBe\%(?: )!/g,
	end: / !\%end\%(?: )!/g,
};
function tokenizeTests(definition){
	// we'll declare our tests within the comment section.
	if (definition.type == "comment"){
		// for now we only have three different instructions to operate on.
		//	- expect -- the start of a test group
		//	- toBe   -- the start of the translated group
		//	- end    -- the end of the test group.

		if (definition.comment.search(testTypes.expect))
			return {
				type: "testInstruction", op: "expect", line: definition,

				// also store the extracted test name here
				testName: definition.comment.match(testTypes.expect)
			};

		else if (definition.comment.search(testTypes.toBe))
			return {type: "testInstruction", op: "toBe", line: definition};
		else if (definition.comment.search(testTypes.end))
			return {type: "testInstruction", op: "end", line: definition};
		else
			// leave comments in place so we can run tests with "white noise"
			// for better overall test quality. Even if that code is never touched
			// by the loader. Damn I really wish I had hypothesis.works right now!
			//
			// cough, cough.., actually scratch that, comments could break a raw
			// string equivalence test, which is what we're using because simplicity.
			return null; // {op: "code", line: definition};
	}
}

function parseTestDeclarations(declarations){
	let output = [];
	let isFrom = false;
	let toBe = false;
	let group = null;

	for (let operation of declarations){
		if (operation.type == "testInstruction"){
			switch(operation.op){
				case "toBe":
					if (toBe)
						throw new SyntaxError(
							"Duplicate 'toBe' instruction found inside 'expect' block.",
							operation.line.position.source,
							operation.line.position.start.line
						);
					else if (!isFrom)
						throw new SyntaxError(
							"'toBe' instruction found outside 'expect' block.",
							operation.line.position.source,
							operation.line.position.start.line
						);

					isFrom = false;
					toBe = true;
					break;;

				case "expect":
					if (toBe)
						console.warn("Ignoring unterminated 'toBe' in previous block.");
						// throw new SyntaxError(
						// 	"Ignoring unterminated 'toBe' in previous block.",
						// 	operation.line.source,
						// 	operation.line.start.line,
						// );
					else if (isFrom)
						throw new SyntaxError(
							"Duplicate 'expect' instruction found 'toBe' block.",
							operation.line.position.source,
							operation.line.position.start.line
						);
					else {
						group = { type: "test", name: operation.testName, from: [], to: [] }
						isFrom = true;
						break;;
					}
					// Passes into the end case when we are ignoring unterminated test group.

				case "end":
					if (!toBe)
							throw new SyntaxError(
								"'toBe' instruction missing before end of block.",
								operation.line.position.source,
								operation.line.position.start.line
							);
					toBe = false;
					output.push(group);
					group = null;
					break;;

				default:
					throw new SyntaxError(
						`Could not find opcode "${operation.op}"`,
						operation.line.position.source,
						operation.line.position.start.line
					);
			}
		}
		else {
			if (group === null){
				output.push(operation);
				continue;
			}

			if (isFrom)
				group.from.push(operation);
			else if (toBe)
				group.to.push(operation);
		}
	}
	return output;
}

/***
 * Return a list of hash paths to our test objects
 */
function testPaths(ast){
	return ast
		// retrieve the hash paths of our css ast
		.hashPaths()
		// Filter the paths containing type declarations
		.filter((hash)=>hash.includes("type"))
		.map((path)=>{
			// Of those path declarations check each type to see if it's container
			// is a test object and return it's container object.
			if (ast.getValueAtHashPath(path) == "test"){
				path.pop(); return path;
			}
			else
				// Replace the unnecessary objects with null pointers.
				return null;
		})
		// Filter the empty objects before they're returned
		.filter( (result) => result != null );
}

function applyToRules(fn){
	return (node) => {
		switch (node.type){
			case "rule":
				return fn(node);

			case "@media":
				return node.rules.map(applyToRules);
		}
	};
}

function findTests(collection){
	// Don't have a reason to look for tests outside of rules
	// yet, so for now that's the only place we'll look for them.
	return collection.map(applyToEachRule((rule)=>{
		chunks = [];
		rule.declarations.forEach((prop, index)=>{
			if (prop.type == "test")
				chunks.push(index);
		});
		return chunks;
	}));
}

/***
 * Damn I wish I had hypothesis.works in JS, that would make this so much
 * easier lol.
 */
function getTestCollectionsPermutatedFromRules(collection){
	return applyToRules(collection, (rule)=>{
		// collect an indexed list of our test objects.
		let chunks = [];
		rule.declarations.forEach((prop, index)=>{
			if (prop.type == "test")
				chunks.push(index);
		});

		// create a few possible permutations of the declarations
		// to test for position independant handling.
		let testPermutations = [];
		chunks
			.map(()=>shuffle(chunks))
			.filter((permutation, index, array)=>{
				// since there's absolutely no possibility that a race condition
				// can exist, we should filter out any repeated permutations.

				if (array.find((element) => JSONEqual(element, permutation)) === undefined)
					return true;
				else
					return false;
			})
			.forEach((permutation, index)=>{
				// create the test permutations, initialized by the pre-existing
				// rules with tests in place, so we can just replace the tests later.
				testPermutations.push({
					names: [],
					from: Array.from(node.rules),
					to: Array.from(node.rules),
				});

				permutation.forEach((newTestIndex, originalIndex)=>{
					// append the test names in order to the permutations so we can
					// track how they are arranged when run.
					testPermutations[index].names.push(node.rules[newTestIndex].name);

					// replace the from and to translations in place.
					testPermutations[index].from[newTestIndex] = node.rules[chunks[originalIndex]].from;
					testPermutations[index].to[newTestIndex] = node.rules[chunks[originalIndex]].to;
				});

				// flatten the code to clean up the array containers in each translation.
				testPermutations[index].from.flat();
				testPermutations[index].to.flat();
			});
		return testPermutations;
	});
}

module.exports = (compiler, style, options = {})=>{
	let ast = css.parse(style, options);

	ast = ast.stylesheet.rules.map(applyToRules((rule)=>{
		let tokenized = rule.declarations
			.map(tokenizeTests)
			.filter(definition => definition != null);

		rule.declarations = parseTestDeclarations(tokenized);

		return rule;
	}));

	let tests = testPaths(ast);
	// let stylesheetFrom = null;
	//
	// // --- Compile Control Stylesheet Version --- //
	// tests.forEach((testPath)=>{
	// 	// NOTE: Neutralize tests before assertion.
	//
	// });
	let source = options.source;
	let stackTrace = new Error().stack.split("\n").map((trace)=>trace.trim())[2];
	describe(`Running tests in ${ source || stackTrace }`, ()=>{

		describe('Running Each Test Individually', ()=>{
			tests.forEach((targetTest)=>{
				let testname = null;
				let astFrom = Object.create(ast);
				let astTo = Object.create(ast);

				// save our target test blob to avoid unnecessary recomputation.
				let targetTestGlob = targetTest.join();
				tests.forEach((testPath)=>{
					let testObj = astFrom.getValueAtHashPath(testPath);

					if (testPath.join() == targetTestGlob){
						testname = testObj.name;
						// For single test cases, replace the test objects with their
						// respective code blocks in the input and output blocks.
						astTo.setValueAtHashPath(testPath, testObj.to);
						astFrom.setValueAtHashPath(testPath, testObj.from);
					}
					else {
						// For any others, remove them since these are single tests.
						astTo.setValueAtHashPath(testPath, []);
						astFrom.setValueAtHashPath(testPath, []);
					}


					testPath.pop(); // turns testPath into the container path
					// flatten the containers to now include our test code.
					astFrom.setValueAtHashPath(testPath,
						astFrom.getValueAtHashPath(testPath).flat()
					)
					astTo.setValueAtHashPath(testPath,
						astTo.getValueAtHashPath(testPath).flat()
					)
				});

				let stylesheetFrom = css.stringify(astFrom);
				let stylesheetTo = css.stringify(astTo);

				test(testname, async ()=>{
					let result = await compiler(stylesheetFrom);

					expect(result).toBe(stylesheetTo);
				});
			});
		});

		// Collections Out of Order / Permutated
		// let shuffled = Array.from(tests); shuffle(shuffled);
		// shuffled.forEach((test)=>{
		// 	let astFrom = Object.create(ast);
		// 	let astTo = Object.create(ast);
		//
		// })
	});
};
