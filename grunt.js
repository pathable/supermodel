module.exports = function(grunt) {

  grunt.initConfig({
    qunit: ['./test/index.html'],
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
