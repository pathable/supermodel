(function(Backbone){

  // The global object.
  var root = this;

  // Expose Supermodel on the global object.
  var Supermodel = root.Supermodel = {};

  // Use Backbone's `extend` for sugar.
  var extend = Backbone.Model.extend;

  // Track associations between models.
  var Association = Supermodel.Association = function(model, options) {
    this.model = model;
    this.options = options || {};
    var all = this.all = (model.all || (model.all = new Collection()));
    if (this.initialize) all.on('initialize', this.initialize, this);
    if (this.change) all.on('change', this.change, this);
    if (this.parse) all.on('parse', this.parse, this);
  };

  Association.extend = extend;

  _.extend(Association.prototype, {

    associate: function(model, other) {
      if (!this.options.inverse) return;
      model.trigger('associate:' + this.options.inverse, model, other);
    },

    dissociate: function(model, other) {
      if (!this.options.inverse) return;
      model.trigger('dissociate:' + this.options.inverse, model, other);
    }

  });

  var One = Association.extend({

    constructor: function() {
      One.__super__.constructor.apply(this, arguments);
      var options = this.options;
      _.defaults(options, {
        source: options.name,
        id: options.name + '_id'
      });
      this.all.on('associate:' + options.name, this.replace, this);
      this.all.on('dissociate:' + options.name, this.remove, this);
    },

    initialize: function(model) {
      var id = model.get(this.options.id);
      if (id != null) this.replace(model, id);
    },

    parse: function(model, resp) {
      var attrs = resp[this.options.source];
      if (!attrs) return;
      delete resp[this.options.source];
      model[this.options.name] = this.create(attrs);
      resp[this.options.id] = model.id;
    },

    change: function(model) {
      if (!model.hasChanged(this.options.id)) return;
      this.replace(model, model.get(this.options.id));
    },

    remove: function(model) {
      this.replace(model, null);
    },

    replace: function(model, other) {
      var current, options = this.options;
      if (!model) return;

      // If `other` is a primitive, assume it's an id.
      if (other && !_.isObject(other)) other = {id: other};

      current = model[options.name];

      // Are these the current attributes?
      if (current && current.attributes === other) return;

      // Create a model if we don't already have one.
      if (other && !(other instanceof Model)) {
        other = new options.model(other);
      }

      // Bail, we already have the correct model.
      if (current === other) return;

      // Tear down the current association.
      if (!other) model.unset(options.id);
      if (current) {
        delete model[options.name];
        this.dissociate(current, model);
      }

      if (!other) return;

      // Set up the new association.
      model[options.name] = other;
      model.set(options.id, other.id);
      this.associate(other, model);
    },

    // Create a model from a hash of attributes or an id.
    create: function(attrs) {
      var options = this.options;

      // If `attrs` is a primitive, assume it's an id.
      if (attrs && !_.isObject(attrs)) attrs = {id: attrs};

      // Create a model if we don't already have one.
      if (attrs && !(attrs instanceof Model)) {
        attrs = new options.model(attrs, {parse: true});
      }
      return attrs;
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
    }

  });

  // Provide base functionality for tracking a source collection and producing
  // a target collection with models that match a certain criteria.
  var Set = Supermodel.Set = function(source, options) {
    this.source = source;
    this.options = options;
    this.target = new (options.collection || Collection)([], {
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
      this.counts[value] || (this.counts[value] = 0);
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
        this.counts[value] || (this.counts[value] = 0);
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
        model.set(model.parse(attrs));
        return model;
      }

      Model.__super__.constructor.call(this, attrs, options);
    },

    initialize: function() {
      // Use `"_cid"` for retrieving models by `attributes._cid`.
      this.set({_cid: this.cid});

      // Add the model to `all` for each constructor in its prototype chain.
      var ctor = this.constructor;
      while (ctor && ctor !== Backbone.Model) {
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

    // Supermodels initialize relationships during parse.  The data associated
    // with related models will be removed.
    parse: function(resp, xhr) {
      // Since parse is called before models are added to `all` collections we
      // must walk the inheritance chain and trigger parse on each.
      var ctor = this.constructor;
      while (ctor && ctor !== Backbone.Model) {
        if (ctor.all) ctor.all.trigger('parse', this, resp, xhr);
        ctor = ctor.__super__ && ctor.__super__.constructor;
      }
      return resp;
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

}).call(this, Backbone);
