var _ = require('underscore');
var Backbone = require('backbone');
var Supermodel = require('../supermodel');

var Model = Supermodel.Model;
var Collection = Backbone.Collection;

var User = Model.extend();
var Admin = User.extend({}, {parent: User});
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

var test = function(name, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = null;
  }
  require('tape')(name, options, function(t) {

    Model.reset();
    User.reset();
    Admin.reset();
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

    callback(t);
  });
};

// Associations

test('Associations are created lazily.', function(t) {
  var user = User.create({id: 5});
  _.each(_.values(User.associations()), function(association) {
    t.ok(!user[association.store]);
  });
  t.end();
});

test('Collections handle duplicates correctly.', function(t) {
  var users = new Users([{id: 1}]);
  users.add({id: 1, name: 'brad'}, {merge: true});
  t.is(users.at(0).get('name'), 'brad');
  t.end();
});

test('Adding duplicate associations throws.', function(t) {

  t.throws(function() {
    User.has().one('settings', {
      model: Settings,
      inverse: 'user'
    });
  }, function(e) {
    return e.message === 'Association already exists: settings';
  });

  t.throws(function() {
    Admin.has().one('settings', {
      model: Settings,
      inverse: 'user'
    });
  }, function(e) {
    return e.message === 'Association already exists: settings';
  });

  t.end();
});

// One

test('Required fields.', function(t) {

  t.throws(function() {
    User.has().one(null, {
      model: Model,
      inverse: 'inverse'
    });
  }, function(e) {
    return e.message === 'Option required: name';
  }, 'name');

  t.throws(function() {
    User.has().one('name', {
      model: Model
    });
  }, function(e) {
    return e.message === 'Option required: inverse';
  }, 'inverse');

  t.throws(function() {
    User.has().one('name', {
      inverse: 'inverse'
    });
  }, function(e) {
    return e.message === 'Option required: model';
  }, 'model');
  t.end();
});

test('Parsing with null id.', function(t) {
  var membership = Membership.create({user_id: 2});
  membership.parse({user: {x: 1}});
  t.is(membership.user().get('x'), 1);
  t.end();
});

test('Setting associations.', function(t) {
  var user = User.create({id: 5});
  var membership = Membership.create({id: 3, user_id: 5});
  t.ok(membership.user() === user, 'Initialize association.');
  membership.set({user_id: null});
  t.ok(!membership.user(), 'Remove association on change.');
  membership.set({user_id: 5});
  t.ok(membership.user() === user, 'Add association on change.');
  t.end();
});

test('Parsing associations.', function(t) {
  var membership = Membership.create({id: 2});
  membership.parse({user: {id: 4}});
  var user = membership.user();
  t.ok(user instanceof User);
  t.is(user.id, 4);
  // Association should not be removed if not included.
  membership.parse({});
  t.ok(membership.user() === user);
  t.end();
});

test('Parsing a model with associations handles null response without puking and dying', function(t) {
  var user = User.create({id: 1});
  t.ok(user.parse(null) === null);
  t.end();
});

test('Handle ids that are strings.', function(t) {
  var user = User.create({id: 3});
  var membership = Membership.create({id: 2, user_id: '3'});
  t.ok(membership.user() === user);
  membership.set({user_id: '3'});
  t.ok(membership.user() === user);
  t.end();
});

test('Parse without id attribute.', function(t) {
  var membership = Membership.create({id: 1});
  membership.parse({user: {id: 2}});
  var user = membership.user();
  t.ok(user instanceof User);
  t.is(user.id, 2);
  t.end();
});

test('With inverse.', function(t) {
  var user = User.create({id: 1});
  var settings = Settings.create({_id: 1, user_id: 1});

  t.ok(user.settings() === settings);
  t.is(user.get('settings_id'), 1);
  t.ok(settings.user() === user);
  t.is(settings.get('user_id'), 1);

  user.unset('settings_id');
  t.ok(!user.settings());
  t.ok(!user.get('settings_id'));
  t.ok(!settings.user());
  t.ok(!settings.get('user_id'));
  t.end();
});

test('Dissociate on destroy.', function(t) {
  var user = User.create({id: 1});
  var settings = Settings.create({id: 1, user_id: 1});

  settings.trigger('destroy', settings);
  t.ok(!user.settings());
  t.ok(!user.get('settings_id'));
  t.ok(!settings.user());
  t.ok(!settings.get('user_id'));
  t.end();
});

