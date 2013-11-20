(function() {

  var Model = Supermodel.Model;

  var User = Model.extend();
  var Admin = User.extend({}, {parent: User});

  module('Model', {

    setup: function() {
      User.reset();
      Admin.reset();
    }

  });

  test('Return existing model if present', function() {
    var a = User.create({id: 1});
    var b = User.create({id: 1});
    ok(a === b);
  });

  test('Set values on existing models', function() {
    var user = User.create({id: 1});
    User.create({id: 1, test: 'test'});
    strictEqual(user.get('test'), 'test');
  });

  test('Remember instance after id is set', function() {
    var a = User.create();
    a.set({id: 1});
    ok(a === User.create({id: 1}));
  });

  test('Add instances to inheritance chain', function() {
    var a = Admin.create({id: 1});
    var b = User.create({id: 1});
    ok(a === b);
  });

  test('Passing attributes returns model', function() {
    var user = User.create();
    ok(User.create(user.attributes) === user);
  });

  test('Add model to all during initialize', function() {
    var Test = Model.extend({
      constructor: function(attrs, options) {
        var o = Model.apply(this, arguments);
        if (o) return o;
      },
      initialize: function() {
        Model.prototype.initialize.apply(this, arguments);
        ok(Test.create({id: 1}) === this);
      }
    });
    Test.create({id: 1});
  });

  test('Use cid to identify attributes.', function() {
    var Model = Supermodel.Model.extend();
    var model = Model.create();
    deepEqual(model.toJSON(), {});
    strictEqual(model.get('cid'), model.cid);
    ok(Model.create(model.attributes) === model);
    ok(Model.create({cid: model.cid}) !== model);
  });

  test('Use cidAttribute to identify attributes.', function() {
    var Model = Supermodel.Model.extend({cidAttribute: '_cid'});
    var model = Model.create();
    strictEqual(model.get('_cid'), model.cid);
    deepEqual(model.toJSON(), {});
    ok(Model.create(model.attributes) === model);
    ok(Model.create({_cid: model.cid}) !== model);
  });

  test('Respect idAttribute.', function() {
    var Model = Supermodel.Model.extend({idAttribute: '_id'});
    var model = Model.create({_id: 1});
    ok(Model.create({_id: 1}) === model);
  });

  test('Instantiating an existing object as a subclass throws.', function() {
    var admin;
    var user = User.create({id: 1});
    raises(function() {
      admin = Admin.create({id: 1});
    }, function(e) {
      return e.message === 'Model with id "1" already exists.';
    });
    ok(!Admin.all().include(admin));
    ok(User.all().include(user));
  });

  test('Parse returns the response.', function() {
    var user = User.create({id: 1});
    var resp = {};
    ok(user.parse(resp) === resp);
  });

  test('Parse returns the response with source.', function() {
    var source = 'user';
    var UserWithSource = User.extend({source : source});

    var user = UserWithSource.create({id: 1});
    var resp = {};
    resp[source] = {'id': 'source_id'};
    ok(user.parse(resp) === resp[source]);
  });

  test('Model.create doesn\'t throw.', 0, function() {
    Model.create({id: 1});
  });

})();
