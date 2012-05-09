
                                           |     |
    ,---..   .,---.,---.,---.,-.-.,---.,---|,---.|
    `---.|   ||   ||---'|    | | ||   ||   ||---'|
    `---'`---'|---'`---'`    ` ' '`---'`---'`---'`---'
              |


[![Build Status](https://secure.travis-ci.org/pathable/supermodel.png)](http://travis-ci.org/pathable/supermodel)

Supermodel is a small extension for tracking collections, models, and their
associations with [Backbone.js][backbone].

*Note: This is alpha software.  A similar version has been used at pathable
for quite some time but your milage may vary.*

## Model

`Supermodel.Model` is an extension of `Backbone.Model` that handles the
tracking and creation of individual models.


### Model Tracking

In large applications there are often multiple model objects representing the
same server object.  This can cause synchronization problems and cause the
display of stale data.  For instance,

```javascript
var user = new User({id: 5}).fetch();
...
var duplicate = new User({id: 5, name: 'brad'}).fetch();
user.get('name') == duplicate.get('name'); // false :(
```

If the server is updated while these models are being fetched the two
instances may have conflicting attributes.  To circumvent this, Supermodel
tracks models in the `all` property of the constructor (which is itself a
collection) and returns existing models instead of creating new ones when
possible.

```javascript
var user = User.create({id: 5});
User.create({id: 5}) === user; // true
User.all.get(5) === user; // true
```


### Model.create

In order to track models, Supermodel needs to check for their existence before
returning a new model.  This is the job of `Model.create`.

```javascript
var User = Supermodel.Model.extend();
var user = User.create();
```

You should also use `Model.create` for the `model` property of your
collections.  This ensures that models created by your collections are tracked
and not duplicates.

```javascript
var Users = Backbone.Collection.extend({
  model: User.create
});
```

When using an existing model, it's assumed that the attributes provided are
newer than the existing attributes and they are updated.

```javascript
var user = User.create({id: 5, name: 'bradley'});
user = User.create({id: 5, name: 'brad'});
user.get('name'); // brad
```

#### Collections

To declare a collection for a `Supermodel.Model` you'll need to use a factory
function rather than simply setting the model.  This is so that collections
can also use `Model.create` and benefit from tracking.

```javascript
var Users = Backbone.Collection.extend({

  model: function(attrs, options) {
    return User.create(attrs, options);
  }

});
```


### Model.all

Each model is stored in the `all` collection on the constructor for tracking
and event propagation.  These are rather handy for tracking events on an
entire collection.

```javascript
  var User = Supermodel.Model.extend();
  var user = User.create({id: 3});
  User.all.get(3) === user; // true
```

These also work for child constructors.

```javascript
  var Admin = User.extend();
  var admin = Admin.create({id: 2});
  Admin.all.get(2) === admin; // true
  User.all.get(2) === admin; // true
```

A few things to keep in mind about inheritance with `all` collections:

* All models with a common ancestor in their prototype chain
  (excluding `Supermodel.Model`) are assumed to have unique ids.
* Models should always be created with the most specialized constructor
  possible.  A model's super model can be deduced from the prototype chain, but
  its sub model cannot.

Whenever possible Supermodel attempts to prevent duplicate models but it's
still possible to corrupt the `all` collection.  For instance, creating a new
model without an `id` and then setting `id` to an existing models value will
cause problems.  However, this is no different than regular everyday backbone.

```javascript
var user = User.create({id: 5});
var impostor = User.create();
impostor.set({id: 5});
User.all.get(5) === impostor; // true
```

It's generally best to not set ids explicitly but only rely on server data for
this.

*Note: `all` collections are not intended to be modified.  Doing so is not
supported and can have negative consequences for model tracking.*


### Model.reset

`Supermodel.Model.reset` is used to remove associations and tracked models so
they can be garbage collected.  This is also useful for testing.

```javascript
var user = User.create({id: 3});
User.reset();
User.all.get(3); // null
```


## Associations

When initializing models or changing their attributes, there is often plenty
of information to wire up associations between models.

```javascript
var user = new User({id: 5});
var membership = new Membership({id: 2, user_id: 5});

