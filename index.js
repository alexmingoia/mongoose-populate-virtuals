var mongoose = require('mongoose');
var utils = require('mongoose/lib/utils');
var Model = mongoose.Model;
var Schema = mongoose.Schema;
var Query = mongoose.Query;
var queryPopulate = mongoose.Query.prototype.populate;
var schemaVirtual = mongoose.Schema.prototype.virtual;
var Promise = require('mongoose/lib/promise');

utils.PopulateOptions = PopulateOptions;
utils.populate = utilsPopulate;

Schema.prototype.virtual = function (name, options) {
  if (options && options.ref) {
    if (!options.localKey) {
      throw new Error("Reference virtuals require `localKey` option")
    }

    if (!options.foreignKey) {
      throw new Error("Reference virtuals require `foreignKey` option")
    }

    var virtual = schemaVirtual.call(this, name, options);

    // virtual model paths and non-schema document paths conflict,
    // so we have to set them on the `populatedVirtuals` model property
    // used by the virtual getters/setters
    this.pre('init', function (next, obj) {
      if (obj[name]) {
        if (!this.populatedVirtuals) {
          this.populatedVirtuals = {};
        }

        this.populatedVirtuals[name] = obj[name];
        delete obj[name];
      }
      next();
    });

    return virtual
      .get(function () {
        if (!this.populatedVirtuals) {
          this.populatedVirtuals = {};
        }
        return this.populatedVirtuals[name] || [];
      })
      .set(function (val) {
        if (!this.populatedVirtuals) {
          this.populatedVirtuals = {};
        }
        this.populatedVirtuals[name] = val;
      });
  } else {
    return schemaVirtual.call(this, name, options);
  }
};

Query.prototype.populate = function () {
  var res = utils.populate.apply(this, arguments);
  var opts = this._mongooseOptions;

  if (!utils.isObject(opts.populate)) {
    opts.populate = {};
  }

  for (var i = 0; i < res.length; ++i) {
    opts.populate[res[i].path] = res[i];
  }

  return this;
};

/*!
 * Populate options constructor
 */

function PopulateOptions (path, select, match, options, model, subPopulate, foreignKey, localKey, arrayPop, parentModel) {
  var refSchema = parentModel && parentModel.schema.virtualpath(path);
  var refSchemaOptions = refSchema ? refSchema.options : {};

  this.path = path;
  this.match = match || refSchemaOptions.match;
  this.select = select || refSchemaOptions.select;
  this.foreignKey = foreignKey || refSchemaOptions.foreignKey;
  this.localKey = localKey || refSchemaOptions.localKey;
  this.arrayPop = arrayPop || refSchemaOptions.arrayPop || refSchemaOptions.singular;
  this.options = options || refSchemaOptions.options;
  this.model = model || refSchemaOptions.ref;
  if (typeof subPopulate === 'object' || typeof refSchemaOptions.populate === 'object') {
    this.populate = subPopulate || refSchemaOptions.populate;
  }
  this._docs = {};
}

// make it compatible with utils.clone
PopulateOptions.prototype.constructor = Object;

/*!
 * populate helper
 */

function utilsPopulate (path, select, model, match, options, subPopulate) {
  var arrayPop, localKey, foreignKey;
  var parentModel = this.model;

  // The order of select/conditions args is opposite Model.find but
  // necessary to keep backward compatibility (select could be
  // an array, string, or object literal).

  // might have passed an object specifying all arguments
  if (1 === arguments.length) {
    if (path instanceof PopulateOptions) {
      return [path];
    }

    if (Array.isArray(path)) {
      return path.map(function(o){
        return utilsPopulate.call({ model: parentModel }, o)[0];
      });
    }

    if (require('mongoose/lib/utils').isObject(path)) {
      match = path.match;
      options = path.options;
      select = path.select;
      foreignKey = path.foreignKey;
      localKey = path.localKey;
      arrayPop = path.singular;
      model = path.model || path.ref;
      subPopulate = path.populate;
      path = path.path;
    }
  } else if ('string' !== typeof model && 'function' !== typeof model) {
    options = match;
    match = model;
    model = undefined;
  }

  if ('string' != typeof path) {
    throw new TypeError('utils.populate: invalid path. Expected string. Got typeof `' + typeof path + '`');
  }

  if (typeof subPopulate === 'object') {
    subPopulate = utilsPopulate.call({
      model: parentModel && parentModel.db.model(model)
    }, subPopulate);
  }

  var ret = [];
  var paths = path.split(' ');
  for (var i = 0; i < paths.length; ++i) {
    ret.push(new PopulateOptions(paths[i], select, match, options, model, subPopulate, foreignKey, localKey, arrayPop, parentModel));
  }

  return ret;
};

