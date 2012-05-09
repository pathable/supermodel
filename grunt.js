var exec = require('child_process').exec;

module.exports = function(grunt) {

  grunt.initConfig({
    qunit: ['./test/index.html', './test/index-min.html'],
    lint: ['supermodel.js', './test/*.js'],
    min: {
      'supermodel.min.js': 'supermodel.js'
    },
    watch: {
      default: {
        files: ['supermodel.js', 'test/index.html', 'test/**/*.js'],
        tasks: 'default'
      }
    },
    jshint: {
      options: {
        eqnull: true,
        undef: true
      },
      globals: {
        // QUnit
        ok: true,
        test: true,
        module: true,
        raises: true,
        deepEqual: true,
        strictEqual: true,

        // Dependencies
        _: true,
        jQuery: true,
        Backbone: true,
        Supermodel: true
      }
    }
  });

  grunt.registerTask('default', 'lint qunit');

  grunt.registerTask('release', 'default docco min');

  grunt.registerTask('docco', function() {

    // Inform grunt when we're finished.
    var done = this.async();

    // Kick off docco and log results.
    exec('docco supermodel.js', function(err, stdout, stderr) {
      if (err) {
        grunt.log.error(err);
        return done(err.code);
      }
      grunt.log.write(stdout);
      done();
    });

  });

};
