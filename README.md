                                                   _      _
                                                  | |    | |
     ___ _   _ _ __   ___ _ __ _ __ ___   ___   __| | ___| |
    / __| | | | '_ \ / _ \ '__| '_ ` _ \ / _ \ / _` |/ _ \ |
    \__ \ |_| | |_) |  __/ |  | | | | | | (_) | (_| |  __/ |
    |___/\__,_| .__/ \___|_|  |_| |_| |_|\___/ \__,_|\___|_|
              | |
              |_|

Supermodel is a small extension for tracking collections, models and their
associations with [Backbonejs][backbone].

#Model

`Supermodel.Model` is an extension of `Backbone.Model` that handles the
tracking and creation of individual models.

##Tracking

In large applications there are often multiple model objects representing the
same server object.  This can cause synchronization problems and cause the
display of stale data.  For instance,

```javascript
var user = new User({id: 5}).fetch();
...
var duplicate = new User({id: 5, name: 'brad'}).fetch();
user.get('name') == duplicate.get('name'); // false :(
```

If the server is updated while these models are being fetched the two instances
may have conflicting attributes.  To circumvent this, Supermodel tracks models
in the `all` property of the constructor and returns existing models instead of
creating new ones when possible.

```javascript
var user = new User({id: 5});
new User({id: 5}) === user; // true
User.all.get(5) === user; // true
```

When using an existing model, it's assumed that the attributes provided are
newer than the existing attributes and they are updated.

```javascript
var user = new User({id: 5});
user = new User({id: 5, name: 'brad'});
user.get('name'); // brad
```

Whenever possible Supermodel attempts to prevent duplicate models but it's
still possible to corrupt the `all` collection.  For instance, creating a new
model without an `id` and then setting `id` to an existing models value will
cause problems.

```javascript
var user = new User({id: 5});
var impostor = new User();
impostor.set({id: 5});
User.all.get(5) === impostor; // true
```

It's generally best to not set ids explicitly but only rely on server data for
this.

###Boilerplate

To accomplish this, Supermodel will return the existing model from the
constructor if it exists.  Unfortunately, you must include a small amount of
boilerplate in each model constructor to gain this benefit.

```javascript
var User = Supermodel.Model.extend({
  constructor: function(attrs, options) {
    var o = User.__super__.constructor.call(this, attrs, options);
    if (o) return o;
  }
});
```

*If you don't include this in your model's constructor you will get back
uninitialized models.*

##Sub Models

It's often convenient to return a collection of diverse attribute objects and
ensure that models are created using a more specialized constructor if
possible.  Supermodel provides the `findConstructor` hook for this purpose.

```javascript
  var User = Supermodel.Model.extend({
    ...
    findConstructor: function(attrs) {
      if (attrs.admin) return Admin;
    }
  });

  var Admin = User.extend({...});

  var user = new User({id: 1, admin: true});
  user instanceof Admin; // true
```

###Inheritance

Model tracking will work perfectly fine with inheritance assuming a few initial
conditions.  As models are created, they're added to the `all` collection of
each constructor in the inheritance chain.

* All models with a common ancestor in their prototype chain
  (excluding `Supermodel.Model`) are assumed to have unique ids.
* Models are always created with the most specialized constructor possible.
  A models super model can be deduced from the prototype chain, but it's sub
  model cannot.

Using the code from above,

```javascript
var user = new User({id: 1});
var admin = new Admin({id: 2});
Admin.all.length; // 1
User.all.length; // 2
```

#Associations

When initializing models or changing their attributes, there is often plenty of
information to wire up associations between models.

```javascript
var user = new User({id: 5});
var membership = new Membership({id: 2, user_id: 5});
membership.user === user; // false :(
```

The problem is finding the correct model and ensuring it's the canonical
representation of that model.  `Supermodel.Model` already handles these things
for us so all that's left is to wire up specific associations.

Using Supermodel,

```javascript
Membership.has().one('user', {model: User});

var user = new User({id: 5});
var membership = new Membership({id: 2, user_id: 5});
membership.user === user; // true :)
```

When models are created or changed, they're inspected for appropriate
attributes and the associated properties are set.  When a model becomes
associated or dissociated with another model an `'associate'` or `'dissociate'`
event is triggered, respectively.

##has

Associations are specified using `Model.has`.  This prevents naming collisions
and provides a convenient extension point outside of `Model` itself.

##one

*Constructor.has().one(name, options)*

Instances of **Constructor** should contain a reference to one model, stored
in the property specified by **name**.

```
Membership.has().one('user', {model: User});
```

The *name* argument is consistent across all association methods and specifies
the property name to store the associated model.

###model

The constructor to use when creating the associated model.

###inverse

The name of the inverse association, for notifying the associated model of
`'associate'` and `'dissociate'` events.

```javascript
Membership.has().one('user', {
  model: User,
  inverse: 'memberships'
});
```

###id

The attribute where the id of the associated model is stored.

###source

The attribute where the associated models attributes are stored.

##many

*Constructor.has().many(name, options)*

Instances of **Constructor** should contain a collection with many models,
stored in the property specified by **name**.

```javascript
User.has().many('memberships', {
  collection: Memberships,
  inverse: 'user'
});
```

###collection

The collection constructor to use when creating the associated collection.

###inverse

The name of the inverse association, for notifying the associated models of
`'associate'` and `'dissociate'` events.

###source

The attribute where the associated models' attributes are stored.

###through

Specify a through collection that models should be retrieved from.

```javascript
User.has().many('groups', {
  collection: Groups,
  through: 'memberships',
  source: 'group'
});
```

[backbone]: http://backbonejs.org