/**
 * Populates document references.
 *
 * ####Available options:
 *
 * - path: space delimited path(s) to populate
 * - select: optional fields to select
 * - match: optional query conditions to match
 * - model: optional name of the model to use for population
 * - options: optional query options like sort, limit, etc
 *
 * ####Examples:
 *
 *     // populates a single object
 *     User.findById(id, function (err, user) {
 *       var opts = [
 *           { path: 'company', match: { x: 1 }, select: 'name' }
 *         , { path: 'notes', options: { limit: 10 }, model: 'override' }
 *       ]
 *
 *       User.populate(user, opts, function (err, user) {
 *         console.log(user);
 *       })
 *     })
 *
 *     // populates an array of objects
 *     User.find(match, function (err, users) {
 *       var opts = [{ path: 'company', match: { x: 1 }, select: 'name' }]
 *
 *       var promise = User.populate(users, opts);
 *       promise.then(console.log).end();
 *     })
 *
 *     // imagine a Weapon model exists with two saved documents:
 *     //   { _id: 389, name: 'whip' }
 *     //   { _id: 8921, name: 'boomerang' }
 *
 *     var user = { name: 'Indiana Jones', weapon: 389 }
 *     Weapon.populate(user, { path: 'weapon', model: 'Weapon' }, function (err, user) {
 *       console.log(user.weapon.name) // whip
 *     })
 *
 *     // populate many plain objects
 *     var users = [{ name: 'Indiana Jones', weapon: 389 }]
 *     users.push({ name: 'Batman', weapon: 8921 })
 *     Weapon.populate(users, { path: 'weapon' }, function (err, users) {
 *       users.forEach(function (user) {
 *         console.log('%s uses a %s', users.name, user.weapon.name)
 *         // Indiana Jones uses a whip
 *         // Batman uses a boomerang
 *       })
 *     })
 *     // Note that we didn't need to specify the Weapon model because
 *     // we were already using it's populate() method.
 *
 * @param {Document|Array} docs Either a single document or array of documents to populate.
 * @param {Object} options A hash of key/val (path, options) used for population.
 * @param {Function} [cb(err,doc)] Optional callback, executed upon completion. Receives `err` and the `doc(s)`.
 * @return {Promise}
 * @api public
 */

Model.populate = function (docs, paths, cb) {
  var promise = new Promise(cb);

  // always resolve on nextTick for consistent async behavior
  function resolve () {
    var args = utils.args(arguments);

    process.nextTick(function () {
      promise.resolve.apply(promise, args);
    });
  }

  // normalized paths
  paths = utils.populate.call({
    model: this
  }, paths);
  var pending = paths.length;

  if (0 === pending) {
    resolve(null, docs);
    return promise;
  }

  // each path has its own query options and must be executed separately
  var i = pending;
  var path;
  var model = this;
  while (i--) {
    path = paths[i];
    if ('function' === typeof path.model) model = path.model;
    populate(model, docs, path, subPopulate.call(model, docs, path, next));
  }

  return promise;

  function next (err) {
    if (err) return resolve(err);
    if (--pending) return;
    resolve(null, docs);
  }
};

/*!
 * Populates deeply if `populate` option is present.
 *
 * @param {Document|Array} docs
 * @param {Object} options
 * @param {Function} cb
 * @return {Function}
 * @api private
 */
function subPopulate (docs, options, cb) {
  var model = this;
  var prefix = options.path+'.';
  var pop = options.populate;

  if (!pop) {
    return cb;
  }

  // normalize as array
  if (!Array.isArray(pop)) {
    pop = [pop];
  }

  return function (err) {
    var pending = pop.length;

    function next (err) {
      if (err) return cb(err);
      if (--pending) return;
      cb();
    }

    if (err || !pending) return cb(err);

    pop.forEach(function (subOptions) {
      // path needs parent's path prefixed to it
      if (!subOptions._originalPath) {
        subOptions._originalPath = subOptions.path;
        subOptions.path = prefix+subOptions.path;
      }
      if (typeof subOptions.model === 'string') {
        subOptions.model = model.model(subOptions.model);
      }
      Model.populate.call(subOptions.model || model, docs, subOptions, next);
    });
  };
}

/*!
 * Populates `docs`
 */
var excludeIdReg = /\s?-_id\s?/,
  excludeIdRegGlobal = /\s?-_id\s?/g;

