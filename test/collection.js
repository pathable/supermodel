(function() {

  var source, target;
  var Model = Supermodel.Model;
  var Collection = Supermodel.Collection;

  module('Collection', {

    setup: function() {
      if (Model.all) Model.all.reset([]);
    }

  });

  test('Collection.model is Supermodel.Model', function() {
    ok(new Collection([{id: 1}]).get(1) instanceof Model);
  });

  test('Soft reset.', function() {
    var m1 = new Model({id: 1});
    var m2 = new Model({id: 2})
      .on('add', function(){ ok(false); })
      .on('remove', function(){ ok(false); });
    var c = new Collection([m1, m2])
      .on('reset', function(){ ok(false); });
    c.reset([m2], {soft: true});
    strictEqual(c.length, 1);
    ok(c.at(0) === m2);
  });

  module('Filter', {

    setup: function() {
      if (Model.all) Model.all.reset([]);
      source = new Collection([{x: 1}, {x: 2}, {x: 3}, {x: 4}]);
      target = source.track().filter(function(model){
        return model.get('x') > 2;
      });
    }

  });

  test('Filtered set contains the correct models.', function() {
    strictEqual(target.length, 2);
    var values = target.pluck('x');
    ok(_.include(values, 3));
    ok(_.include(values, 4));
  });

  test('New models are added.', function() {
    source.add([{x: 0}, {x: 5}]);
    strictEqual(target.length, 3);
    var values = target.pluck('x');
    ok(_.include(values, 5));
    ok(!_.include(values, 0));
  });

  test('Old models are removed.', function() {
    source.remove(source.find(function(model){
      return model.get('x') === 3;
    }));
    strictEqual(target.length, 1);
    var values = target.pluck('x');
    ok(!_.include(values, 3));
  });

  test('Models are reset.', function() {
    source.reset([{x: 0}, {x: 5}]);
    strictEqual(target.length, 1);
    strictEqual(target.at(0).get('x'), 5);
  });

  test('Models are re-tested on change.', function() {
    var model = source.find(function(model) {
      return model.get('x') === 1;
    });
    model.set('x', 5);
    ok(target.include(model));
    model.set('x', 1);
    ok(!target.include(model));
  });

  module('First', {

    setup: function() {
      if (Model.all) Model.all.reset([]);
      source = new Collection([{id: 2}, {id: 3}, {id: 4}], {
        comparator: function(model) { return model.id; }
      });
      target = source.track().first(2);
    }

  });

  test('First is applied during initialization.', function() {
    deepEqual(target.pluck('id'), [2, 3]);
  });

  test('Maintain ordering.', function() {
    source.add({id: 1});
    deepEqual(target.pluck('id'), [1, 2]);
    source.remove(2);
    deepEqual(target.pluck('id'), [1, 3]);
    source.remove(1);
    deepEqual(target.pluck('id'), [3, 4]);
    source.remove(4);
    deepEqual(target.pluck('id'), [3]);
  });

  test('Models are reset.', function() {
    source.reset([{id: 5}, {id: 7}]);
    deepEqual(target.pluck('id'), [5, 7]);
  });

  module('Uniq', {

    setup: function() {
      if (Model.all) Model.all.reset([]);
      source = new Collection([{x: 1}, {x: 1}, {x: 2}], {
        comparator: function(model){ return model.get('x'); }
      });
      target = source.track().uniq({
        attr: 'x',
        comparator: source.comparator
      });
    }

  });

  test('Uniq is applied.', function() {
    deepEqual(target.pluck('x'), [1, 2]);
  });

  test('Models are added.', function() {
    source.add([{x: 4}, {x: 4}]);
    deepEqual(target.pluck('x'), [1, 2, 4]);
    source.add({x: 1});
    deepEqual(target.pluck('x'), [1, 2, 4]);
  });

  test('Models are removed.', function() {
    source.remove(source.at(0));
    deepEqual(target.pluck('x'), [1, 2]);
    source.remove(source.at(0));
    deepEqual(target.pluck('x'), [2]);
  });

  test('Models are reset.', function() {
    source.reset([{x: 4}, {x: 4}, {x: 5}]);
    deepEqual(target.pluck('x'), [4, 5]);
  });

  test('Models are added/removed on change.', function() {
    source.at(1).set({x: 3});
    deepEqual(target.pluck('x'), [1, 2, 3]);
    source.at(1).set({x: 1});
    deepEqual(target.pluck('x'), [1, 2]);
  });

})();
