# mongoose-populate-virtuals

> Extend mongoose 4+ with virtuals that can be populated using any attribute on
> either model.

Create [virtual](http://mongoosejs.com/docs/guide.html#virtuals) attributes
that can be reverse populated and have paths separate from the key.

## Usage

Wrap mongoose:

```javascript
var mongoose = require('mongoose-populate-virtuals')(require('mongoose'));
```

Create document references to populate by defining
[virtual](http://mongoosejs.com/docs/guide.html#virtuals) attributes with
`ref`, `localKey` and `foreignKey` options.

```javascript
var Author = mongoose.model('Author', new mongoose.Schema({
  name: {
    type: String,
    required: true
  }
}));

// "reverse" population where the key is on the foreign model.
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
- `lean` Populate with lean objects.
- `singular` Use singular reference instead of array.
