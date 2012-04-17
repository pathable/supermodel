(function(Backbone){

  // The global object.
  var root = this;

  // Expose Supermodel to the global object.
  var Supermodel = root.Supermodel = {VERSION: '0.0.1'};

  // Use Backbone's `extend` for sugar.
  var extend = Backbone.Model.extend;

  // # Association
  //
  // Track associations between models.  Associated attributes are used and
  // then removed during `parse`.
  var Association = Supermodel.Association = function(model, options) {
    this.model = model;
    this.options = options || {};
    var all = this.all = (model.all || (model.all = new Collection()));
    if (this.initialize) all.on('initialize', this.initialize, this);
    if (this.change) all.on('change', this.change, this);
    if (this.parse) all.on('parse', this.parse, this);
    if (this.destroy) all.on('destroy', this.destroy, this);
    if (this.create) all.on('add', this.create, this);
  };

  Association.extend = extend;

  _.extend(Association.prototype, {

    // Notify `model` of its association with `other` using the `inverse`
    // option.
    associate: function(model, other) {
      if (!this.options.inverse) return;
      model.trigger('associate:' + this.options.inverse, model, other);
    },

    // Notify `model` of its dissociation with `other` using the `inverse`
    // option.
    dissociate: function(model, other) {
      if (!this.options.inverse) return;
      model.trigger('dissociate:' + this.options.inverse, model, other);
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
      One.__super__.constructor.apply(this, arguments);
      options = this.options;
      _.defaults(options, {
        source: options.name,
        id: options.name + '_id'
      });
      this.all.on('associate:' + options.name, this.replace, this);
      this.all.on('dissociate:' + options.name, this.remove, this);
    },

    initialize: function(model) {
      this.parse(model, model.attributes);
      var id = model.get(this.options.id);
      if (id != null) this.replace(model, id);
    },

    parse: function(model, resp) {
      if (!_.has(resp, this.options.source)) return;
      var attrs = resp[this.options.source];
      delete resp[this.options.source];
      this.replace(model, attrs);
    },

    change: function(model) {
      if (!model.hasChanged(this.options.id)) return;
      this.replace(model, model.get(this.options.id));
    },

    remove: function(model) {
      this.replace(model, null);
    },

    // When a model is destroyed, its association should be removed.
    destroy: function(model) {
      var other = model[this.options.name];
      if (!other) return;
      this.remove(model);
      this.dissociate(other, model);
    },

    replace: function(model, other) {
      if (!model) return;
      var options = this.options;
      var current = model[options.name];

      // If `other` is a primitive, assume it's an id.
      if (other != null && !_.isObject(other)) other = {id: other};

      // Is `other` already the current model?
      if (other && !(other instanceof Model)) other = new options.model(other);
      if (current === other) return;

      // Tear down the current association.
      if (!other) model.unset(options.id);
      if (current) {
        delete model[options.name];
        this.dissociate(current, model);
      }

      if (!other) return;

      // Set up the new association.
      model.set(options.id, other.id);
      model[options.name] = other;
      this.associate(other, model);
    }

  });

  // # Many
  // The many side of a one-to-many association.
  var Many = Association.extend({

    // Options:
    // * source - Nested data is stored in this attribute.  Defaults to `name`.
    constructor: function(model, options) {
      if (options.through) return new ManyThrough(model, options);
      Many.__super__.constructor.apply(this, arguments);
      options = _.defaults(this.options, {source: this.options.name});
      this.all
        .on('associate:' + options.name, this._associate, this)
        .on('dissociate:' + options.name, this._dissociate, this);
    },

    parse: function(model, resp) {
      var models = resp[this.options.source];
      if (!models) return;
      delete resp[this.options.source];
      var collection = model[this.options.name];
      collection.reset(collection.parse(models));
    },

    create: function(model, all) {
      var options = this.options;
      var collection = model[options.name];
      if (collection) return;

      // Create the collection for storing the associated models.  Listen for
      // "add", "remove", and "reset" events and act accordingly.
      collection = model[options.name] = new options.collection([], {
        comparator: options.comparator
      })
      .on('add', this.add, this)
      .on('remove', this.remove, this)
      .on('reset', this.reset, this);

      // We'll need to know what model "owns" this collection in order to
      // handle events that it triggers.
      collection.owner = model;
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
      var collection = model[this.options.name];
      if (!collection) return;
      collection.each(function(other) {
        this.dissociate(other, model);
      }, this);
    },

    _associate: function(model, other) {
      if (!model || !other) return;
      var name = this.options.name;
      if (!model[name]) return;
      model[name].add(other);
    },

    _dissociate: function(model, other) {
      if (!model || !other) return;
      var name = this.options.name;
      if (!model[name]) return;
      model[name].remove(other);
    }

  });

  // # ManyThrough
  //
  // One side of a many-to-many association.
  var ManyThrough = Association.extend({

    constructor: function(model, options) {
      ManyThrough.__super__.constructor.apply(this, arguments);
      options = _.defaults(this.options, {
        source: this.options.name
      });
      this.through = model[options.through];
      this._associate = andThis(this._associate, this);
      this._dissociate = andThis(this._dissociate, this);
    },

    create: function(model) {
      var collection = new this.options.collection([], {
        comparator: this.options.comparator
      });
      collection.owner = model;
      model[this.options.name] = collection;
      model[this.options.through]
        .on('add', this.add, this)
        .on('remove', this.remove, this)
        .on('reset', this.reset, this)
        .on('associate:' + this.options.source, this._associate)
        .on('dissociate:' + this.options.source, this._dissociate);
    },

    initialize: function(model) {
      this.reset(model[this.options.through]);
    },

    add: function(model, through) {
      if (!model || !through) return;
      if (!(model = model[this.options.source])) return;
      through.owner[this.options.name].add(model);
    },

    remove: function(model, through) {
      if (!model || !through) return;
      if (!(model = model[this.options.source])) return;
      var exists = through.any(function(o) {
        return o[this.options.source] === model;
      }, this);
      if (!exists) through.owner[this.options.name].remove(model);
    },

    reset: function(through) {
      if (!through) return;
      var options = this.options;
      var owner = through.owner;
      var models = _.compact(_.uniq(_.pluck(through.models, options.source)));
      through.owner[options.name].reset(models);
    },

    // Add associated models.
    _associate: function(through, model, other) {
      if (!through || !model || !other) return;
      through.owner[this.options.name].add(other);
    },

    // Remove dissociated models.
    _dissociate: function(through, model, other) {
      if (!through || !model || !other) return;
      var exists = through.any(function(o) {
        return o[this.options.source] === other;
      }, this);
      if (!exists) through.owner[this.options.name].remove(other);
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

  // Provide common functionality for tracking a source collection and
  // producing a target collection with models that match a certain criteria.
  var Set = Supermodel.Set = function(source, options) {
    this.source = source;
    this.options = _.defaults(options, {collection: Collection});
    this.target = new options.collection([], {
      source: source,
      comparator: options.comparator
    });
    if (this.add) source.on('add', this.add, this);
    if (this.remove) source.on('remove', this.remove, this);
    if (this.change) source.on('change', this.change, this);
    if (this.reset) {
      source.on('reset', this.reset, this);
      this.reset(source);
    }
  };

  Set.extend = extend;

  // Produce a collection that tracks the source collection, filtering it with
  // the provided function.
  var Filter = Set.extend({

    add: function(model, source) {
      if (this.options.filter(model)) this.target.add(model);
    },

    remove: function(model, source) {
      this.target.remove(model);
    },

    reset: function(source) {
      this.target.reset(source.filter(this.options.filter));
    },

    change: function(model) {
      this.target[this.options.filter(model) ? 'add' : 'remove'](model);
    }

  });

  // Track the first models of a collection, up to the specified length.
  var First = Set.extend({

    constructor: function(source, options) {
      options.comparator = source.comparator;
      First.__super__.constructor.apply(this, arguments);
    },

    add: function(model, source) {
      if (source.indexOf(model) >= this.options.length) return;
      var target = this.target;
      target.add(model);
      if (target.length > this.options.length) {
        target.remove(target.last());
      }
    },

    remove: function(model, source) {
      var length = this.options.length;
      this.target.remove(model);
      if (this.target.length >= length) return;
      if (source.length < length) return;
      this.target.add(source.at(length - 1));
    },

    reset: function(source) {
      this.target.reset(source.first(this.options.length));
    }

  });

  // Track models with a unique attribute from the source collection.
  var Uniq = Set.extend({

    constructor: function(source, options) {
      this.models = {};
      this.counts = {};
      Uniq.__super__.constructor.apply(this, arguments);
    },

    add: function(model, source) {
      var value = model.get(this.options.attr);
      if (!this.counts[value]) this.counts[value] = 0;
      if (!(this.counts[value]++)) this.target.add(this.models[value] = model);
    },

    remove: function(model, source) {
      var value = model.get(this.options.attr);
      if (!(--this.counts[value])) {
        this.target.remove(this.models[value]);
        delete this.counts[value];
        delete this.models[value];
      }
    },

    reset: function(source) {
      var value, attr = this.options.attr;
      this.models = {};
      this.counts = {};
      source.each(function(model) {
        var value = model.get(this.options.attr);
        if (!this.counts[value]) this.counts[value] = 0;
        if (!(this.counts[value]++)) this.models[value] = model;
      }, this);
      this.target.reset(_.values(this.models));
    },

    change: function(model) {
      var attr = this.options.attr;
      if (!model.hasChanged(attr)) return;
      var value = model.previous(attr);
      if (!(--this.counts[value])) {
        this.target.remove(this.models[value]);
        delete this.counts[value];
        delete this.models[value];
      }
      this.add(model, this.source);
    }

  });

  // Avoid naming collisions by providing one entry point for collection
  // tracking methods.
  var Track = function(source) {
    this.source = source;
  };

  _.extend(Track.prototype, {

    filter: function(options) {
      if (_.isFunction(options)) options = {filter: options};
      return new Filter(this.source, options).target;
    },

    first: function(options) {
      if (_.isNumber(options)) options = {length: options};
      return new First(this.source, options).target;
    },

    uniq: function(options) {
      if (_.isString(options)) options = {attr: options};
      return new Uniq(this.source, options).target;
    }

  });

  // Super Model
  var Model = Supermodel.Model = Backbone.Model.extend({

    constructor: function(attrs, options) {
      var id, cid, model, ctor = this.constructor;

      // Models are globally tracked via the `all` property on the constructor.
      var all = ctor.all || (ctor.all = new Collection());

      // If `findConstructor` is defined, use it to find the constructor for the
      // appropriate subclass.
      var sub = this.findConstructor && this.findConstructor(attrs, options);
      if (sub && !(this instanceof sub)) return new sub(attrs, options);

      // Invoking the `Model` constructor with an `id` that matches an existing
      // model will return a reference to the existing model after setting the
      // attributes provided.
      if (attrs && (cid = attrs._cid)) return all.getByCid(cid);
      if (attrs && (id = attrs.id) && (model = all.get(id))) {
        model.parse(attrs);
        model.set(attrs);
        return model;
      }

      Model.__super__.constructor.call(this, attrs, options);
    },

    initialize: function() {
      // Use `"_cid"` for retrieving models by `attributes._cid`.
      this.set({_cid: this.cid});

      // Add the model to `all` for each constructor in its prototype chain.
      var ctor = this.constructor;
      while (ctor && ctor !== Model) {
        (ctor.all || (ctor.all = new Collection())).add(this);
        ctor = ctor.__super__ && ctor.__super__.constructor;
      }

      // Trigger 'initialize' for listening associations.
      this.trigger('initialize', this);
    },

    // While `"_cid"` is used for tracking models, it should not be persisted.
    toJSON: function() {
      var o = Model.__super__.toJSON.apply(this, arguments);
      delete o._cid;
      return o;
    },

    // Returns true if the value of each attribute in `attrs` equals the
    // corresponding model value.  Otherwise returns false.
    match: function(attrs) {
      if (_.isEmpty(attrs)) return false;
      for (var key in attrs) {
        if (attrs[key] !== this.get(key)) return false;
      }
      return true;
    },

    // Associations are initialized during `parse`.  They listen for the
    // `'parse'` event and remove the appropriate properties after parsing.
    parse: function(resp) {
      this.trigger('parse', this, resp);
    }

  }, {

    has: function() {
      return new Has(this);
    }

  });

  // Super Collection
  var Collection = Supermodel.Collection = Backbone.Collection.extend({

    // Supermodel.Model is the default model for Super Collections.
    model: Model,

    reset: function(models, options) {
      // If `options` includes `{soft: true}`, add/remove models as needed
      // instead of a "hard" reset.
      if (options && options.soft) {
        this.add(models = _.map(models, this._prepareModel, this), options);
        return this.remove(_.difference(this.models, models), options);
      }
      return Collection.__super__.reset.apply(this, arguments);
    },

    // To avoid collisions, use a separate namespace for collection tracking
    // methods.
    track: function() {
      return new Track(this);
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

}).call(this, Backbone);
