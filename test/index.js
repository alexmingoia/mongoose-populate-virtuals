var assert = require('assert');
var mongoose = require('mongoose');
var populateVirtuals = require('..');

describe('module', function () {
  it('patches mongoose', function () {
    assert.equal(typeof populateVirtuals, 'function');
    populateVirtuals(mongoose);
  });
});

describe('Schema#virtual()', function () {
  it('adds getters/setters for `options.ref`', function () {
    var schema = new mongoose.Schema();
    var virtual = schema.virtual('foobar', {
      ref: 'Foobar',
      localKey: 'foobarId',
      foreignKey: '_id'
    });

    assert.equal(virtual.getters.length, 1);
    assert.equal(virtual.setters.length, 1);
  });

  it('throws error for missing `options.localKey`', function () {
    var schema = new mongoose.Schema();

    assert.throws(function () {
      var virtual = schema.virtual('foobar', {
        ref: 'Foobar',
        foreignKey: '_id'
      });
    }, Error);
  });

  it('throws error for missing `options.foreignKey`', function () {
    var schema = new mongoose.Schema();

    assert.throws(function () {
      var virtual = schema.virtual('foobar', {
        ref: 'Foobar',
        localKey: 'foobarId'
      });
    }, Error);
  });

  it('registers pre init middleware', function () {
    var schema = new mongoose.Schema();
    schema.virtual('foobar', {
      ref: 'Foobar',
      localKey: 'foobarId',
      foreignKey: '_id'
    });

    var Model = mongoose.model('Foobar', schema);
    var model = new Model({
      foobar: { _id: 3 }
    });

    assert.equal('object', typeof model.populatedVirtuals);
    assert.deepEqual(model.populatedVirtuals.foobar, { _id: 3 });
  });
});
