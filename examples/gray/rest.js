var express = require('../../lib/express');
var utils = require('../../lib/utils');
var path_module = require('path');

var rest = function(app) {
    this.app = app;

    // Here we use the bodyDecoder middleware
    // to parse urlencoded request bodies
    // which populates req.body
    app.use(express.bodyDecoder());

    // The methodOverride middleware allows us
    // to set a hidden input of _method to an arbitrary
    // HTTP method to support app.put(), app.del() etc
    app.use(express.methodOverride());
};

rest.prototype.configure = function(path, specs, service) {
    this.service = service;
    if (specs) specs.forEach(function(s) {
        // normalize the path to not to contain trailing slash
        var p = path_module.join(path, s.path, '/');
        var pp = p.split('/'); pp.pop(); p = pp.join('/');

        // nested spec
        this.configure.call(this, p, s.spec, this.service);
        // individual resource after
        this.resource.call(this, p, s);
    }, this);
    return this; // chainable
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

rest.prototype.defaultToString = function(schema, value) {
    if (schema.type === 'object') {
        return JSON.stringify(value || schema['default']);
    }
    return value || schema['default'] || '';
}

rest.prototype.collection = function(path, spec) {
    this.app.get(path, function(req, res, next) {
        res.send(JSON.stringify(spec, null, 2));
    });
};

rest.prototype.resource = function(path, spec) {
    var rest = this;
    var service = this.service;

console.log('resource: ', path);

    argPlaceholders = path.match(/\:([^\/]+)/g);
    argNames = argPlaceholders ? argPlaceholders.map(function(n) { return n.substring(1); }) : [];

    this.app.get(path, function(req, res, next) {
        // only spec handling
        if (req.param('$spec') === undefined) next();

        if (req.accepts('text/html')) {
            res.writeHead(200);
            res.write('<html><body style="background-color: #80d0de;">');
            res.write("\n"+"<fieldset><legend>spec</legend><pre>\n"+JSON.stringify(spec, null, 2)+'</pre></fieldset>');
            res.write('</body></html>');
            res.end();
            return;
        }
        res.send(JSON.stringify(spec, null, 2));
    });

    this.app.get(path, function(req, res, next) {
        // call the service 'GET' handling method
        var args = [null]; argNames.forEach(function(name) { args.push(req.param(name)); });
        var output = service[spec.id].apply(service, args) || {};

        if (req.accepts('text/html')) {
            res.writeHead(200);
            res.write('<html><body style="background-color: #80d0de;">');
            res.write('<form action="" method="POST">');
            if (0) argNames.forEach(function(name) {
                res.write("\n"+'<p><label for="'+name+'">' +name+ '</label><input id="'+name+'" name="'+name+'" type="text" value="' + req.param(name) + '"></p>');
            });

            var s = spec.i ? spec.i.properties : {};
            for(var an in s) {
                var a = s[an];
                res.write("\n"+'<fieldset><legend>' +an+ '</legend><input id="'+an+'" name="'+an+'" type="text" value="' + utils.htmlEscape(rest.defaultToString(a, output[an])) + '"></fieldset>');
            };
            res.write("\n"+'<p><input type="submit" value="OK"></p>');

            if (spec.o) res.write("\n"+"<fieldset><legend>result</legend><pre>\n"+JSON.stringify(output, null, 2)+'</pre></fieldset>');

            res.write("\n"+"<fieldset><legend>spec</legend><pre>\n"+JSON.stringify(spec, null, 2)+'</pre></fieldset>');
            res.write('</form></body></html>');
            res.end();
            return;
        }
        res.send(JSON.stringify(output));
    });

    this.app.post(path, function(req, res, next) {
        var input = rest.parseUrlEncoded(spec.i, req.body); //JSON.parse(req.body);

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

module.exports = rest;