function populate(model, docs, options, cb) {
  var modelsMap, rawIds;

  // normalize single / multiple docs passed
  if (!Array.isArray(docs)) {
    docs = [docs];
  }

  if (0 === docs.length || docs.every(utils.isNullOrUndefined)) {
    return cb();
  }

  modelsMap = getModelsMapForPopulate(model, docs, options);
  rawIds = getIdsForAndAddIdsInMapPopulate(modelsMap);

  var i, len = modelsMap.length,
    mod, match, select, promise, vals = [];

  promise = new Promise(function(err, vals, options, assignmentOpts) {
    if (err) return cb(err);

    var lean = options.options && options.options.lean,
      len = vals.length,
      rawOrder = {}, rawDocs = {}, key, val;

    // group results by foreignKey
    for (var i = 0; i < len; i++) {
      val = vals[i];
      key = String(utils.getValue(options.foreignKey || '_id', val));
      utils.setValue(options.path, key, docs[i]);
      if (!rawDocs[key]) {
        rawDocs[key] = [];
      }
      rawDocs[key].push(val);

      // flag each as result of population
      if (!lean) val.$__.wasPopulated = true;
    }

    assignVals(options.path, docs, rawDocs, options, assignmentOpts);
    cb();
  });

  var _remaining = len;
  for (i = 0; i < len; i++) {
    mod = modelsMap[i];
    select = mod.options.select;

    if (mod.options.match) {
      match = utils.object.shallowCopy(mod.options.match);
    } else {
      match = {};
    }

    var ids = utils.array.flatten(mod.ids, function(item) {
      // no need to include undefined values in our query
      return undefined !== item;
    });

    ids = utils.array.unique(ids);

    if (0 === ids.length || ids.every(utils.isNullOrUndefined)) {
      return cb();
    }

    match._id || (match[mod.options.foreignKey || '_id'] = {
      $in: ids
    });

    var assignmentOpts = {};
    assignmentOpts.sort = mod.options.options && mod.options.options.sort || undefined;
    assignmentOpts.excludeId = excludeIdReg.test(select) || (select && 0 === select._id);

    if (assignmentOpts.excludeId) {
      // override the exclusion from the query so we can use the _id
      // for document matching during assignment. we'll delete the
      // _id back off before returning the result.
      if ('string' == typeof select) {
        select = select.replace(excludeIdRegGlobal, ' ');
      } else {
        // preserve original select conditions by copying
        select = utils.object.shallowCopy(select);
        delete select._id;
      }
    }

    if (mod.options.options && mod.options.options.limit) {
      assignmentOpts.originalLimit = mod.options.options.limit;
      mod.options.options.limit = mod.options.options.limit * ids.length;
    }

    mod.Model.find(match, select, mod.options.options, next.bind(this, mod.options, assignmentOpts));
  }

  function next(options, assignmentOpts, err, valsFromDb) {
    if (err) return promise.resolve(err);
    vals = vals.concat(valsFromDb);
    if (--_remaining === 0) {
      promise.resolve(err, vals, options, assignmentOpts);
    }
  }
}

function getModelsMapForPopulate(model, docs, options) {
  var i, doc, len = docs.length,
    available = {},
    map = [],
    modelNameFromQuery = options.model && options.model.modelName || options.model,
    schema, refPath, Model, currentOptions, modelNames, modelName, discriminatorKey, modelForFindSchema;

  schema = model._getSchema(options.path);

  if(schema && schema.caster){
    schema = schema.caster;
  }

  if (!schema && model.discriminators){
    discriminatorKey = model.schema.discriminatorMapping.key;
  }

  refPath = schema && schema.options && schema.options.refPath;

  for (i = 0; i < len; i++) {
    doc = docs[i];

    if(refPath){
      modelNames = utils.getValue(refPath, doc);
    }else{
      if (!modelNameFromQuery) {
        var schemaForCurrentDoc;

        if(!schema && discriminatorKey){
          modelForFindSchema = utils.getValue(discriminatorKey, doc);

          if(modelForFindSchema){
            schemaForCurrentDoc = model.db.model(modelForFindSchema)._getSchema(options.path);

            if(schemaForCurrentDoc && schemaForCurrentDoc.caster){
              schemaForCurrentDoc = schemaForCurrentDoc.caster;
            }
          }
        } else {
          schemaForCurrentDoc = model.schema.virtualpath(options.path) || schema;
        }

        modelNames = [
          schemaForCurrentDoc && schemaForCurrentDoc.options && schemaForCurrentDoc.options.ref            // declared in schema
          || model.modelName                                           // an ad-hoc structure
        ];
      }else{
        modelNames = [modelNameFromQuery];  // query options
      }
    }

    if (!modelNames)
      continue;

    if (!Array.isArray(modelNames)) {
      modelNames = [modelNames];
    }

    var k = modelNames.length;
    while (k--) {
      modelName = modelNames[k];
      if (!available[modelName]) {
        Model = model.db.model(modelName);
        currentOptions = {
          model: Model
        };

        if (schema && !discriminatorKey) {
          options.model = Model;
        }

        utils.merge(currentOptions, options);

        available[modelName] = {
          Model: Model,
          options: currentOptions,
          docs: [doc],
          ids: []
        };
        map.push(available[modelName]);
      } else {
        available[modelName].docs.push(doc);
      }

    }
  }

  return map;
}

