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
  before(function(done) {
    const uri = 'mongodb://localhost/test';

    mongoose.connection
      .on('error', function (err) {
        done(err);
      })
      .on('close', function () {
      })
      .once('open', function () {
        done();
      });

    mongoose.connect(uri);
  });

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

  //it('throws error if populating undefined virtual', function (done) {
  //  var schema = new mongoose.Schema({
  //    name: { type: String},
  //  });
  //
  //  schema.virtual('foobar', {
  //    ref: 'Foobar',
  //    localKey: 'foobarId',
  //    foreignKey: '_id',
  //  });
  //
  //  var Model = mongoose.model('Model', schema);
  //
  //  var m = new Model({name: 'model'});
  //  m.save();
  //
  //  //TODO add assert
  //  Model
  //    .findOne()
  //    .populate('foobar')
  //    .exec(function (err, model) {
  //      if (err) {
  //        console.log(err, err.stack);
  //        done(err);
  //      } else {
  //        console.log('model async: ', model);
  //        done();
  //      }
  //    });
  //});

  it('should populate correctly', function (done) {
    mongoose = populateVirtuals(mongoose);

    var bookSchema = new mongoose.Schema({
      title: { type: String },
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author'},
    }, {
      toObject: {
        virtuals: true,
      },
      toJSON: {
        virtuals: true,
      }
    });

    var authorSchema = new mongoose.Schema({
      name: { type: String },
    }, {
      toObject: {
        virtuals: true,
      },
      toJSON: {
        virtuals: true,
      }
    });

    authorSchema.virtual('books', {
      ref: 'Book',
      foreignKey: 'authorId',
      localKey: '_id',
    });

    var Author = mongoose.model('Author', authorSchema);
    var Book = mongoose.model('Book', bookSchema);

    var firstAuthor = new Author({name: 'First Author'});
    firstAuthor.save();

    var firstBook = new Book({title: 'First Book', authorId: firstAuthor._id });
    firstBook.save();
    var secondBook = new Book({title: 'Second Book', authorId: firstAuthor._id });
    secondBook.save();

    Author
      .findOne({_id: firstAuthor.id})
      .populate('books')
      .exec(function (err, author) {
        if (err) {
          return done(err)
        }
        console.log('author: ', author);

        Book
          .find({authorId: author._id})
          .exec(function (err, books) {
            if (err) {
              return done(err);
            }
            console.log('books', books);

            assert.equal(author.books, books);

            done()
          });
      });
  });
});