membership.user === user; // false :(
user.memberships.contains(membership); // false :(
```

The problem is finding the correct model and ensuring it's the canonical
representation of that model.  `Supermodel.Model` already handles these things
for us so all that's left is to wire up specific associations.

```javascript
User.has().many('memberships', {
  collection: Memberships,
  inverse: 'user'
});

Membership.has().one('user', {
  model: User,
  inverse: 'memberships'
});

var user = User.create({id: 5});
var membership = Membership.create({id: 2, user_id: 5});

membership.user() === user; // true :D
user.memberships().contains(membership); // true :D
```

When models are created or changed, they're inspected for appropriate
attributes and the associated properties are set.  When a model becomes
associated or dissociated with another model an `'associate'` or
`'dissociate'` event is triggered, respectively.

Association properties are retrieved using a getter function.  This allows
optimizations such as lazy-loading through collections.  Other associations
may be lazy-loaded in the future as well.

## has

Associations are specified using `Model.has`.  This prevents naming collisions
and provides a convenient extension point outside of `Model` itself.

### one

*Constructor.has().one(name, options)*

Instances of **Constructor** should contain a reference to one model, stored
in the property specified by **store** and retrieved using the function
specified by **name**.

```
User.has().one('settings', {
  model: Settings,
  inverse: 'user'
});

Settings.has().one('user', {
  model: User,
  inverse: 'settings'
});

var user = User.create({id: 2});
var settings = Settings.create({user_id: 2});

settings.user() === user; // true
user.settings() === settings; // true
```

#### options

- *model* - The constructor to use when creating the associated model.
- *inverse* - The name of the inverse association, for notifying the
  associated   model of `'associate'` and `'dissociate'` events.
- *id* - The attribute where the id of the associated model is stored.
- *source* - The attribute where the associated model's attributes are stored.
- *store* - The property where the model should be stored. Defaults to '_' +
  **name**.

### many

*Constructor.has().many(name, options)*

Instances of **Constructor** should contain a collection with many models,
retrieved with a function stored at **store** and retrieved with the function
stored at **name**.

```javascript
User.has().many('memberships', {
  collection: Memberships,
  inverse: 'user'
});

Membership.has().one('user', {
  model: User,
  inverse: 'memberships'
});

var user = User.create({id: 5});
var membership = Membership.create({id: 2, user_id: 5});

membership.user() === user; // true :D
user.memberships().contains(membership); // true :D
```


#### options

* *collection* - The constructor to use when creating the associated
  collection.
* *inverse* - The name of the inverse association, for notifying the
  associated model of `'associate'` and `'dissociate'` events.
* *source* - The attribute where the associated models' attributes are stored.
* *store* - The property where the collection should be stored. Defaults to
  '_' + **name**.
* *through* - The name of the through collection.


### through

The functionality of `many` is changed significantly when a `through` option
is specified.  It's intended to track many-to-many associations through other
collections.  For example:

```javascript
User.has()
  .many('memberships', {
    collection: Memberships,
    inverse: 'user'
  })
  .many('groups', {
    collection: Groups,
    through: 'memberships'
  });

Membership.has()
  .one('user', {
    model: User,
    inverse: 'memberships'
  })
  .one('group', {
    model: Group,
    inverse: 'memberships'
  });

Group.has()
  .many('memberships', {
    collection: Memberships,
    inverse: 'group'
  })
  .many('users', {
    collection: Users,
    through: 'memberships'
  });

var user = User.create({id: 3});
var group = Group.create({id: 6});
var membership = Membership.create({user_id: 3, group_id: 6});

membership.user() === user; // true
membership.group() === user; // true

user.memberships().contains(membership); // true
group.memberships().contains(membership); // true

user.groups().contains(group); // true
group.users().contains(user); // true
```

[backbone]: http://backbonejs.org
