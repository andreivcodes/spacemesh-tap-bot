"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
const types_1 = require("../../types");
handlebars_1.registerHelper('defaultValue', function (field) {
    if (field.type === 'string') {
        return '""';
    }
    if (field.type === 'bool') {
        return 'false';
    }
    if (field.type === 'bytes') {
        return 'new Uint8Array(0)';
    }
    if (field.type in types_1.ENumberTypes || field.options.enum) {
        return '0';
    }
    if (field.keyType) {
        return '{}';
    }
    return 'null';
});
