
/**
 * Module dependencies.
 */

var express = require('../../lib/express');

var structs = {};

structs.ReportData = {
    schema: {
        type: 'string'
    }
};

structs.ExecuteIn = {
    schema: {
        type: 'object',
        properties: {
            uri: {
                type: 'string'
            },
            nocache: {
                type: 'enum',
                items: ['true', 'false'],
                optional: true
            },
            flags: {
                type: "array",
                optional: true,
                items: {
                    type: "string",
                    minLength: 1
                }
            },
            body: {
                type: "object",
                optional: true
            }
        }
    }
};

structs.ExecuteOut = {
    schema: {
        type: 'object',
        properties: {
            // reference to another schema structure
            // TODO: have a look into JSON schema for object references
            //       (in the schema AND in the object instances)
            // like: reportData: { structure: 'data' } ... OR
            //       reportData: 'http://localhost/dataUri'
            reportData: structs.ReportData.schema
        }
    }
};

var specs = [
  { id: 'reports', path: "/reports", type: "Collection", items: "Report" }
, { id: 'exec',    path: "/projects/:id/:executor", i: structs.ExecuteIn, o: structs.ExecuteOut }
];

var app = express.createServer();

// Here we use the bodyDecoder middleware
// to parse urlencoded request bodies
// which populates req.body
app.use(express.bodyDecoder());
    
// The methodOverride middleware allows us
// to set a hidden input of _method to an arbitrary
// HTTP method to support app.put(), app.del() etc
app.use(express.methodOverride());



var rest = function(app) {
    this.app = app;
};

rest.prototype.configure = function(specs, service) {
    this.service = service;
    specs.forEach(this.itemConfigure, this);
    return this; // chainable
};

rest.prototype.itemConfigure = function(spec) {
    if (spec.type === 'Collection') {
        this.collection.call(this, spec.path, spec);
    } else {
        this.resource.call(this, spec.path, spec);
    }
};

rest.prototype.parseUrlEncoded = function(schema, body) {
    var res = {};
    for(var k in body) {
        console.log(k, schema.properties[k], body[k]);
        var sk = schema.properties[k];
        if (sk.type === 'array') {
            if (sk.items.type === 'string') {
                res[k] = body[k].split(/\s*,\s*/);
            } else {
                res[k] = body[k];
            }
            continue;
        }
        if (sk.type === 'string') {
            res[k] = body[k];
            continue;
        }
        if (sk.type === 'object') {
            res[k] = JSON.parse(body[k]);
            continue;
        }
    }
    return res;
};

rest.prototype.collection = function(path, spec) {
    this.app.get(path, function(req, res, next) {
        res.send(JSON.stringify(spec, null, 2));
    });
};

rest.prototype.resource = function(path, spec) {
    var rest = this;
    var service = this.service;

    argNames = path.match(/\:([^\/]+)/g).map(function(n) { return n.substring(1); });

    this.app.get(path, function(req, res, next) {
        if (req.accepts('text/html')) {
            res.writeHead(200);
            res.write('<html><body>');
            res.write('<form action="'+req.url+'" method="POST">');
            if (0) argNames.forEach(function(name) {
                res.write("\n"+'<p><label for="'+name+'">' +name+ '</label><input id="'+name+'" name="'+name+'" type="text" value="' + req.param(name) + '"></p>');
            });
            var s = spec.i.schema.properties;
            for(var an in s) {
                var a = s[an];
                res.write("\n"+'<p><label for="'+an+'">' +an+ '</label><input id="'+an+'" name="'+an+'" type="text" value="' + '{default}' + '"></p>');
            };
            res.write("\n"+'<p><input type="submit" value="OK"></p>');
            res.write("\n"+"<pre>schema:\n"+JSON.stringify(spec, null, 2)+'</pre>');
            res.write('</form></body></html>');
            res.end();
            return;
        }
        res.send(JSON.stringify(spec, null, 2));
    });
    this.app.post(path, function(req, res, next) {
        var input = rest.parseUrlEncoded(spec.i.schema, req.body); //JSON.parse(req.body);

        // req.params _is not_ a regular hash 8-(
        // console.log(req.params) => [ id: 1234, xxx: "yyy" ]

        // put the spec.i always as the first as we can change the context
        // of the method and it should not stop working
        var args = [input];
        argNames.forEach(function(name) {
            args.push(req.param(name));
        });

        var output = service[spec.id].apply(service, args);
        res.send(JSON.stringify(output));
    });
};

var executor = {
    exec: function(input, id) {
        return { exec: 'done', args: arguments };
    }
};

new rest(app).configure(specs, executor);

// Middleware

app.use(express.errorHandler({ showStack: true }));

app.listen(3000);
console.log('Express app started on port 3000');
