(function() {

  var Model = Supermodel.Model;
  var Collection = Supermodel.Collection;

  var User = Model.extend({
    constructor: function() {
      var o = User.__super__.constructor.apply(this, arguments);
      if (o) return o;
    }
  });

  var Membership = Model.extend({
    constructor: function() {
      var o = Membership.__super__.constructor.apply(this, arguments);
      if (o) return o;
    }
  });

  var Group = Model.extend({
    constructor: function() {
      var o = Group.__super__.constructor.apply(this, arguments);
      if (o) return o;
    }
  });

  var Settings = Model.extend({
    constructor: function() {
      var o = Settings.__super__.constructor.apply(this, arguments);
      if (o) return o;
    }
  });

  var Users = Collection.extend({model: User});
  var Memberships = Collection.extend({model: Membership});
  var Groups = Collection.extend({model: Group});

  var setup = function() {
    User.all = null;
    Settings.all = null;
    Membership.all = null;
    Group.all = null;

    Membership.has()
      .one('user', {
        model: User,
        inverse: 'memberships'
      })
      .one('group', {
        model: Group,
        inverse: 'memberships'
      });

    Settings.has()
      .one('user', {
        model: User,
        inverse: 'settings'
      });

    User.has()
      .one('settings', {
        model: Settings,
        inverse: 'user'
      })
      .many('memberships', {
        collection: Memberships,
        inverse: 'user'
      })
      .many('contacts', {
        source: 'users',
        collection: Users
      });

    Group.has()
      .many('memberships', {
        collection: Memberships,
        inverse: 'group'
      });
  };

  module('One', {setup: setup});

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

  test('Parse without id attribute.', function() {
    var membership = new Membership({id: 1});
    membership.parse({user: {id: 2}});
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

  module('Many', {setup: setup});

  test('Many is initialized only once.', function() {
    var user = new User();
    var memberships = user.memberships;
    User.all.trigger('add', user, User.all);
    ok(user.memberships === memberships);
  });

  test('Source is removed after parsing.', function() {
    var user = new User();
    user.parse({memberships: [{id: 1}]});
    strictEqual(user.memberships.length, 1);
    strictEqual(user.memberships.at(0).id, 1);
    ok(!user.get('memberships'));

    user = new User({memberships: [{id: 3}]});
    strictEqual(user.memberships.length, 1);
    strictEqual(user.memberships.at(0).id, 3);
    ok(!user.get('memberships'));
  });

  test('Associations are triggered on "change".', 2, function() {
    var user = new User({id: 2});
    var membership = new Membership({id: 3});
    user.on('associate:memberships', function() {
      strictEqual(membership.get('x'), true);
    });
    membership.on('associate:user', function() {
      strictEqual(membership.get('x'), true);
    });
    membership.set({user_id: 2, x: true});
  });

  test('Update associations on parse.', function() {
    var user = new User({id: 1});
    user.parse({memberships: [{id: 2, group: {id: 3}}]});
    var membership = user.memberships.at(0);
    strictEqual(membership.id, 2);
    strictEqual(membership.group.id, 3);
    user.parse({memberships: [{id: 4, group: {id: 5}}]});
    membership = user.memberships.at(0);
    strictEqual(membership.id, 4);
    strictEqual(membership.group.id, 5);
  });

  test('Many with source.', function() {
    var user = new User({id: 1, users: [{id: 2}]});
    strictEqual(user.contacts.at(0).id, 2);
  });

  test('Many references correct inverse.', function() {
    var user = new User({id: 1, memberships: [{id: 2}]});
    var membership = user.memberships.at(0);
    ok(membership.user === user);
    strictEqual(membership.id, 2);
  });

  test('Dissociate when removed.', function() {
    var user = new User({id: 1, memberships: [{id: 2}]});
    var membership = user.memberships.at(0);
    ok(membership.user === user);
    user.memberships.remove(membership);
    ok(!membership.user);
  });

  test('Associate on add.', function() {
    var user = new User();
    var membership = new Membership();
    user.memberships.add(membership);
    ok(membership.user === user);
  });

  test('Add on associate.', function() {
    var user = new User({id: 1});
    var membership = new Membership();
    membership.parse({user: {id: 1}});
    ok(user.memberships.at(0) === membership, 'Membership added.');
    ok(membership.user === user, 'User property set.');
  });

  test('Remove on dissociate.', function() {
    var user = new User({id: 1, memberships: [{id: 2}]});
    strictEqual(user.memberships.length, 1);
    var membership = user.memberships.at(0);
    membership.unset('user_id');
    strictEqual(user.memberships.length, 0);
    ok(!membership.user);
  });

  test('Set id attribute.', function() {
    var user = new User({id: 1, memberships: [{id: 2}]});
    strictEqual(user.memberships.at(0).get('user_id'), 1);
    var membership = new Membership({id: 3, user: {id: 4}});
    strictEqual(membership.get('user_id'), 4);
  });

  test('Use id attribute.', function() {
    var membership = new Membership({user_id: 1});
    strictEqual(membership.user.id, 1);
  });

  test('Watch id attribute.', function() {
    var membership = new Membership();
    membership.set({user_id: 1});
    strictEqual(membership.user.id, 1);
  });

  test('Do not use null/undefined id attribute.', function() {
    var membership = new Membership();
    membership.set({user_id: null});
    ok(!membership.user);
    membership.set({user_id: undefined});
    ok(!membership.user);
    membership.unset('user_id');
    ok(!membership.user);
  });

  test('Unset id attribute.', function() {
    var membership = new Membership({user: {id: 1}});
    membership.unset('user_id');
    ok(!membership.get('user_id'));
    ok(!membership.user);
  });

  // TODO: Petition for better reset notifications.
  if (false) {
    test('Dissociate on reset.', 0, function() {
      var user = new User({memberships: [{id: 1}]});
      var membership = user.memberships.at(0);
      user.memberships.reset([]);
      strictEqual(user.memberships.length, 0);
      ok(!membership.user);
    });
  }

  test('Remove id attribute on dissociate.', function() {
    var membership = new Membership({id: 1, user_id: 2});
    strictEqual(membership.get('user_id'), 2);
    membership.user.memberships.remove(membership);
    ok(!membership.get('user_id'));
  });

  test('Associate on reset.', function() {
    var user = new User();
    var membership = new Membership();
    user.memberships.reset([membership]);
    strictEqual(user.memberships.length, 1);
    ok(user.memberships.at(0) === membership);
    ok(membership.user === user);
  });

  test('Remove on destroy.', function() {
    var membership = new Membership({user_id: 1});
    membership.user.trigger('destroy', membership.user);
    ok(!membership.user);
    ok(!membership.get('user_id'));
  });

  test('Add on creation.', function() {
    var user = new User({id: 1});
    var membership = new Membership({id: 2, user: {id: 1}});
    strictEqual(user.memberships.length, 1);
    ok(user.memberships.at(0) === membership);
  });

  test('Add on set.', function() {
    var user = new User({id: 1});
    var membership = new Membership({id: 2});
    membership.set({user_id: 1});
    strictEqual(user.memberships.length, 1);
    ok(user.memberships.at(0) === membership);
    ok(membership.user === user);
  });

  test('Remove on set.', function() {
    var user = new User({id: 1, memberships: [{id: 2}]});
    var membership = user.memberships.at(0);
    membership.set({user_id: null});
    strictEqual(user.memberships.length, 0);
  });

  test('Parse nested associations.', function() {
    var user = new User({id: 1, memberships: [{id: 3}]});
    user.parse({memberships: [{id: 3, group: {id: 2}}]});
    strictEqual(user.memberships.at(0).group.id, 2);
  });

})();