test('Respect idAttribute', function(t) {
  var user = User.create({id: 1});
  var settings = Settings.create({_id: 2});
  user.set({settings_id: 2});
  t.ok(user.settings() === settings);
  t.end();
});

test('Set association.', function(t) {
  var user = User.create();
  var settings = Settings.create();
  user.settings(settings);
  t.ok(user.settings() === settings);
  t.ok(settings.user() === user);
  user.settings(null);
  t.ok(!user.settings());
  t.ok(!settings.user());
  t.end();
});

// Many To One

test('Required fields.', function(t) {

  t.throws(function() {
    User.has().many(null, {
      collection: Collection,
      inverse: 'inverse'
    });
  }, function(e) {
    return e.message === 'Option required: name';
  }, 'name');

  t.throws(function() {
    User.has().many('name', {
      collection: Collection
    });
  }, function(e) {
    return e.message === 'Option required: inverse';
  }, 'inverse');

  t.throws(function() {
    User.has().many('name', {
      inverse: 'inverse'
    });
  }, function(e) {
    return e.message === 'Option required: collection';
  }, 'collection');
  t.end();
});

test('Many is initialized only once.', function(t) {
  var user = User.create();
  var memberships = user.memberships();
  User.all().trigger('add', user, User.all());
  t.ok(user.memberships() === memberships);
  t.end();
});

test('Source is removed after parsing.', function(t) {
  var user = User.create();
  user.parse({memberships: [{id: 1}, {id: 2, hidden: true}]});
  t.is(user.memberships().length, 1);
  t.is(user.memberships().at(0).id, 1);
  t.ok(!user.get('memberships'));

  user = User.create({memberships: [{id: 3}, {id: 4, hidden: true}]});
  t.is(user.memberships().length, 1);
  t.is(user.memberships().at(0).id, 3);
  t.ok(!user.get('memberships'));
  t.end();
});

test('Associations are triggered on "change".', 2, function(t) {
  var user = User.create({id: 2});
  var membership = Membership.create({id: 3});
  user.on('associate:memberships', function() {
    t.is(membership.get('x'), true);
  });
  membership.on('associate:user', function() {
    t.is(membership.get('x'), true);
  });
  membership.set({user_id: 2, x: true});
  t.end();
});

test('Update associations on parse.', function(t) {
  var user = User.create({id: 1});
  user.parse({memberships: [{id: 2, group: {id: 3}}]});
  var membership = user.memberships().at(0);
  t.is(membership.id, 2);
  t.is(membership.group().id, 3);
  user.parse({memberships: [{id: 4, group: {id: 5}}]});
  membership = user.memberships().at(0);
  t.is(membership.id, 4);
  t.is(membership.group().id, 5);
  t.end();
});

test('Many with source.', function(t) {
  var user = User.create({id: 1, affiliations: [
    {id: 2},
    {id: 3, hidden: true}
  ]});
  t.is(user.affiliations().at(0).id, 2);
  t.end();
});

test('Many references correct inverse.', function(t) {
  var user = User.create({id: 1, memberships: [{id: 2}]});
  var membership = user.memberships().at(0);
  t.ok(membership.user() === user);
  t.is(membership.id, 2);
  t.end();
});

test('Dissociate when removed.', function(t) {
  var user = User.create({id: 1, memberships: [{id: 2}]});
  var membership = user.memberships().at(0);
  t.ok(membership.user() === user);
  user.memberships().remove(membership);
  t.ok(!membership.user());
  t.end();
});

test('Associate on add.', function(t) {
  var user = User.create();
  var membership = Membership.create();
  user.memberships().add(membership);
  t.ok(membership.user() === user);
  t.end();
});

test('Add on associate.', function(t) {
  var user = User.create({id: 1});
  var membership = Membership.create();
  membership.parse({user: {id: 1}});
  t.ok(user.memberships().at(0) === membership, 'Membership added.');
  t.ok(membership.user() === user, 'User property set.');

  user = User.create({id: 2});
  membership = Membership.create().set({user_id: 2});
  t.ok(user.memberships().at(0) === membership, 'Membership added.');
  t.ok(membership.user() === user, 'User property set.');

  user = User.create({id: 3});
  membership = Membership.create({hidden: true}).set({user_id: 3});
  t.ok(!user.memberships().length, 'Hidden membership is filtered.');
  t.ok(membership.user() === user, 'User property is still set.');
  t.end();
});

