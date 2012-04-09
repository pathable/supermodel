(function() {

  var User, Users, Membership, Memberships, Settings;
  var Model = Supermodel.Model;
  var Collection = Supermodel.Collection;

  module('Has One', {

    setup: function() {
      if (Model.all) {
        Model.all.reset([]);
        Model.all = null;
      }

      if (User && User.all) {
        User.all.reset([]);
        User.all = null;
      }

      if (Membership && Membership.all) {
        Membership.all.reset([]);
        Membership.all = null;
      }

      User = Model.extend({
        constructor: function() {
          var o = User.__super__.constructor.apply(this, arguments);
          if (o) return o;
        }
      });

      Membership = Model.extend({
        constructor: function() {
          var o = Membership.__super__.constructor.apply(this, arguments);
          if (o) return o;
        }
      });

      Settings = Model.extend({
        constructor: function() {
          var o = Settings.__super__.constructor.apply(this, arguments);
          if (o) return o;
        }
      });

      Users = Collection.extend({model: User});
      Memberships = Collection.extend({model: Membership});

      Membership.has().one('user', {
        model: User,
        inverse: 'memberships'
      });

      User.has().one('settings', {
        model: Settings,
        inverse: 'user'
      });

      Settings.has().one('user', {
        model: User,
        inverse: 'settings'
      });

    }

  });

  test('Setting associations.', function() {
    var user = new User({id: 5});
    var membership = new Membership({id: 3, user_id: 5});
    ok(membership.user === user, 'Initialize association.');
    membership.set({user_id: null});
    ok(!membership.user, 'Remove association on change.');
    membership.set({user_id: 5});
    ok(membership.user === user, 'Add association on change.');
  });

  test('Parsing associations.', function() {
    var membership = new Membership({id: 2});
    membership.parse({user: {id: 4}});
    var user = membership.user;
    ok(user instanceof User);
    strictEqual(user.id, 4);
    // Association should not be removed if not included.
    membership.parse({});
    ok(membership.user === user);
  });

  test('Handle ids that are strings.', function() {
    var user = new User({id: 3});
    var membership = new Membership({id: 2, user_id: '3'});
    ok(membership.user === user);
    membership.set({user_id: '3'});
    ok(membership.user === user);
  });

  test('Parse without id.', function() {
    var membership = new Membership({id: 1, user: {id: 2}}, {parse: true});
    var user = membership.user;
    ok(user instanceof User);
    strictEqual(user.id, 2);
  });

  test('With inverse.', function() {
    var user = new User({id: 1});
    var settings = new Settings({id: 1, user_id: 1});

    ok(user.settings === settings);
    strictEqual(user.get('settings_id'), 1);
    ok(settings.user === user);
    strictEqual(settings.get('user_id'), 1);

    user.unset('settings_id');
    ok(!user.settings);
    ok(!user.get('settings_id'));
    ok(!settings.user);
    ok(!settings.get('user_id'));
  });

  test('Dissociate on destroy.', function() {
    var user = new User({id: 1});
    var settings = new Settings({id: 1, user_id: 1});

    settings.trigger('destroy', settings);
    ok(!user.settings);
    ok(!user.get('settings_id'));
    ok(!settings.user);
    ok(!settings.get('user_id'));
  });

})();
