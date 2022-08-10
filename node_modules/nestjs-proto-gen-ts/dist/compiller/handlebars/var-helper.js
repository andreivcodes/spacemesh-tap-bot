"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
handlebars_1.registerHelper('var', function (varName, varValue, options) {
    options.data.root[varName] = varValue;
});