test('Remove on dissociate.', function(t) {
  var user = User.create({id: 1, memberships: [{id: 2}]});
  t.is(user.memberships().length, 1);
  var membership = user.memberships().at(0);
  membership.unset('user_id');
  t.is(user.memberships().length, 0);
  t.ok(!membership.user());
  t.end();
});

test('Set id attribute.', function(t) {
  var user = User.create({id: 1, memberships: [{id: 2}]});
  t.is(user.memberships().at(0).get('user_id'), 1);
  var membership = Membership.create({id: 3, user: {id: 4}});
  t.is(membership.get('user_id'), 4);
  t.end();
});

test('Use id attribute.', function(t) {
  var membership = Membership.create({user_id: 1});
  t.is(membership.user().id, 1);
  t.end();
});

test('Watch id attribute.', function(t) {
  var membership = Membership.create();
  membership.set({user_id: 1});
  t.is(membership.user().id, 1);
  t.end();
});

test('Do not use null/undefined id attribute.', function(t) {
  var membership = Membership.create();
  membership.set({user_id: null});
  t.ok(!membership.user());
  membership.set({user_id: undefined});
  t.ok(!membership.user());
  membership.unset('user_id');
  t.ok(!membership.user());
  t.end();
});

test('Unset id attribute.', function(t) {
  var membership = Membership.create({user: {id: 1}});
  membership.unset('user_id');
  t.ok(!membership.get('user_id'));
  t.ok(!membership.user());
  t.end();
});

// TODO: Petition for better reset notifications.
if (false) {
  test('Dissociate on reset.', 0, function(t) {
    var user = User.create({memberships: [{id: 1}]});
    var membership = user.memberships().at(0);
    user.memberships().reset([]);
    t.is(user.memberships().length, 0);
    t.ok(!membership.user());
  });
}

test('Remove id attribute on dissociate.', function(t) {
  var membership = Membership.create({id: 1, user_id: 2});
  t.is(membership.get('user_id'), 2);
  membership.user().memberships().remove(membership);
  t.ok(!membership.get('user_id'));
  t.end();
});

test('Associate on reset.', function(t) {
  var user = User.create();
  var membership = Membership.create();
  user.memberships().reset([membership]);
  t.is(user.memberships().length, 1);
  t.ok(user.memberships().at(0) === membership);
  t.ok(membership.user() === user);
  t.end();
});

test('Remove on destroy.', function(t) {
  var membership = Membership.create({user_id: 1});
  membership.user().trigger('destroy', membership.user());
  t.ok(!membership.user());
  t.ok(!membership.get('user_id'));
  t.end();
});

test('Add on creation.', function(t) {
  var user = User.create({id: 1});
  var membership = Membership.create({id: 2, user: {id: 1}});
  t.is(user.memberships().length, 1);
  t.ok(user.memberships().at(0) === membership);
  t.end();
});

test('Add on set.', function(t) {
  var user = User.create({id: 1});
  var membership = Membership.create({id: 2});
  membership.set({user_id: 1});
  t.is(user.memberships().length, 1);
  t.ok(user.memberships().at(0) === membership);
  t.ok(membership.user() === user);
  t.end();
});

test('Remove on set.', function(t) {
  var user = User.create({id: 1, memberships: [{id: 2}]});
  var membership = user.memberships().at(0);
  membership.set({user_id: null});
  t.is(user.memberships().length, 0);
  t.end();
});

test('Parse nested associations.', function(t) {
  var user = User.create({id: 1, memberships: [{id: 3}]});
  user.parse({memberships: [{id: 3, group: {id: 2}}]});
  t.is(user.memberships().at(0).group().id, 2);
  t.end();
});

// Many To Many

test('Required fields.', function(t) {

  t.throws(function() {
    User.has().many(null, {
      collection: Collection,
      through: 'through',
      source: 'source'
    });
  }, function(e) {
    return e.message === 'Option required: name';
  }, 'name');

  t.throws(function() {
    User.has().many('name', {
      source: 'source',
      through: 'through'
    });
  }, function(e) {
    return e.message === 'Option required: collection';
  }, 'collection');

  t.throws(function() {
    User.has().many('name', {
      through: 'through',
      collection: Collection
    });
  }, function(e) {
    return e.message === 'Option required: source';
  }, 'source');

  t.end();
});

