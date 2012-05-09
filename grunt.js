module.exports = function(grunt) {

  grunt.registerTask('default', 'lint qunit');

  grunt.initConfig({
    qunit: ['./test/index.html', './test/index-min.html'],
    lint: ['supermodel.js', './test/*.js'],
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

};
