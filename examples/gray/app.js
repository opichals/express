var express = require('../../lib/express');

var app = module.exports = express.createServer();

app.use(express.errorHandler({ showStack: true }));

var structs = {
    add: function(schema) {
        schema.forEach(function(s) {
            this[s.id] = s;
        }, this);
    }
};

// JSON Schema-based structure definition:
// http://tools.ietf.org/html/draft-zyp-json-schema-03
//
structs.add([{
    id: 'ReportData',
    type: 'string'
}]);
structs.add([{
    id: 'ExecuteIn',
    description: 'Data In',
    type: 'object',
    properties: {
        uri: {
            type: 'string',
            "default": 'http://localhost/uri'
        },
        nocache: {
            type: 'string',
            "enum": ['true', 'false'],
            "default": 'false',
            optional: true
        },
        flags: {
            type: "array",
            optional: true,
            "default": ["one", "two", "three"],
            items: {
                type: "string",
                minLength: 1
            }
        },
        body: {
            type: "object",
            optional: true,
            "default": { dummy: true }
        }
    }
}]);
structs.add([{
    id: 'ExecuteOut',
    type: 'object',
    properties: {
        // reference to another schema structure
        // TODO: have a look into JSON schema for object references
        //       (in the schema AND in the object instances)
        // like: reportData: { structure: 'data' } ... OR
        //       reportData: 'http://localhost/dataUri'
        //reportData: {"$ref": "ReportData"}
        reportData: structs.ReportData
    }
}]);


var coll = {
    add: function(schema) {
        schema.forEach(function(s) {
            this[s.id] = s;
        }, this);
    }
};
coll.add([{
    id: 'obj',
    type: 'object',
    properties: {
        'title': {
            type: 'string'
        },
        'description': {
            type: 'string'
        }
    }
}]);
coll.add([{
    id: 'objs',
    type: 'array',
    items: coll.obj,
}]);

var collection = [
  { id: 'coll:lst',  path: "/",     o: coll.objs, a: coll.lstargs }
  // set HTTP method directly for GET/PUT/POST explicitly
, { id: 'coll:get',  path: "/:id",  i: coll.obj, o: coll.obj }
];


// resource specs
var specs = [
  { id: 'reports', path: "/reports", spec: collection, items: "Report" }
, { id: 'exec',    path: "/projects/:id/:executor", i: structs.ExecuteIn, o: structs.ExecuteOut }
];

// link the spec to the implementation
var rest = require('./rest');
new rest(app).configure('/', specs, {
    // resource implementation
    exec: function(input, id) {
        return { exec: 'done', args: arguments };
    },

    items: [
         { title: 'xxx', description: 'XXXX' }
        ,{ title: 'yyy', description: 'YYYY' }
    ],
    'coll:get': function(input, id) {
        this.items[id] = input || this.items[id];
        return this.items[id];
    },
    'coll:lst': function(input) {
        return this.items;
    }
});