test('Collection is initialized.', function(t) {
  var user = User.create({
    memberships: [
      {group: {id: 1}},
      {group_id: 2},
      {group: {id: 3}},
      {group: {id: 4, hidden: true}}
    ]
  });
  t.is(user.groups().length, 3);
  t.same(user.groups().pluck('id').sort(), [1, 2, 3]);
  t.end();
});

test('Models are uniqued.', function(t) {
  var user = User.create({
    memberships: [
      {group: {id: 1}},
      {group_id: 1},
      {group: {id: 2}},
      {group: {id: 3, hidden: true}}
    ]
  });
  t.is(user.groups().length, 2);
  t.is(user.groups().at(0).id, 1);
  t.end();
});

test('Handle reset.', function(t) {
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
  t.is(user.groups().length, 2);
  t.same(user.groups().pluck('id').sort(), [3, 4]);
  t.end();
});

test('Add models.', function(t) {
  var user = User.create();
  user.groups();
  user.memberships().add([
    {group: {id: 1}},
    {group: {id: 2}},
    {group: {id: 3, hidden: true}}
  ]);
  t.is(user.groups().length, 2);
  t.same(user.groups().pluck('id').sort(), [1, 2]);
  t.end();
});

test('Add duplicate models.', function(t) {
  var user = User.create({memberships: [{group: {id: 1}}]});
  user.groups();
  user.memberships().add({group: {id: 1}});
  t.is(user.groups().length, 1);
  t.is(user.groups().at(0).id, 1);
  t.end();
});

test('Remove models.', function(t) {
  var user = User.create({memberships: [{id: 1, group: {id: 2}}]});
  t.is(user.groups().length, 1);
  t.is(user.memberships().length, 1);
  user.memberships().remove(1);
  t.ok(user.groups().isEmpty());
  t.end();
});

test('Remove duplicate models.', function(t) {
  var user = User.create({memberships: [
    {id: 1, group: {id: 2}},
    {id: 3, group: {id: 2}}
  ]});
  t.is(user.groups().length, 1);
  user.memberships().remove(3);
  t.is(user.groups().length, 1);
  t.end();
});

test('Add from id attribute.', function(t) {
  var user = User.create({id: 1});
  var group = Group.create({id: 2});
  t.ok(user.groups().isEmpty());
  t.ok(group.users().isEmpty());
  user.memberships().add({id: 3, group_id: 2, user_id: 1});
  t.is(user.groups().length, 1);
  t.is(group.users().length, 1);
  t.ok(user.groups().at(0) === group);
  t.ok(group.users().at(0) === user);
  t.end();
});

test('Add on change.', function(t) {
  var group = Group.create({id: 1});
  Group.create({id: 4, hidden: true});
  var user = User.create({id: 2, memberships: [{id: 3}]});
  var membership = user.memberships().at(0);

  t.ok(user.groups().isEmpty());
  membership.set({group_id: 1});
  t.ok(user.groups().at(0) === group);
  t.ok(group.users().at(0) === user);

  membership.set({group_id: 4});
  t.ok(user.groups().isEmpty());
  t.end();
});

test('Remove on change.', function(t) {
  var group = Group.create({id: 1});
  var user = User.create({
    id: 2,
    memberships: [
      {id: 3, group: {id: 1}},
      {id: 4, group: {id: 1}}
    ]
  });
  t.ok(user.groups().at(0) === group);
  t.ok(group.users().at(0) === user);
  user.memberships().get(3).unset('group_id');
  t.ok(user.groups().at(0) === group);
  t.ok(group.users().at(0) === user);
  user.memberships().get(4).unset('group_id');
  t.ok(user.groups().isEmpty());
  t.ok(group.users().isEmpty());
  t.end();
});

test('Remove on destroy.', function(t) {
  var group = Group.create({id: 1});
  var user = User.create({id: 2, memberships: [{id: 3, group: {id: 1}}]});
  var membership = user.memberships().at(0);
  t.ok(group.users().at(0) === user);
  t.ok(user.groups().at(0) === group);
  membership.trigger('destroy', membership);
  t.ok(user.memberships().isEmpty());
  t.ok(user.groups().isEmpty());
  t.ok(group.memberships().isEmpty());
  t.ok(group.users().isEmpty());
  t.end();
});

