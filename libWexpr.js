// libWexpr.js
// A Wexpr decoding and encoding library for javascript.
// Copyright 2018
// Author Alexander Clay
// License MIT/X11
/**
Copyright (c) 2018 Alexander Clay

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
**/
libWexpr = {
    version: "1.0.0",
    WexprSpec: "0.1",

    warnings: [],
    errormsg: "",

    regex: /([\s]+)|(;\(--(?:.|\n)*?--\))|(;[^\n]*)|("(?:[^"\\]*(?:\\.[^"\\]*)*)")|(-?\d*\.?\d+(?=[\s]))|([^<>"*#@\(\);\[\]\s]+)|(\*\[[a-zA-Z_][a-zA-Z0-9_]*\])|(\[[a-zA-Z_][a-zA-Z0-9_]*\])|(<[a-zA-Z0-9\+\/=]+>)|(\#\()|(\@\()|(\))|(.+)/g,

    tokens: [
        {
            name:"whitespace",
            syntax:false
        },
        {
            name:"block comment",
            syntax:false
        },
        {
            name:"line comment", 
            syntax:false
        },
        {
            name:"string",
            syntax:true,
            validateRegex:/([\\"rnt])/g,
            escapeRegex:/\\([\\"rnt])/g,
            getValue: function(obj) {
                var token = obj.getToken();
                var string = token.token.substring(1, token.token.length-1);
                var result = null;

                var i = 0;
                while (i < string.length) {
                    if (string.substring(i, i+1) == "\\") {
                        if ((string.substring(i+1, i+2)).match(this.validateRegex) == null) {
                            obj.throw("Syntax Error: Invalid escape sequence.", token.index+i+1, 2)
                        }
                        i=i+1
                    }
                    i=i+1
                }
                return string.replace(this.escapeRegex, function(match) {
                    return ({
                        "\\t":"\t",
                        "\\r":"\r",
                        "\\n":"\n",
                        "\\\"":"\"",
                        "\\\\":"\\"
                    })[match]
                });
            }
        },
        {
            name:"number",
            syntax:true,
            getValue: function(obj) {
                var token = obj.getToken();
                return parseFloat(token.token);
            }
        },
        {
            name:"word",
            syntax:true,
            getValue: function(obj) {
                var token = obj.getToken();
                switch (token.token) {
                    case "true":
                        return true;
                    case "false":
                        return false;
                    case "null":
                        return null;
                    case "nil":
                        return null;
                    default:
                        return token.token;
                }
            }
        },
        {
            name:"reference",
            syntax:true,
            getValue: function(obj) {
                var token = obj.getToken();
                var reference = (token.token.match(/\*\[([a-zA-Z_][a-zA-Z0-9_]*)\]/))[1];
                if (obj.references[reference] == undefined) {
                    obj.throw("Syntax Error: Reference [" + reference + "] is undefined.", token.index, token.token.length);
                }
                return obj.references[reference];
            }
        },
        {
            name:"reference definition",
            syntax:true,
            getValue: function(obj) {
                var token = obj.getToken();
                var reference = (token.token.match(/\[([a-zA-Z_][a-zA-Z0-9_]*)\]/))[1];
                token = obj.nextToken();
                if (obj.tokens[token.type].getValue) {
                    obj.references[reference] = obj.tokens[token.type].getValue(obj);
                } else {
                    obj.throw("Syntax Error: Expected value to define reference [" + reference + "] but instead found " + obj.tokens[token.type].name + ".", token.index, token.token.length);
                }
                return obj.references[reference];
            }
        },
        {
            name:"binary",
            syntax:true,
            getValue: function(obj) {
                var token = obj.getToken();
                var data = token.token.substring(1, token.token.length-1);
                try {
                    if (Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]') {
                        return Buffer(data, 'base64').toString('binary');
                    } else {
                        return window.atob(data);
                    }
                } catch(err) {
                    obj.throw("Syntax Error: Invalid binary data: " + err, token.index, token.token.length)
                }
            }
        },
        {
            name:"array",
            syntax:true,
            getValue: function(obj) {
                var token = null;
                var array = [];
                while (token = obj.nextToken()) {
                    if (obj.tokens[token.type].name == "close scope") {
                        return array;
                    } else if (obj.tokens[token.type].getValue) {
                        array.push(obj.tokens[token.type].getValue(obj));
                    } else {
                        obj.throw("Syntax Error: Expected value to insert into array but instead found " + obj.tokens[token.type].name + ".", token.index, token.token.length);
                    }
                }
            }
        },
        {
            name:"map",
            syntax:true,
            getValue: function(obj) {
                var token = null;
                var map = {};
                while (token = obj.nextToken()) {
                    switch (obj.tokens[token.type].name) {
                        case "close scope":
                            return map;
                        case "string":
                        case "number":
                        case "word":
                            var key = obj.tokens[token.type].getValue(obj);
                            if (key == null) {
                                obj.throw("Syntax Error: Expected value for map key " + key + " as word, number, or string but instead found null.", token.index, token.token.length);
                            }
                            token = obj.nextToken();
                            if (obj.tokens[token.type].getValue) {
                                map[key] = obj.tokens[token.type].getValue(obj);
                            } else {
                                obj.throw("Syntax Error: Expected value for map key " + key + " as word, number, or string but instead found " + obj.tokens[token.type].name + ".", token.index, token.token.length);
                            }
                            break;
                        default:
                            obj.throw("Syntax Error: Expected map key as word, number, or string but instead found " + obj.tokens[token.type].name + ".", token.index, token.token.length);
                    }
                }
            }
        },
        {
            name:"close scope",
            syntax:true
        },
        {
            name:"unknown",
            syntax:false
        }
    ],

    chunk: null,
    token: null,
    references: null,

    throw: function(error, index, length) {
        length = length | 0;
        index = index | 0;
        var offset = 0;
        var lines = (this.chunk.substring(0, index).match(/(.*)[\n]/g) || []);
        var line = lines.length + 1;
        if (line == 1) {
            var position = index;
        } else {
            for (i=0; i<line-1; i++) {
                offset += lines[i].length;
            }
            position = index - offset;
        }
        var lines = (this.chunk.match(/^(.*)$/gm) || []);
        throw line + ":" + (position + 1) + ":" + error + "\n" + lines[line-1] + "\n" + new Array(position + 1).join(" ") + "^" + new Array(length).join("~")
    },

    encode: function(object, pretty, binary) {
        pretty = pretty || false;
        binary = binary || {};

        this.warnings = [];
        this.errormsg = "";

        var indent = -1;
        if (pretty) {
            indent = 0
        }

        try {
            return [this.encodeValue(indent, "-", object, binary), null];
        }
        catch(err) {
            return [null, err];
        }

    },

    encodeArray: function(indent, path, value, binary) {
        var chunk = "#(";

        indentString = " ";
        if (indent > -1) {
            indentString = "\n";
            for (var i = 0; i<indent; i++) {
                indentString = indentString + "\t";
            }
        }

        for (var i = 0; i < value.length; i++) {
            var vchunk = this.encodeValue(indent, path + "." + i , value[i], binary);
            if (vchunk != null) {
                chunk += indentString + vchunk;
            }
        }

        indentString = " ";
        if (indent > -1) {
            indentString = "\n";
            for (var i = 0; i<indent-1; i++) {
                indentString = indentString + "\t";
            }
        }
        return chunk += indentString + ")"
    },

    encodeMap: function(indent, path, value, binary) {
        var chunk = "@(";

        indentString = " ";
        if (indent > -1) {
            indentString = "\n";
            for (var i = 0; i<indent; i++) {
                indentString = indentString + "\t";
            }
        }

        for (var key in value) {
            var vchunk = this.encodeValue(indent, path + "." + key, value[key], binary);
            if (vchunk != null) {
                keyStr = this.encodeValue(0, "", key, {})
                if (keyStr != null) {
                    chunk += indentString + keyStr + " " + vchunk;
                } else {
                    this.warnings.push("Warning: Cannot insert invalid key at " + path);
                }
            }
        }

        indentString = " ";
        if (indent > -1) {
            indentString = "\n";
            for (var i = 0; i<indent-1; i++) {
                indentString = indentString + "\t";
            }
        }
        return chunk += indentString + ")"
    },

    encodeValue: function(indent, path, value, binary) {

        switch(typeof value) {
            case "number":
                if (value != value) {
                    this.warnings.push("Warning: Cannot insert NaN at " + path);
                    return null;
                }
                return String(value);
            case "boolean":
                return String(value);
            case "string":
                str = String(value);
                if ( binary[path] != undefined ) {
                    if (Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]') {
                        return "<" + Buffer(str).toString('base64') + ">";
                    } else {
                        return "<" + window.btoa(str) + ">";
                    }
                }else if (str != "nil" && str != "null" && str != "true" && str != "false" && (str.match(/[^<>"*#@\(\);\[\]\r\n \t]+/) == str)) {
                    return str;
                } else {
                    str = str.replace(/\\/g, "\\\\");
                    str = str.replace(/\r/g, "\\r");
                    str = str.replace(/\n/g, "\\n");
                    str = str.replace(/\t/g, "\\t");
                    str = str.replace(/\"/g, "\\\"");
                    return "\"" + str + "\"";
                }
            case "object":
                if (value === null) {
                    return "null"
                } else if (Array.isArray(value)) {
                    if (indent > -1) {
                        indent += 1
                    }
                    return this.encodeArray(indent, path, value, binary);
                } else {
                    if (indent > -1) {
                        indent += 1
                    }
                    return this.encodeMap(indent, path, value, binary);
                }
            default:
                this.warnings.push("Warning: Cannot insert unknown type at " + path);
                return null;
        }

    },

    decode: function(chunk, references) {
        this.regex.lastIndex = 0;
        this.chunk = chunk;
        this.references = references || {};
        if (typeof this.references != "object") {
            return [undefined, "Error: Expected references as an object but instead found " + typeof this.references];
        }

        try {
            var token = this.nextToken();
            if (this.tokens[token.type].getValue) {
                var wexpr = this.tokens[token.type].getValue(this);
                while (result = this.nextToken(true)) {
                    this.throw("Syntax Error: Garbage at end of file.", result.index)
                }
                return [wexpr, undefined];
            } else {
                this.throw("Syntax Error: Expected base value for Wexpr but instead found " + obj.tokens[token.type].name + ".", token.index, token.token.length);
            }
        }
        catch(err) {
            return [undefined, err];
        }

    },

    nextToken: function(expectEnd) {
        expectEnd = expectEnd || false
        while (result = this.regex.exec(this.chunk)) {
            for (var c = 0; c < this.tokens.length; c++){
                if (result[c+1] != undefined) {
                    if (c == this.tokens.length-1) {
                        this.throw("Syntax Error: Unknown token.", result.index)
                    } else if (!this.tokens[c].syntax) {
                        break
                    } else {
                        this.token = {
                            token: result[0],
                            type: c,
                            index: result.index
                        }
                        return this.token
                    }
                }
            }
        }
        if (expectEnd) {
            return;
        } else {
            this.throw("Syntax Error: File ended expectedly.", this.chunk.length)
        }
    },

    getToken: function() {
        return this.token
    }

}
