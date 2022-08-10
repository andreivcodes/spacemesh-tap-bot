"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
const types_1 = require("../../types");
const KNOWN_PREFIX = 'google.protobuf.';
function jsType(protoType) {
    if (protoType === 'string') {
        return 'string';
    }
    if (protoType === 'bool') {
        return 'boolean';
    }
    if (protoType === 'bytes') {
        return 'Uint8Array';
    }
    if (protoType in types_1.ENumberTypes) {
        return 'number';
    }
    if (protoType in types_1.EGoogleTypes) {
        return `${KNOWN_PREFIX}${protoType}`;
    }
    if (protoType.substr(0, KNOWN_PREFIX.length) === KNOWN_PREFIX) {
        return protoType;
    }
    return null;
}
handlebars_1.registerHelper('type', function (field) {
    let type = jsType(field.type);
    if (!type) {
        type = field.type;
        if (field.options && field.options.parent) {
            type = `${field.options.parent}.${type}`;
        }
    }
    if (field.keyType) {
        type = `{ [key: ${jsType(field.keyType)}]: ${type} }`;
    }
    if (field.repeated) {
        type += `[]`;
    }
    return type;
});