test('Nested Parse.', function(t) {
  var Parent = Supermodel.Model.extend({});
  var Child = Supermodel.Model.extend({
    parse: function(res) {
      t.same(res, {
        id: 2,
        stuff: 'nonsense'
      });
    }
  });

  Parent.has().one('child', {
    model: Child,
    inverse: 'parent'
  });

  Child.has().one('parent', {
    model: Parent,
    inverse: 'child'
  });

  Parent.create({
    id: 1,
    foo: 'bar',
    child: {
      id: 2,
      stuff: 'nonsense'
    }
  });

  t.end();
});

test('Jsonifies a model and their associations by configuration.', function(t) {
  var Parent = Supermodel.Model.extend({});
  var Child = Supermodel.Model.extend({});

  Parent.has().one('child', {
    model: Child,
    includeInJson: 'stuff',
    inverse: 'parent'
  });

  Child.has().one('parent', {
    model: Parent,
    includeInJson: false,
    inverse: 'child'
  });

  var p1 = Parent.create({
    id: 1,
    foo: 'bar'
  });

  var ch1 = Child.create({
      id: 2,
      stuff: 'nonsense'
  });

  p1.child(ch1); 

  var p1Json = p1.toJSON();
  // Output contains 'child' association and 'stuff' attribute is only shown
  var assocKeys = [p1.constructor._associations.child.includeInJson];
  var outputKeys = Object.keys(p1Json.child);

  t.same(_.difference(assocKeys, outputKeys).length, 0);

  var ch1Json = ch1.toJSON();  
  // Output does not contains 'parent' association'
  t.ok(typeof ch1Json.parent == 'undefined');

  t.end();
});

test('Jsonifies a model and their associations by parameter.', function(t) {
  var user = User.create({
    id: 2, 
    memberships: [{
      id: 3,
      group: {
        id: 1,
        name: "SuperTeam"
      }
    }],
    settings: {
      id: 1
    }
  });

  var includeInJson = {
    // Memberships assoc included and 'id' attribute is only shown
    memberships: 'id',
    // Groups assoc included and 'id' and 'name' attribute are shown
    groups: ['id', 'name'],
    // Settings assoc included and all attributes are shown
    settings: true,
    // Affiliations assoc included and all attributes are shown
    affiliations: true
  };

  var json = user.toJSON({
    includeInJson: includeInJson
  });

  // Output contains configured associations
  var attrsKeys = Object.keys(user.attributes);
  var assocKeys = Object.keys(includeInJson);
  var allKeys = _.union(attrsKeys, assocKeys);

  var outputKeys = Object.keys(json);

  t.same(_.difference(allKeys, outputKeys).length, 0);

  // Output contains 'affiliations' association 
  // but has not associated instances linked, thus is empty
  t.same(json.affiliations.length, 0);

  // Output contains 'membership' association and only 'id' attr is shown
  var memKey = [includeInJson.memberships];
  var outputMemKeys = Object.keys(json.memberships[0]);

  t.same(outputMemKeys, memKey);

  // Output contains 'groups' association and 'id' and 'name' is shown
  var groupKeys = includeInJson.groups;
  var outputGroupKeys = Object.keys(json.groups[0]);

  t.same(outputGroupKeys, groupKeys);

  // Output contains 'settings' association and all attributes are shown
  var settKeys = Object.keys(user.settings().attributes);
  var outputSettKeys = Object.keys(json.settings);

  t.same(settKeys, outputSettKeys);

  t.end();
});

test('Includes and excludes configured attributes when jsonify.', function(t) {
  var user = User.create({
    id: 2,
    name: "James"
  });

  var json = user.toJSON({
    includeAttrs: 'name'
  });

  // Output only contain 'name' attribute
  var outputKeys = Object.keys(json);

  t.same(['name'], outputKeys);

  json = user.toJSON({
    excludeAttrs: 'cid'
  });

  // 'cid' attribute is excluded from output
  outputKeys = Object.keys(json);

  t.same(outputKeys.indexOf('cid'), -1);

  t.end();
});


