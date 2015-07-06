var _ = require('underscore');
var Supermodel = require('../supermodel');

var Model = Supermodel.Model;

var User = Model.extend();
var Admin = User.extend({}, {parent: User});

var test = function(name, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = null;
  }
  require('tape')(name, options, function(t) {
    User.reset();
    Admin.reset();
    callback(t);
  });
};

test('Return existing model if present', function(t) {
  var a = User.create({id: 1});
  var b = User.create({id: 1});
  t.ok(a === b);
  t.end();
});

test('Set values on existing models', function(t) {
  var user = User.create({id: 1});
  User.create({id: 1, test: 'test'});
  t.is(user.get('test'), 'test');
  t.end();
});

test('Remember instance after id is set', function(t) {
  var a = User.create();
  a.set({id: 1});
  t.ok(a === User.create({id: 1}));
  t.end();
});

test('Add instances to inheritance chain', function(t) {
  var a = Admin.create({id: 1});
  var b = User.create({id: 1});
  t.ok(a === b);
  t.end();
});

test('Passing attributes returns model', function(t) {
  var user = User.create();
  t.ok(User.create(user.attributes) === user);
  t.end();
});

test('Add model to all during initialize', function(t) {
  var Test = Model.extend({
    constructor: function(attrs, options) {
      var o = Model.apply(this, arguments);
      if (o) return o;
    },
    initialize: function() {
      Model.prototype.initialize.apply(this, arguments);
      t.ok(Test.create({id: 1}) === this);
    }
  });
  Test.create({id: 1});
  t.end();
});

test('Use cid to identify attributes.', function(t) {
  var Model = Supermodel.Model.extend();
  var model = Model.create();
  t.same(model.toJSON(), {cid: model.cid});
  t.is(model.get('cid'), model.cid);
  t.ok(Model.create(model.attributes) === model);
  t.ok(Model.create({cid: model.cid}) !== model);
  t.end();
});

test('Use cidAttribute to identify attributes.', function(t) {
  var Model = Supermodel.Model.extend({cidAttribute: '_cid'});
  var model = Model.create();
  t.is(model.get('_cid'), model.cid);
  t.same(model.toJSON(), {_cid: model.cid});
  t.ok(Model.create(model.attributes) === model);
  t.ok(Model.create({_cid: model.cid}) !== model);
  t.end();
});

test('Respect idAttribute.', function(t) {
  var Model = Supermodel.Model.extend({idAttribute: '_id'});
  var model = Model.create({_id: 1});
  t.ok(Model.create({_id: 1}) === model);
  t.end();
});

test('Instantiating an existing object as a subclass throws.', function(t) {
  var admin;
  var user = User.create({id: 1});
  t.throws(function() {
    admin = Admin.create({id: 1});
  }, function(e) {
    return e.message === 'Model with id "1" already exists.';
  });
  t.ok(!Admin.all().include(admin));
  t.ok(User.all().include(user));
  t.end();
});

test('Parse returns the response.', function(t) {
  var user = User.create({id: 1});
  var resp = {};
  t.ok(user.parse(resp) === resp);
  t.end();
});

test('Model.create doesn\'t throw.', 0, function(t) {
  Model.create({id: 1});
  t.end();
});

test('#53 - Create passes through options.', function(t) {
  var model = Model.create({id: 1});
  model.on('change:x', function(model, value, options) {
    t.is(options.foo, 'bar');
  });
  Model.create({id: 1, x: 1}, {foo: 'bar'});
  t.end();
});