function getIdsForAndAddIdsInMapPopulate(modelsMap) {
  var rawIds = [] // for the correct position
    ,
    i, j, doc, docs, id, len, len2, ret, isDocument, options, path;

  len2 = modelsMap.length;
  for (j = 0; j < len2; j++) {
    docs = modelsMap[j].docs;
    len = docs.length;
    options = modelsMap[j].options;
    path = options.path;

    for (i = 0; i < len; i++) {
      ret = undefined;
      doc = docs[i];
      id = String(utils.getValue("_id", doc));
      isDocument = !! doc.$__;

      if (!ret || Array.isArray(ret) && 0 === ret.length) {
        if (options.localKey) {
          ret = utils.getValue(path.replace(options._originalPath || path, options.localKey), doc);
        } else {
          ret = utils.getValue(path, doc);
        }
      }

      if (ret) {
        ret = convertTo_id(ret);

        options._docs[id] = Array.isArray(ret) ? ret.slice() : ret;
      }

      rawIds.push(ret);
      modelsMap[j].ids.push(ret);

      if (isDocument) {
        // cache original populated _ids and model used
        doc.populated(path, options._docs[id], options);
      }
    }
  }

  return rawIds;
}

/*!
 * Retrieve the _id of `val` if a Document or Array of Documents.
 *
 * @param {Array|Document|Any} val
 * @return {Array|Document|Any}
 */

function convertTo_id (val) {
  if (val instanceof Model) return val._id;

  if (Array.isArray(val)) {
    for (var i = 0; i < val.length; ++i) {
      if (val[i] instanceof Model) {
        val[i] = val[i]._id;
      }
    }
    return val;
  }

  return val;
}

/*!
 * Assigns documents returned from a population query back
 * to the original document path.
 */

function assignVals (path, docs, subdocs, options, assignmentOpts) {
  var paths = path.split('.');
  var localKeyPath = options.localKey;

  if (paths.length > 1) {
    paths.splice(-1, 1, options.localKey);
    localKeyPath = paths.join('.');
  }

  docs.forEach(function (doc) {
    var localKey = utils.getValue(localKeyPath, doc);
    utils.setValue(path, subdocs[localKey], doc, function (val) {
      if (!val && !options.arrayPop) val = [];
      if (val && options.arrayPop) val = val[0];
      return valueFilter(val, assignmentOpts);
    });
  });
}

/*!
 * 1) Apply backwards compatible find/findOne behavior to sub documents
 *
 *    find logic:
 *      a) filter out non-documents
 *      b) remove _id from sub docs when user specified
 *
 *    findOne
 *      a) if no doc found, set to null
 *      b) remove _id from sub docs when user specified
 *
 * 2) Remove _ids when specified by users query.
 *
 * background:
 * _ids are left in the query even when user excludes them so
 * that population mapping can occur.
 */

function valueFilter (val, assignmentOpts) {
  if (Array.isArray(val)) {
    // find logic
    var ret = [];
    var numValues = val.length;
    for (var i = 0; i < numValues; ++i) {
      var subdoc = val[i];
      if (!isDoc(subdoc)) continue;
      maybeRemoveId(subdoc, assignmentOpts);
      ret.push(subdoc);
      if (assignmentOpts.originalLimit &&
          ret.length >= assignmentOpts.originalLimit) {
        break;
      }
    }

    // Since we don't want to have to create a new mongoosearray, make sure to
    // modify the array in place
    while (val.length > ret.length) {
      Array.prototype.pop.apply(val, []);
    }
    for (i = 0; i < ret.length; ++i) {
      val[i] = ret[i];
    }
    return val;
  }

  // findOne
  if (isDoc(val)) {
    maybeRemoveId(val, assignmentOpts);
    return val;
  }

  return null;
}

/*!
 * Remove _id from `subdoc` if user specified "lean" query option
 */

function maybeRemoveId (subdoc, assignmentOpts) {
  if (assignmentOpts.excludeId) {
    if ('function' == typeof subdoc.setValue) {
      delete subdoc._doc._id;
    } else {
      delete subdoc._id;
    }
  }
}

/*!
 * Determine if `doc` is a document returned
 * by a populate query.
 */

function isDoc (doc) {
  if (null == doc)
    return false;

  var type = typeof doc;
  if ('string' == type)
    return false;

  if ('number' == type)
    return false;

  if (Buffer.isBuffer(doc))
    return false;

  if ('ObjectID' == doc.constructor.name)
    return false;

  // only docs
  return true;
}

module.exports = function () {
  return mongoose;
}
