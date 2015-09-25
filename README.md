# mongoose-populate-virtuals

[![Build Status](https://img.shields.io/travis/alexmingoia/mongoose-populate-virtuals.svg?style=flat)](http://travis-ci.org/alexmingoia/mongoose-populate-virtuals) [![NPM version](https://img.shields.io/npm/v/mongoose-populate-virtuals.svg?style=flat)](http://badge.fury.io/js/mongoose-populate-virtuals)

> Extend Mongoose 4+ [population](http://mongoosejs.com/docs/populate.html)
> with [virtual](http://mongoosejs.com/docs/guide.html#virtuals) attributes
> that can be populated in either direction.

## Usage

Wrap mongoose:

```javascript
var mongoose = require('mongoose-populate-virtuals')(require('mongoose'));
```

Create document references to populate by defining
[virtual](http://mongoosejs.com/docs/guide.html#virtuals) attributes with
`ref`, `localKey` and `foreignKey` options.

```javascript
Author.virtual('books', {
  ref: 'Book',
  foreignKey: 'authorId',
  localKey: '_id'
});

Author.find().populate('books').exec(...);
```

Remember [virtual](http://mongoosejs.com/docs/guide.html#virtuals) attributes
are not persisted to the DB. Virtuals are not included in the model's
[`.toObject()`](http://mongoosejs.com/docs/api.html#document_Document-toObject)
or `.toJSON()` methods unless the options include `{ virtuals: true }`.

### Options

Options for populate [virtuals](http://mongoosejs.com/docs/guide.html#virtuals):

- `ref` Name of the mongoose model (required).
- `foreignKey` Key on the model of the populated virtual (required).
- `localKey` Key on the model being populated (required).
- `match` Query used for `find()` or `fineOne`.
- `options` Mongo options such as `sort` and `limit`.
- `select` Mongoose's `.select()` argument.
- `singular` Use singular reference instead of array.
