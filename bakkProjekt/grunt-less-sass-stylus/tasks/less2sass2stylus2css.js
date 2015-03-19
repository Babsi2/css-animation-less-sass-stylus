'use strict';
var sass = require('node-sass');
var async = require('async');
var path = require('path');
var _ = require('lodash');
var chalk = require('chalk');
var less = require('less');


module.exports = function(grunt){
	var warnReal = grunt.fail.warn;
	var warnFake = function () {
		arguments[0] = 'Warning '.cyan + arguments[0];
		grunt.log.writeln.apply(null, arguments);
	};

	var fs = require('fs');
	var scss2lessOptions = {};
	var exec = require('child_process').exec;
	var p = require('prelude-ls');
	

	var mixin_alias_regex = /(^\s*)=(\s*)/;
	var include_alias_regex = /(^\s*)\+(\s*)/;
	//var fs = require('fs');
	
	grunt.registerMultiTask('less2sass2stylus2css', 'Convert Less to CSS, SCSS or Stylus or SCSS to Less, CSS or Stylus or Stylus to Less, SCSS or CSS', function() {
	  
		var done = this.async();

    var options = this.options({
      report: 'min',
      includePaths: [],
			outputStyle: 'nested',
			sourceComments: 'none',
			separator: grunt.util.linefeed,
			banner: ''
    });

    if (this.files.length < 1) {
      grunt.verbose.warn('Destination not written because no source files were provided.');
    }
	
		grunt.verbose.writeflags(options, 'Options');

    async.eachSeries(this.files, function(f, nextFileObj) {

      var destFile = f.dest;
    	
      var files = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
        	grunt.log.writeln('source file ' + f.src[0].split(".").pop());
          return true;
        }
      });

      if (files.length === 0) {
        if (f.src.length < 1) {
          grunt.log.warn('Destination ' + chalk.cyan(destFile) + ' not written because no source files were found.');
        }

        // No src files, goto next target. Warn would have been issued above.
        return nextFileObj();
      }
      if(f.src[0].split(".").pop() == 'sass' || f.src[0].split(".").pop() == 'scss'){
	      if(destFile.split(".").pop() == 'css'){
		      sass.render({
						file: f.src[0],
						success: function (res) {
							grunt.file.write(destFile, res.css);
							grunt.log.writeln('File "' + destFile + '" created.');
							next();
						},
						error: function (err) {
							grunt.warn(err);
						},
						includePaths: options.includePaths,
						outputStyle: options.outputStyle,
						sourceComments: options.sourceComments
					});
				} else if(f.src[0].split(".").pop() == 'scss' && destFile.split(".").pop() == 'less'){
		      var lessCode;
		      var i = 0;

		      async.concatSeries(files, function(file, next) {

		       convertSCSS(file, options, function(less, err) {
		          if (!err) {
		            lessCode = less;
		            process.nextTick(next);					
		          } else {
		            nextFileObj(err);
		          }
		        });
		      }, 
		      function() {
		        if (lessCode.length < 1) {
		          grunt.log.warn('Destination ' + chalk.cyan(destFile) + ' not written because compiled files were empty.');
		        } else {
		          grunt.file.write(destFile, lessCode);
		          grunt.log.writeln('File ' + chalk.cyan(destFile) + ' created');
		        }
		        nextFileObj();
		      });
					
		    }else if(destFile.split(".").pop() == "styl"){
		    	var sourceFile = f.src[0];
		    	var convertStyl = function (sass) {
					return sass
						// remove opening brackets
						.replace(/^(\ *)(.+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
						// remove opening brackets
						//.replace(/^(\ *)([^\ \n]+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
						 // remove opening brackets again (some random cases I'm too lazy to think through)
						.replace(/\ *\{\ *\n*/g, "")
						 // remove closing brackets
						.replace(/\ *\}\ *\n*/g, "")
				 
						// remove semicolons
						.replace(/\;\ *?$/gm, "")
				 
						// replace @variable: with $variable =
						.replace(/@(\w+):(\ *)\ /g, function(_, $1, $2) {
							return "$" + $1 + $2 + " = ";
						})
						// replace all other variable call, careful with native @{keyword}
						.replace(/\@(\w+)/g, function(_, $1) {
							if ($1 === "import" || $1 == "media") {
								return _;
							} else {
								return "$" + $1;
							}
						})
				 
						// replace @{variable} with {$variable}
						.replace(/@\{(\w+)\}/g, function(_, $1) {
							return '{$' + $1 +'}';
						})
				 
						// replace mixins from .border-radius(4px) to border-radius(4px)
						//.replace(/\.([\w-]+) ?\(/g, "$1(")
				 
				 		.replace(/\@[a-zA-Z]([\w-]+) ?\(/g, "$1(")
						// switch this two lines if you want to disable @extend behavior
						//.replace(/(\.[a-zA-Z][\w-]+;)/g, "@extend $1") // replace mixins without args by @extend
						.replace(/\.([a-zA-Z][\w-]+);/g, "$1();") // replace mixins without args
				 
						.replace(/(\ *)(.+)>\ *([\w-]+)\(/g, "$1$2>\n$1  $3(")
				 
						// ms filter fix
						.replace(/filter: ([^'"\n;]+)/g, 'filter: unquote("$1")')
				 
						// url data
						.replace(/: ?url\(([^'"\)]+)\)/g, ': url(unquote("$1"))')
				 
						// rename (useless)
						.replace(/\.less/g, ".styl")
				 
						// tinies optimizations
				 
						// make all commas have 1 space after them
						.replace(/,\ */g, ", ")
				 
						// replace 0.x by .x
						.replace(/(:\ )0\.([0-9])+/g, ".$2 ")
				 
						// remove trailing whitespace
						.replace(/\ *$/g, "");
					}
		  
					var stylus = convertStyl(fs.readFileSync(sourceFile, "utf-8"));
					fs.writeFileSync(destFile, stylus);
		    }else if(destFile.split(".").pop() == "scss"){
		    	var _ = grunt.util._;
		    	grunt.log.writeln('sass to scss');
		    	var validFiles = removeInvalidFiles(f);

		      grunt.verbose.writeflags(validFiles, 'Valid files');

		      writeFile(f.dest, concatOutput(validFiles, options));
		    }
		  }else if(f.src[0].split(".").pop() == 'less'){
		  	if(destFile.split(".").pop() == 'css'){

		  		var compiled = [];
		      var i = 0;

		      async.concatSeries(files, function(file, next) {
		        if (i++ > 0) {
		          options.banner = '';
		        }

		        compileLess(file, destFile, options)
		          .then(function(output) {
		            compiled.push(output.css);
		            if (options.sourceMap && !options.sourceMapFileInline) {
		              var sourceMapFilename = options.sourceMapFilename;
		              if (!sourceMapFilename) {
		                sourceMapFilename = destFile + '.map';
		              }
		              grunt.file.write(sourceMapFilename, output.map);
		              grunt.log.writeln('File ' + chalk.cyan(sourceMapFilename) + ' created.');
		            }
		            var allCss = compiled.join(options.compress ? '' : grunt.util.normalizelf(grunt.util.linefeed));
			          grunt.file.write(destFile, allCss);
			          grunt.log.writeln('File ' + chalk.cyan(destFile) + ' created');
		            //process.nextTick(next);
		          },
		          function(err) {
		            nextFileObj(err);
		          });
		      });
		  	}else if (destFile.split(".").pop() == 'styl'){
		  		var convertLess = function (less) {
						return less
							// remove opening brackets
							//.replace(/^(\ *)(.+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
							// remove opening brackets
							//.replace(/^(\ *)([^\ \n]+)\ +\{\ *\n?\ */mg, "$1$2\n$1  ")
							 // remove opening brackets again (some random cases I'm too lazy to think through)
							//.replace(/\ *\{\ *\n*/g, "\n")
							 // remove closing brackets
							//.replace(/\ *\}\ *\n*/g, "\n")

							// remove semicolons
							//.replace(/\;\ *?$/gm, "")

							// replace @variable: with $variable =
							.replace(/@(\w+):(\ *)\ /g, function(_, $1, $2) {
								return "$" + $1 + $2 + " = ";
							})
							// replace all other variable call, careful with native @{keyword}
							.replace(/\@(\w+)/g, function(_, $1) {
								if ($1 === "import" || $1 == "media") {
									return _;
								} else {
									return "$" + $1;
								}
							})

							// replace @{variable} with {$variable}
							.replace(/@\{(\w+)\}/g, function(_, $1) {
								return '{$' + $1 +'}';
							})

							// replace mixins from .border-radius(4px) to border-radius(4px)
							.replace(/\.([\w-]+) ?\(/g, "$1(")

							// switch this two lines if you want to disable @extend behavior
							//.replace(/(\.[a-zA-Z][\w-]+;)/g, "@extend $1") // replace mixins without args by @extend
							.replace(/\.([a-zA-Z][\w-]+);/g, "$1();") // replace mixins without args

							.replace(/(\ *)(.+)>\ *([\w-]+)\(/g, "$1$2>\n$1  $3(")

							// ms filter fix
							.replace(/filter: ([^'"\n;]+)/g, 'filter: unquote("$1")')

							// url data
							.replace(/: ?url\(([^'"\)]+)\)/g, ': url(unquote("$1"))')

							// rename (useless)
							.replace(/\.less/g, ".styl")

							// tinies optimizations

							// make all commas have 1 space after them
							.replace(/,\ */g, ", ")

							// replace 0.x by .x
							.replace(/(:\ )0\.([0-9])+/g, ".$2 ")

							// remove trailing whitespace
							.replace(/\ *$/g, "");
					}
				  
					var stylus = convertLess(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, stylus);
		  	}else if(destFile.split(".").pop() == 'scss'){
		  		var scssConvert = function(less) {

					  return less

					  .replace(/(\s|^)\.([\w\-]*\(?.*\)?;)/g, '$1@include $2')

					  .replace(/\.([\w\-]*)\s*\((.*)\)\s*\{/g, '@mixin $1($2) {')

					  .replace(/spin\(/g, 'adjust-hue(')

					  .replace(/@(?!(media|import|mixin|font-face)(\s|\())/g, '$');
					};

					var sass = scssConvert(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, sass);

		  	}else if(destFile.split(".").pop() == 'sass'){
		  		grunt.log.writeln('less sass');
		  		

					var sassConvert = function(less) {

					  return less

					  .replace(/(\s|^)\.([\w\-]*\(?.*\)?;)/g, '$1@include $2')

					  .replace(/\.([\w\-]*)\s*\((.*)\)\s*\{/g, '@mixin $1($2) {')

					  .replace(/spin\(/g, 'adjust-hue(')

					  .replace(/@(?!(media|import|mixin|font-face)(\s|\())/g, '$');
					};

					var sass = sassConvert(fs.readFileSync(f.src[0], "utf-8"));
					fs.writeFileSync(destFile, sass);
		  	}
		  }else if(f.src[0].split(".").pop() == 'styl'){
		  	grunt.log.writeln('stylus');
		  	if(destFile.split(".").pop() == 'css'){

		  	}else if(destFile.split(".").pop() == 'less'){

		  	}else if(destFile.split(".").pop() == 'scss'){

		  	}else if(destFile.split(".").pop() == 'sass'){

		  	}
		  }
    }, done);
  });

		
  var convertSCSS = function(srcFile, options, callback) {
    options = _.assign({filename: srcFile}, options);
    options.paths = options.paths || [path.dirname(srcFile)];

    if (typeof options.paths === 'function') {
      try {
        options.paths = options.paths(srcFile);
      } catch (e) {
        grunt.fail.warn(wrapError(e, 'Generating @import paths failed.'));
      }
    }


    var css,
    less,
    srcCode = grunt.file.read(srcFile);

      try {
        less = convert(srcCode);
        callback(less, null);
      } catch (e) {
        scss2lessError(e, srcFile);
        callback(less, true);
      }
   
  };
  var scss2lessError = function(e, file) {
    var message = 'error';

    grunt.log.error(message);
    grunt.fail.warn('365 Error compiling ' + file);
  };
  
  var convert = function (source) {
    source = source.replace(/@mixin /g,'.');
    source = source.replace(/@include /g,'.');
    source = source.replace(/\$(\w+)/g,"@$1");
    source = source.replace(/@extend ([\w\-\.]+);/g,"&:extend( $1 );");
    source = source.replace(/ !default/g,'');
    source = source.replace(/#{([^}]+)}/g,"~\"$1\"");
    source = source.replace(/~\"@(\w+)\"/g,"@{$1}");
    source = source.replace(/adjust-hue\(/g,'spin(');
    
    source = source.replace(/(@if)([^{]+)({)/g,function(match,m1,m2,m3){ 
		var result = '& when';
			result += m2.replace(/==/g,'=');
			result += m3;
			return result;
		});
	  return source;
  };

  var concatOutput = function(files, options) {
    return files.map(function(filepath) {
      var sass = grunt.file.read(filepath);
      return convertSassToScss(sass, options, filepath);
    }).join(grunt.util.normalizelf(options.separator));
  };

  var removeInvalidFiles = function(files) {
    return files.src.filter(function(filepath) {
      if (!grunt.file.exists(filepath)) {
        grunt.log.warn('Source file "' + filepath + '" not found.');
        return false;
      } else {
        return true;
      }
    });
  };

  var writeFile = function (path, output) {
    if (output.length < 1) {
      warnOnEmptyFile(path);
    } else {
      grunt.file.write(path, output);
      grunt.log.writeln('File ' + path + ' created.');
    }
  };

  var warnOnEmptyFile = function (path) {
    grunt.log.warn('Destination (' + path + ') not written because compiled files were empty.');
  };

  var replaceIncludeAlias = function(line){
    return line.replace(include_alias_regex, function(match, spacesBefore, spacesAfter){
      return spacesBefore + '@include' + (spacesAfter !== '' ? spacesAfter : ' ');
    });
  };

  var replaceMixinAlias = function(line){
    return line.replace(mixin_alias_regex, function(match, spacesBefore, spacesAfter){
      return spacesBefore + '@mixin' + (spacesAfter !== '' ? spacesAfter : ' ');
    });
  };

  var insertBeforeComment = function(inserted, text){
    var index = text.indexOf('//');

    if(index > -1) {
      return text.slice(0, index) + inserted + text.substr(index);
    } else {
      return text + inserted;
    }
  };

  var splitBefore = function(before, text){
    var index = text.indexOf(before);

    if(index > -1) {
      return [text.slice(0, index), text.substr(index)];
    } else {
      return [text];
    }
  };

  var insertBeforeClosingBrackets = function(inserted, text){

    var match = text.match(/.*(#{([*+\-\$\w\s\d])*})/);
    var start = '';
    var end = text;

    if(match){
      start = match[0];
      end = text.substr(start.length);
    }

    var splittedBeforeComments = splitBefore('//', end);
    var beforeComments = splittedBeforeComments[0];
    var splittedBeforeBrackets = splitBefore('}', beforeComments);
    var beforeBrackets = splittedBeforeBrackets[0];

    var value = beforeBrackets + inserted;

    if (splittedBeforeBrackets[1]) {
      value += splittedBeforeBrackets[1];
    }
    if (splittedBeforeComments[1]) {
      value += splittedBeforeComments[1];
    }

    return start + value;
  };

  var convertSassToScss = function(input, options){
    var lines, lastBlockLineIndex, braces, bracesString;

    function fn$(it){
      return lines.indexOf(it);
    }
    function fn1$(it){
      return it.indentation > lines[idx].indentation;
    }

    if (input != null) {

      var raw_lines = _.reject(
        input.split('\n'), // split every lines
        function(line){
          // reject empty or \* *\ comment only lines
          return line.match(/^\s*(\/\*.*\*\/.*)?(\/{2}.*)?$/);
        }
      );

      // Cleanup lines and add indentation information
      lines = _.map(raw_lines, function(line){

        line = replaceIncludeAlias(line);
        line = replaceMixinAlias(line);

        var match = line.match(/^\s+/);

        return {
          indentation: match != null ? match[0].length : 0,
          text: line
        };
      });

      for (var idx in lines) {

        idx = parseInt(idx, 10);
        var line = lines[idx];

        if (line.text.match(/[a-z>~*]+/)) {

          lastBlockLineIndex = p.last(
            p.map(fn$)(
              p.takeWhile(fn1$)(
                p.drop(idx + 1)( lines))));

          if (lastBlockLineIndex != null) {

            lines[idx].text = insertBeforeComment('{', lines[idx].text);
            lines[lastBlockLineIndex].text = insertBeforeComment('}', lines[lastBlockLineIndex].text);
          } else {

            lines[idx].text = insertBeforeClosingBrackets(';', lines[idx].text );
          }
        }
      }

      // Return lines content joined in a single string
      return _.map(lines, function(it){
        return it.text;
      }).join(grunt.util.normalizelf(options.separator));
    }
  };

  var compileLess = function(srcFile, destFile, options) {
    options = _.assign({filename: srcFile}, options);
    options.paths = options.paths || [path.dirname(srcFile)];

    if (_.isFunction(options.paths)) {
      try {
        options.paths = options.paths(srcFile);
      } catch (e) {
        grunt.fail.warn(wrapError(e, 'Generating @import paths failed.'));
      }
    }

    if (options.sourceMap && !options.sourceMapFileInline && !options.sourceMapFilename) {
      options.sourceMapFilename = destFile + '.map';
    }

    if (_.isFunction(options.sourceMapBasepath)) {
      try {
        options.sourceMapBasepath = options.sourceMapBasepath(srcFile);
      } catch (e) {
        grunt.fail.warn(wrapError(e, 'Generating sourceMapBasepath failed.'));
      }
    }

    if (_.isBoolean(options.sourceMap) && options.sourceMap) {
      options.sourceMap = {
        sourceMapBasepath: options.sourceMapBasepath,
        sourceMapFilename: options.sourceMapFilename,
        sourceMapInputFilename: options.sourceMapInputFilename,
        sourceMapFullFilename: options.sourceMapFullFilename,
        sourceMapURL: options.sourceMapURL,
        sourceMapRootpath: options.sourceMapRootpath,
        outputSourceFiles: options.outputSourceFiles,
        sourceMapFileInline: options.sourceMapFileInline
      };
    }

    var srcCode = grunt.file.read(srcFile);

    // Equivalent to --modify-vars option.
    // Properties under options.modifyVars are appended as less variables
    // to override global variables.
    var modifyVarsOutput = parseVariableOptions(options['modifyVars']);
    if (modifyVarsOutput) {
      srcCode += '\n';
      srcCode += modifyVarsOutput;
    }

    // Load custom functions
    if (options.customFunctions) {
      Object.keys(options.customFunctions).forEach(function(name) {
        less.functions.functionRegistry.add(name.toLowerCase(), function() {
          var args = [].slice.call(arguments);
          args.unshift(less);
          var res = options.customFunctions[name].apply(this, args);
            return _.isObject(res) ? res : new less.tree.Anonymous(res);
        });
      });
    }

    return less.render(srcCode, options)
      .catch(function(err) {
        lessError(err, srcFile);
      });
  };

  var parseVariableOptions = function(options) {
    var pairs = _.pairs(options);
    var output = '';
    pairs.forEach(function(pair) {
      output += '@' + pair[0] + ':' + pair[1] + ';';
    });
    return output;
  };

  var formatLessError = function(e) {
    var pos = '[' + 'L' + e.line + ':' + ('C' + e.column) + ']';
    return e.filename + ': ' + pos + ' ' + e.message;
  };

  var lessError = function(e, file) {
    var message = less.formatError ? less.formatError(e) : formatLessError(e);

    grunt.log.error(message);
    grunt.fail.warn('626 Error compiling ' + file);
  };

  var wrapError = function (e, message) {
    var err = new Error(message);
    err.origError = e;
    return err;
  };
}

