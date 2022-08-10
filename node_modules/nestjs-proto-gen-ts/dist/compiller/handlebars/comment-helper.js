"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
handlebars_1.registerHelper('comment', function () {
    if (this.comment) {
        return `// ${this.comment.replace(/\n/g, '\n// ')}`;
    }
});
