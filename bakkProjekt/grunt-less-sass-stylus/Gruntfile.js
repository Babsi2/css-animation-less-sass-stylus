module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        'tasks/*.js',
      ]
    },
    less2sass2stylus2css: {
        options: {
            sourceMap: true
        },
        dist: {
            files: {
                'main.sass': 'main.less'
            }
        }
    }
  });
  grunt.registerTask('default', ['less2sass2stylus2css']);
  grunt.loadTasks('tasks');
};