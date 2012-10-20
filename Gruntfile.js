var exec = require('child_process').exec;

module.exports = function(grunt) {

  grunt.initConfig({
    qunit: {
      supermodel: ['./test/index.html']
    },
    min: {
      'supermodel.min.js': 'supermodel.js'
    },
    jshint: {
      all: ['supermodel.js', './test/*.js'],
      options: {
        eqnull: true,
        undef: true,
        boss: true,
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
    }
  });

  // Default tasks.
  grunt.registerTask('default', ['jshint', 'qunit']);

  // Release task, to be run only just before cutting a release in order to
  // keep the commit log clean.
  grunt.registerTask('release', 'default docco min');

  // Build docco docs.
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
