module.exports = function (grunt) {
  grunt.initConfig({
    tape: {
      options: {
        pretty: false,
        output: 'console'
      },
      files: ['test/**/*.js']
    },
    watch: {
      files: ['./supermodel.js', 'test/**/*.js'],
      tasks: ['tape'],
    }
  });
  // Enable plugins
  grunt.loadNpmTasks('grunt-tape');
  grunt.loadNpmTasks('grunt-contrib-watch');
  // register tasks
  grunt.registerTask('test', ['tape']);
  // default task
  grunt.registerTask('default', ['test']);
};
