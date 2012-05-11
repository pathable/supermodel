(function() {

  var Model = Supermodel.Model;
  var Collection = Backbone.Collection;

  var User = Model.extend();
  var Membership = Model.extend();
  var Group = Model.extend();
  var Settings = Model.extend({idAttribute: '_id'});

  var visible = function(model) {
    return !model.get('hidden');
  };

  var Users = Collection.extend({
    model: function(attrs, options){
      return User.create(attrs, options);
    }
  });

  var Memberships = Collection.extend({
    model: function(attrs, options){
      return Membership.create(attrs, options);
    }
  });

  var Groups = Collection.extend({
    model: function(attrs, options){
      return Group.create(attrs, options);
    }
  });

  var setup = function() {

    User.reset();
    Settings.reset();
    Membership.reset();
    Group.reset();

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
        inverse: 'user',
        where: visible
      })
      .many('affiliations', {
        source: 'affiliations',
        collection: Memberships,
        inverse: 'user',
        where: visible
      })
      .many('groups', {
        source: 'group',
        collection: Groups,
        through: 'memberships',
        where: visible
      });

    Group.has()
      .many('memberships', {
        collection: Memberships,
        inverse: 'group',
        where: visible
      })
      .many('users', {
        source: 'user',
        collection: Users,
        through: 'memberships',
        where: visible
      });
  };

  module('Associations', {setup: setup});

  test('Collections handle duplicates correctly.', function() {
    var users = new Users([{id: 1}]);
    users.add({id: 1, name: 'brad'});
    strictEqual(users.at(0).get('name'), 'brad');
  });

  test('Adding duplicate associations throws.', function() {
    raises(function() {
      User.has().one('settings', {
        model: Settings,
        inverse: 'user'
      });
    }, function(e) {
      return e.message === 'Association already exists: settings';
    });
  });

  module('One', {setup: setup});

  test('Required fields.', function() {

    raises(function() {
      User.has().one(null, {
        model: Model,
        inverse: 'inverse'
      });
    }, function(e) {
      return e.message === 'Option required: name';
    }, 'name');

    raises(function() {
      User.has().one('name', {
        model: Model
      });
    }, function(e) {
      return e.message === 'Option required: inverse';
    }, 'inverse');

    raises(function() {
      User.has().one('name', {
        inverse: 'inverse'
      });
    }, function(e) {
      return e.message === 'Option required: model';
    }, 'model');
  });

  test('Parsing with null id.', function() {
    var membership = Membership.create({user_id: 2});
    membership.parse({user: {x: 1}});
    strictEqual(membership.user().get('x'), 1);
  });

  test('Setting associations.', function() {
    var user = User.create({id: 5});
    var membership = Membership.create({id: 3, user_id: 5});
    ok(membership.user() === user, 'Initialize association.');
    membership.set({user_id: null});
    ok(!membership.user(), 'Remove association on change.');
    membership.set({user_id: 5});
    ok(membership.user() === user, 'Add association on change.');
  });

  test('Parsing associations.', function() {
    var membership = Membership.create({id: 2});
    membership.parse({user: {id: 4}});
    var user = membership.user();
    ok(user instanceof User);
    strictEqual(user.id, 4);
    // Association should not be removed if not included.
    membership.parse({});
    ok(membership.user() === user);
  });

  test('Handle ids that are strings.', function() {
    var user = User.create({id: 3});
    var membership = Membership.create({id: 2, user_id: '3'});
    ok(membership.user() === user);
    membership.set({user_id: '3'});
    ok(membership.user() === user);
  });

  test('Parse without id attribute.', function() {
    var membership = Membership.create({id: 1});
    membership.parse({user: {id: 2}});
    var user = membership.user();
    ok(user instanceof User);
    strictEqual(user.id, 2);
  });

  test('With inverse.', function() {
    var user = User.create({id: 1});
    var settings = Settings.create({_id: 1, user_id: 1});

    ok(user.settings() === settings);
    strictEqual(user.get('settings_id'), 1);
    ok(settings.user() === user);
    strictEqual(settings.get('user_id'), 1);

    user.unset('settings_id');
    ok(!user.settings());
    ok(!user.get('settings_id'));
    ok(!settings.user());
    ok(!settings.get('user_id'));
  });

  test('Dissociate on destroy.', function() {
    var user = User.create({id: 1});
    var settings = Settings.create({id: 1, user_id: 1});

    settings.trigger('destroy', settings);
    ok(!user.settings());
    ok(!user.get('settings_id'));
    ok(!settings.user());
    ok(!settings.get('user_id'));
  });

  test('Respect idAttribute', function() {
    var user = User.create({id: 1});
    var settings = Settings.create({_id: 2});
    user.set({settings_id: 2});
    ok(user.settings() === settings);
  });

  test('Set association.', function() {
    var user = User.create();
    var settings = Settings.create();
    user.settings(settings);
    ok(user.settings() === settings);
    ok(settings.user() === user);
    user.settings(null);
    ok(!user.settings());
    ok(!settings.user());
  });

  module('Many To One', {setup: setup});

  test('Required fields.', function() {

    raises(function() {
      User.has().many(null, {
        collection: Collection,
        inverse: 'inverse'
      });
    }, function(e) {
      return e.message === 'Option required: name';
    }, 'name');

    raises(function() {
      User.has().many('name', {
        collection: Collection
      });
    }, function(e) {
      return e.message === 'Option required: inverse';
    }, 'inverse');

    raises(function() {
      User.has().many('name', {
        inverse: 'inverse'
      });
    }, function(e) {
      return e.message === 'Option required: collection';
    }, 'collection');
  });

  test('Set inverse property.', function() {
    var user = User.create();
    ok(user.memberships().user === user);
  });

  test('Many is initialized only once.', function() {
    var user = User.create();
    var memberships = user.memberships();
    User.all().trigger('add', user, User.all());
    ok(user.memberships() === memberships);
  });

  test('Source is removed after parsing.', function() {
    var user = User.create();
    user.parse({memberships: [{id: 1}, {id: 2, hidden: true}]});
    strictEqual(user.memberships().length, 1);
    strictEqual(user.memberships().at(0).id, 1);
    ok(!user.get('memberships'));

    user = User.create({memberships: [{id: 3}, {id: 4, hidden: true}]});
    strictEqual(user.memberships().length, 1);
    strictEqual(user.memberships().at(0).id, 3);
    ok(!user.get('memberships'));
  });

  test('Associations are triggered on "change".', 2, function() {
    var user = User.create({id: 2});
    var membership = Membership.create({id: 3});
    user.on('associate:memberships', function() {
      strictEqual(membership.get('x'), true);
    });
    membership.on('associate:user', function() {
      strictEqual(membership.get('x'), true);
    });
    membership.set({user_id: 2, x: true});
  });

  test('Update associations on parse.', function() {
    var user = User.create({id: 1});
    user.parse({memberships: [{id: 2, group: {id: 3}}]});
    var membership = user.memberships().at(0);
    strictEqual(membership.id, 2);
    strictEqual(membership.group().id, 3);
    user.parse({memberships: [{id: 4, group: {id: 5}}]});
    membership = user.memberships().at(0);
    strictEqual(membership.id, 4);
    strictEqual(membership.group().id, 5);
  });

  test('Many with source.', function() {
    var user = User.create({id: 1, affiliations: [
      {id: 2},
      {id: 3, hidden: true}
    ]});
    strictEqual(user.affiliations().at(0).id, 2);
  });

  test('Many references correct inverse.', function() {
    var user = User.create({id: 1, memberships: [{id: 2}]});
    var membership = user.memberships().at(0);
    ok(membership.user() === user);
    strictEqual(membership.id, 2);
  });

  test('Dissociate when removed.', function() {
    var user = User.create({id: 1, memberships: [{id: 2}]});
    var membership = user.memberships().at(0);
    ok(membership.user() === user);
    user.memberships().remove(membership);
    ok(!membership.user());
  });

  test('Associate on add.', function() {
    var user = User.create();
    var membership = Membership.create();
    user.memberships().add(membership);
    ok(membership.user() === user);
  });

  test('Add on associate.', function() {
    var user = User.create({id: 1});
    var membership = Membership.create();
    membership.parse({user: {id: 1}});
    ok(user.memberships().at(0) === membership, 'Membership added.');
    ok(membership.user() === user, 'User property set.');

    user = User.create({id: 2});
    membership = Membership.create().set({user_id: 2});
    ok(user.memberships().at(0) === membership, 'Membership added.');
    ok(membership.user() === user, 'User property set.');

    user = User.create({id: 3});
    membership = Membership.create({hidden: true}).set({user_id: 3});
    ok(!user.memberships().length, 'Hidden membership is filtered.');
    ok(membership.user() === user, 'User property is still set.');
  });

  test('Remove on dissociate.', function() {
    var user = User.create({id: 1, memberships: [{id: 2}]});
    strictEqual(user.memberships().length, 1);
    var membership = user.memberships().at(0);
    membership.unset('user_id');
    strictEqual(user.memberships().length, 0);
    ok(!membership.user());
  });

  test('Set id attribute.', function() {
    var user = User.create({id: 1, memberships: [{id: 2}]});
    strictEqual(user.memberships().at(0).get('user_id'), 1);
    var membership = Membership.create({id: 3, user: {id: 4}});
    strictEqual(membership.get('user_id'), 4);
  });

  test('Use id attribute.', function() {
    var membership = Membership.create({user_id: 1});
    strictEqual(membership.user().id, 1);
  });

  test('Watch id attribute.', function() {
    var membership = Membership.create();
    membership.set({user_id: 1});
    strictEqual(membership.user().id, 1);
  });

  test('Do not use null/undefined id attribute.', function() {
    var membership = Membership.create();
    membership.set({user_id: null});
    ok(!membership.user());
    membership.set({user_id: undefined});
    ok(!membership.user());
    membership.unset('user_id');
    ok(!membership.user());
  });

  test('Unset id attribute.', function() {
    var membership = Membership.create({user: {id: 1}});
    membership.unset('user_id');
    ok(!membership.get('user_id'));
    ok(!membership.user());
  });

  // TODO: Petition for better reset notifications.
  if (false) {
    test('Dissociate on reset.', 0, function() {
      var user = User.create({memberships: [{id: 1}]});
      var membership = user.memberships().at(0);
      user.memberships().reset([]);
      strictEqual(user.memberships().length, 0);
      ok(!membership.user());
    });
  }

  test('Remove id attribute on dissociate.', function() {
    var membership = Membership.create({id: 1, user_id: 2});
    strictEqual(membership.get('user_id'), 2);
    membership.user().memberships().remove(membership);
    ok(!membership.get('user_id'));
  });

  test('Associate on reset.', function() {
    var user = User.create();
    var membership = Membership.create();
    user.memberships().reset([membership]);
    strictEqual(user.memberships().length, 1);
    ok(user.memberships().at(0) === membership);
    ok(membership.user() === user);
  });

  test('Remove on destroy.', function() {
    var membership = Membership.create({user_id: 1});
    membership.user().trigger('destroy', membership.user());
    ok(!membership.user());
    ok(!membership.get('user_id'));
  });

  test('Add on creation.', function() {
    var user = User.create({id: 1});
    var membership = Membership.create({id: 2, user: {id: 1}});
    strictEqual(user.memberships().length, 1);
    ok(user.memberships().at(0) === membership);
  });

  test('Add on set.', function() {
    var user = User.create({id: 1});
    var membership = Membership.create({id: 2});
    membership.set({user_id: 1});
    strictEqual(user.memberships().length, 1);
    ok(user.memberships().at(0) === membership);
    ok(membership.user() === user);
  });

  test('Remove on set.', function() {
    var user = User.create({id: 1, memberships: [{id: 2}]});
    var membership = user.memberships().at(0);
    membership.set({user_id: null});
    strictEqual(user.memberships().length, 0);
  });

  test('Parse nested associations.', function() {
    var user = User.create({id: 1, memberships: [{id: 3}]});
    user.parse({memberships: [{id: 3, group: {id: 2}}]});
    strictEqual(user.memberships().at(0).group().id, 2);
  });

  module('Many To Many', {setup: setup});

  test('Required fields.', function() {

    raises(function() {
      User.has().many(null, {
        collection: Collection,
        through: 'through'
      });
    }, function(e) {
      return e.message === 'Option required: name';
    }, 'name');

    raises(function() {
      User.has().many('name', {
        inverse: 'inverse',
        through: 'through'
      });
    }, function(e) {
      return e.message === 'Option required: collection';
    }, 'collection');

  });

  test('Collection is initialized.', function() {
    var user = User.create({
      memberships: [
        {group: {id: 1}},
        {group_id: 2},
        {group: {id: 3}},
        {group: {id: 4, hidden: true}}
      ]
    });
    strictEqual(user.groups().length, 3);
    deepEqual(user.groups().pluck('id').sort(), [1, 2, 3]);
  });

  test('Models are uniqued.', function() {
    var user = User.create({
      memberships: [
        {group: {id: 1}},
        {group_id: 1},
        {group: {id: 2}},
        {group: {id: 3, hidden: true}}
      ]
    });
    strictEqual(user.groups().length, 2);
    strictEqual(user.groups().at(0).id, 1);
  });

  test('Handle reset.', function() {
    var user = User.create({memberships: [
      {group: {id: 1}},
      {group: {id: 2}}
    ]});
    user.groups();
    user.memberships().reset([
      {group: {id: 3}},
      {group: {id: 4}},
      {group: {id: 5, hidden: true}}
    ]);
    strictEqual(user.groups().length, 2);
    deepEqual(user.groups().pluck('id').sort(), [3, 4]);
  });

  test('Add models.', function() {
    var user = User.create();
    user.groups();
    user.memberships().add([
      {group: {id: 1}},
      {group: {id: 2}},
      {group: {id: 3, hidden: true}}
    ]);
    strictEqual(user.groups().length, 2);
    deepEqual(user.groups().pluck('id').sort(), [1, 2]);
  });

  test('Add duplicate models.', function() {
    var user = User.create({memberships: [{group: {id: 1}}]});
    user.groups();
    user.memberships().add({group: {id: 1}});
    strictEqual(user.groups().length, 1);
    strictEqual(user.groups().at(0).id, 1);
  });

  test('Remove models.', function() {
    var user = User.create({memberships: [{id: 1, group: {id: 2}}]});
    strictEqual(user.groups().length, 1);
    strictEqual(user.memberships().length, 1);
    user.memberships().remove(1);
    ok(user.groups().isEmpty());
  });

  test('Remove duplicate models.', function() {
    var user = User.create({memberships: [
      {id: 1, group: {id: 2}},
      {id: 3, group: {id: 2}}
    ]});
    strictEqual(user.groups().length, 1);
    user.memberships().remove(3);
    strictEqual(user.groups().length, 1);
  });

  test('Add from id attribute.', function() {
    var user = User.create({id: 1});
    var group = Group.create({id: 2});
    ok(user.groups().isEmpty());
    ok(group.users().isEmpty());
    user.memberships().add({id: 3, group_id: 2, user_id: 1});
    strictEqual(user.groups().length, 1);
    strictEqual(group.users().length, 1);
    ok(user.groups().at(0) === group);
    ok(group.users().at(0) === user);
  });

  test('Add on change.', function() {
    var group = Group.create({id: 1});
    var hidden = Group.create({id: 4, hidden: true});
    var user = User.create({id: 2, memberships: [{id: 3}]});
    var membership = user.memberships().at(0);

    ok(user.groups().isEmpty());
    membership.set({group_id: 1});
    ok(user.groups().at(0) === group);
    ok(group.users().at(0) === user);

    membership.set({group_id: 4});
    ok(user.groups().isEmpty());
  });

  test('Remove on change.', function() {
    var group = Group.create({id: 1});
    var user = User.create({
      id: 2,
      memberships: [
        {id: 3, group: {id: 1}},
        {id: 4, group: {id: 1}}
      ]
    });
    ok(user.groups().at(0) === group);
    ok(group.users().at(0) === user);
    user.memberships().get(3).unset('group_id');
    ok(user.groups().at(0) === group);
    ok(group.users().at(0) === user);
    user.memberships().get(4).unset('group_id');
    ok(user.groups().isEmpty());
    ok(group.users().isEmpty());
  });

  test('Remove on destroy.', function() {
    var group = Group.create({id: 1});
    var user = User.create({id: 2, memberships: [{id: 3, group: {id: 1}}]});
    var membership = user.memberships().at(0);
    ok(group.users().at(0) === user);
    ok(user.groups().at(0) === group);
    membership.trigger('destroy', membership);
    ok(user.memberships().isEmpty());
    ok(user.groups().isEmpty());
    ok(group.memberships().isEmpty());
    ok(group.users().isEmpty());
  });

})();
