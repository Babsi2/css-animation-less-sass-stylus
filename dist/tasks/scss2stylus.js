'use strict';

var async = require('async');

module.exports = function(grunt){
	var warnReal = grunt.fail.warn;
	var warnFake = function () {
		arguments[0] = 'Warning '.cyan + arguments[0];
		grunt.log.writeln.apply(null, arguments);
	};
	
	var fs = require('fs');
	
	grunt.registerMultiTask('scss2stylus', 'less2stylus Descdription', function() {
	  
		var done = this.async();

    var options = this.options({
			compress: false
    });

    var banner = options.banner;

    var filesCreatedCount = 0;

    if (options.basePath || options.flatten) {
      grunt.fail.warn('Experimental destination wildcards are no longer supported. Please refer to README.');
    }

    if (this.files.length < 1) {
      grunt.verbose.warn('Destination not written because no source files were provided.');
    }
	
		grunt.verbose.writeflags(options, 'Options');

		var count = 0;

    async.eachSeries(this.files, function(f, nextFileObj) {

      var destFile = f.dest;
    	
      var files = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
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

				.replace(/(@-[a-zA-Z]+-[a-zA-Z]+)({\$[a-zA-Z]+[}])/g, "$1")

				.replace(/(\#)(\$[a-zA-Z]+)/g, "{$2}")

				.replace(/(@mixin) ([a-zA-Z][\w-]+[\(])/g, "$2")

				.replace(/(@mixin) ([a-zA-Z][\w-]+)/g, "$2()")

				.replace(/(@include) ([a-zA-Z][\w-]+[\(])/g, "$2")

				.replace(/(@include) ([a-zA-Z][\w-]+)/g, "$2()")

				.replace(/@content/g, "{block}")
		
			}
  
			var stylus = convertStyl(fs.readFileSync(sourceFile, "utf-8"));
			fs.writeFileSync(destFile, stylus);
			grunt.log.writeln('File "' + destFile + '" created.');
    }, done);
  });

}