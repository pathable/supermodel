(function() {

  var User, Admin;
  var Model = Supermodel.Model;

  module('Model', {

    setup: function() {
      if (Model.all) Model.all.reset([]);

      User = Model.extend({
        constructor: function() {
          var o = User.__super__.constructor.apply(this, arguments);
          if (o) return o;
        }
      });

      Admin = User.extend({
        constructor: function() {
          var o = Admin.__super__.constructor.apply(this, arguments);
          if (o) return o;
        }
      });
    }

  });

  test('Return existing model if present', function() {
    var a = new User({id: 1});
    var b = new User({id: 1});
    ok(a === b);
  });

  test('Set values on existing models', function() {
    var a = new User({id: 1});
    var b = new User({id: 1, test: 'test'});
    strictEqual(a.get('test'), 'test');
  });

  test('Remember instance after id is set', function() {
    var a = new User();
    a.set({id: 1});
    ok(a === new User({id: 1}));
  });

  test('Add instances to inheritance chain', function() {
    var a = new Admin({id: 1});
    var b = new User({id: 1});
    ok(a === b);
  });

  test('Return subclass through findConstructor', function() {
    User.prototype.findConstructor = function() {
      return Admin;
    };
    ok(new User() instanceof Admin);
  });

  test('Passing attributes returns model', function() {
    var user = new User();
    ok(new User(user.attributes) === user);
  });

  test('Add model to all during initialize', function() {
    var Test = Model.extend({
      constructor: function(attrs, options) {
        var o = Test.__super__.constructor.apply(this, arguments);
        if (o) return o;
      },
      initialize: function() {
        Test.__super__.initialize.apply(this, arguments);
        ok(new Test({id: 1}) === this);
      }
    });
    new Test({id: 1});
  });

  test('toJSON does not include _cid', function() {
    deepEqual(new Model().toJSON(), {});
  });

  test('model.match', function() {
    var model = new Model({x: 1, y: 2});
    ok(model.match({x: 1}));
    ok(model.match({y: 2}));
    ok(!model.match({x: 2}));
    ok(!model.match({y: 1}));
    ok(!model.match({}));
    ok(model.match({x: 1, y: 2}));
    ok(!model.match({x: 1, y: 2, z: 3}));
  });

  test('Attributes are parsed before being set.', 1, function() {
    var attrs = {id: 1};
    var model = new Model({id: 1});
    model.parse = function(resp) {
      ok(resp === attrs);
    };
    model = new Model(attrs);
  });

})();
