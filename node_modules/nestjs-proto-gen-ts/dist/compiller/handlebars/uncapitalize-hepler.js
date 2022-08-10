"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
handlebars_1.registerHelper('uncapitalize', function (conditional) {
    return conditional[0].toLowerCase() + conditional.slice(1);
});
