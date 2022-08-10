"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = require("handlebars");
handlebars_1.registerHelper('enumComment', function (conditional, options) {
    if (options.data.root.comments && options.data.root.comments[conditional]) {
        return `// ${options.data.root.comments[conditional].replace(`\n`, '\n// ')}`;
    }
});
