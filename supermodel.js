(function(Backbone){

  // The global object.
  var root = this;

  // Expose Supermodel to the global object.
  var Supermodel = root.Supermodel = {VERSION: '0.0.1'};

  // Local reference to Collection.
  var Collection = Backbone.Collection;

  // Use Backbone's `extend` for sugar.
  var extend = Backbone.Model.extend;

  // # Association
  //
  // Track associations between models.  Associated attributes are used and
  // then removed during `parse`.
  var Association = function(model, options) {
    required(options, 'name');
    _.extend(this, _.pick(options, 'name', 'where'));
    this.source = options.source || this.name;
    this.store = options.store || '_' + this.name;

    // Store a reference to this association by name after ensuring it's
    // unique.
    if (model.associations()[options.name]) {
      throw new Error('Association already exists: ' + options.name);
    }
    model.associations()[options.name] = this;

    // Listen for relevant events.
    if (this.initialize) model.all().on('initialize', this.initialize, this);
    if (this.change) model.all().on('change', this.change, this);
    if (this.parse) model.all().on('parse', this.parse, this);
    if (this.destroy) model.all().on('destroy', this.destroy, this);
    if (this.create) model.all().on('add', this.create, this);
  };

  Association.extend = extend;

  _.extend(Association.prototype, {

    // Notify `model` of its association with `other` using the `inverse`
    // option.
    associate: function(model, other) {
      if (!this.inverse) return;
      model.trigger('associate:' + this.inverse, model, other);
    },

    // Notify `model` of its dissociation with `other` using the `inverse`
    // option.
    dissociate: function(model, other) {
      if (!this.inverse) return;
      model.trigger('dissociate:' + this.inverse, model, other);
    }

  });

  // ## One
  //
  // One side of a one-to-one or one-to-many association.
  var One = Association.extend({

    // Options:
    // * id - The associated id is stored here.  Defaults to `name` + '_id'.
    // * source - Nested data is found in this attribute.  Defaults to `name`.
    constructor: function(model, options) {
      required(options, 'inverse', 'model');
      One.__super__.constructor.apply(this, arguments);
      _.extend(this, _.pick(options, 'inverse', 'model'));
      this.id = options.id || this.name + '_id';
      model.all()
        .on('associate:' + this.name, this.replace, this)
        .on('dissociate:' + this.name, this.remove, this);
    },

    create: function(model) {
      model[this.name] = _.bind(this.get, this, model);
    },

    get: function(model) {
      return model[this.store];
    },

    initialize: function(model) {
      this.parse(model, model.attributes);
      var id = model.get(this.id);
      if (id != null) this.replace(model, id);
    },

    parse: function(model, resp) {
      if (!_.has(resp, this.source)) return;
      var attrs = resp[this.source];
      delete resp[this.source];
      this.replace(model, attrs);
    },

    change: function(model) {
      if (!model.hasChanged(this.id)) return;
      this.replace(model, model.get(this.id));
    },

    remove: function(model) {
      this.replace(model, null);
    },

    // When a model is destroyed, its association should be removed.
    destroy: function(model) {
      var other = model[this.store];
      if (!other) return;
      this.remove(model);
      this.dissociate(other, model);
    },

    replace: function(model, other) {
      var id, current;

      if (!model) return;
      current = model[this.store];

      // If `other` is a primitive, assume it's an id.
      if (other != null && !_.isObject(other)) {
        id = other;
        (other = {})[this.model.prototype.idAttribute] = id;
      }

      // Is `other` already the current model?
      if (other && !(other instanceof Model)) other = this.model.create(other);
      if (current === other) return;

      // Tear down the current association.
      if (!other) model.unset(this.id);
      if (current) {
        delete model[this.store];
        this.dissociate(current, model);
      }

      if (!other) return;

      // Set up the new association.
      model.set(this.id, other.id);
      model[this.store] = other;
      this.associate(other, model);
    }

  });

  // # Many
  // The many side of a one-to-many association.
  var Many = Association.extend({

    // Options:
    // * source - Nested data is stored in this attribute.  Defaults to `name`.
    constructor: function(model, options) {
      required(options, 'collection');
      if (options.through) return new ManyThrough(model, options);
      required(options, 'inverse');
      Many.__super__.constructor.apply(this, arguments);
      _.extend(this, _.pick(options, 'collection', 'comparator', 'inverse'));
      model.all()
        .on('associate:' + this.name, this._associate, this)
        .on('dissociate:' + this.name, this._dissociate, this);
    },

    create: function(model) {
      model[this.name] = _.bind(this.get, this, model);

      var collection = model[this.store];
      if (collection) return;

      // Create the collection for storing the associated models.  Listen for
      // "add", "remove", and "reset" events and act accordingly.
      collection = model[this.store] = new this.collection([], {
        comparator: this.comparator
      })
      .on('add', this.add, this)
      .on('remove', this.remove, this)
      .on('reset', this.reset, this);

      // We'll need to know what model "owns" this collection in order to
      // handle events that it triggers.
      collection[this.inverse] = collection.owner = model;
    },

    get: function(model) {
      return model[this.store];
    },

    parse: function(model, resp) {
      var attrs = resp[this.source];
      if (!attrs) return;
      delete resp[this.source];
      var collection = model[this.store];
      var models = _.map(collection.parse(attrs), function(attrs) {
        return new collection.model(attrs);
      });
      collection.reset(this.where ? _.filter(models, this.where) : models);
    },

    initialize: function(model) {
      this.parse(model, model.attributes);
    },

    add: function(model, collection) {
      if (!model || !collection) return;
      this.associate(model, collection.owner);
    },

    remove: function(model, collection) {
      if (!model || !collection) return;
      this.dissociate(model, collection.owner);
    },

    reset: function(collection) {
      if (!collection) return;
      collection.each(function(model) {
        this.associate(model, collection.owner);
      }, this);
    },

    destroy: function(model) {
      var collection;
      if (!model || !(collection = model[this.store])) return;
      collection.each(function(other) {
        this.dissociate(other, model);
      }, this);
    },

    _associate: function(model, other) {
      if (!model || !other || !model[this.store]) return;
      if (this.where && !this.where(other)) return;
      model[this.store].add(other);
    },

    _dissociate: function(model, other) {
      if (!model || !other || !model[this.store]) return;
      model[this.store].remove(other);
    }

  });

  // # ManyThrough
  //
  // One side of a many-to-many association.
  var ManyThrough = Association.extend({

    // Options:
    // * source - The property where models are found.
    // * through - The property name where the through collection is stored.
    constructor: function(model, options) {
      ManyThrough.__super__.constructor.apply(this, arguments);
      _.extend(this, _.pick(options, 'collection', 'through'));
      this._associate = andThis(this._associate, this);
      this._dissociate = andThis(this._dissociate, this);
    },

    create: function(model) {
      if (!model[this.name]) model[this.name] = _.bind(this.get, this, model);
    },

    get: function(model) {
      var collection = model[this.store];

      // Through associations are created lazily in order to avoid
      // initialization costs.
      if (!collection) {
        collection = new this.collection([], {
          comparator: this.comparator
        });

        // We'll need to know what model "owns" this collection in order to
        // handle events that it triggers.
        collection.owner = model;
        model[this.store] = collection;

        // Initialize listeners and models.
        this.reset(model[this.through]()
          .on('add', this.add, this)
          .on('remove', this.remove, this)
          .on('reset', this.reset, this)
          .on('associate:' + this.source, this._associate)
          .on('dissociate:' + this.source, this._dissociate));
      }

      return collection;
    },

    add: function(model, through) {
      if (!model || !through) return;
      if (!(model = model[this.source]())) return;
      if (this.where && !this.where(model)) return;
      through.owner[this.name]().add(model);
    },

    remove: function(model, through) {
      if (!model || !through) return;
      if (!(model = model[this.source]())) return;
      var exists = through.any(function(o) {
        return o[this.source]() === model;
      }, this);
      if (!exists) through.owner[this.name]().remove(model);
    },

    reset: function(through) {
      if (!through) return;
      var models = _.compact(_.uniq(_.invoke(through.models, this.source)));
      if (this.where) models = _.filter(models, this.where);
      through.owner[this.name]().reset(models);
    },

    // Add associated models.
    _associate: function(through, model, other) {
      if (!through || !model || !other) return;
      if (this.where && !this.where(other)) return;
      through.owner[this.name]().add(other);
    },

    // Remove dissociated models, taking care to check for other instances.
    _dissociate: function(through, model, other) {
      if (!through || !model || !other) return;
      var exists = through.any(function(o) {
        return o[this.source]() === other;
      }, this);
      if (!exists) through.owner[this.name]().remove(other);
    }

  });


  // Avoid naming collisions by providing one entry point for associations.
  var Has = function(model) {
    this.model = model;
  };

  _.extend(Has.prototype, {

    one: function(name, options) {
      options.name = name;
      new One(this.model, options);
      return this;
    },

    many: function(name, options) {
      options.name = name;
      new Many(this.model, options);
      return this;
    }

  });

  // Super Model
  var Model = Supermodel.Model = Backbone.Model.extend({

    cidAttribute: 'cid',

    initialize: function() {
      // Use `"cid"` for retrieving models by `attributes.cid`.
      this.set(this.cidAttribute, this.cid);

      // Add the model to `all` for each constructor in its prototype chain.
      var ctor = this.constructor;
      while (ctor && ctor !== Model) {
        ctor.all().add(this);
        ctor = ctor.__super__.constructor;
      }

      // Trigger 'initialize' for listening associations.
      this.trigger('initialize', this);
    },

    // While `"cid"` is used for tracking models, it should not be persisted.
    toJSON: function() {
      var o = Model.__super__.toJSON.apply(this, arguments);
      delete o[this.cidAttribute];
      return o;
    },

    // Associations are initialized/updated during `parse`.  They listen for
    // the `'parse'` event and remove the appropriate properties after parsing.
    parse: function(resp) {
      this.trigger('parse', this, resp);
    }

  }, {

    create: function(attrs, options) {
      var model;
      var all = this.all();
      var cid = attrs && attrs[this.prototype.cidAttribute];
      var id = attrs && attrs[this.prototype.idAttribute];

      // If `attrs` belongs to an existing model, return it.
      if (cid && (model = all.getByCid(cid)) && model.attributes === attrs) {
        return model;
      }

      // If a model already exists for `id`, return it.
      if (id && (model = all.get(id))) {
        model.parse(attrs);
        model.set(attrs);
        return model;
      }

      return new this(attrs, options);
    },

    has: function() {
      return new Has(this);
    },

    // Return a collection of all models for a particular constructor.
    all: function() {
      return this._all || (this._all = new Collection());
    },

    // Return a hash of all associations for a particular constructor.
    associations: function() {
      return this._associations || (this._associations = {});
    },

    // Models are globally tracked via the `all` property on the constructor.
    // Associations are tracked via the `associations` property.
    reset: function() {
      this._all = new Collection();
      this._associations = {};
    }

  });

  // Capture a functions context (this), prepend it to the arguments, and call
  // the function with the provided context.
  var andThis = function(func, context) {
    return function() {
      var args = [this].concat(_.toArray(arguments));
      return func.apply(context, args);
    };
  };

  // Throw if the specified options are not provided.
  var required = function(options) {
    for (var i = 1; i < arguments.length; i++) {
      if (!options[arguments[i]]) {
        throw new Error('Option required: ' + arguments[i]);
      }
    }
  };

}).call(this, Backbone);
