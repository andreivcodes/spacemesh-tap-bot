"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cli = void 0;
const yargs_1 = require("yargs");
const chalk_1 = require("chalk");
const path_1 = require("path");
const options_1 = require("../options");
const compiller_1 = require("../compiller");
exports.cli = yargs_1.usage('Extract and merge locale files.\nUsage: $0 [options]')
    .version(require(`${__dirname}/../../package.json`).version)
    .alias('version', 'v')
    .help('help')
    .alias('help', 'h')
    .option('path', {
    alias: 'p',
    describe: 'Path to root directory',
    type: 'array',
    normalize: true
})
    .option('output', {
    alias: 'o',
    describe: 'Path to output directory',
    type: 'string',
    normalize: true
})
    .option('template', {
    describe: "Handlebar's template for output",
    type: 'string'
})
    .option('target', {
    alias: 't',
    describe: 'Proto files',
    default: options_1.options.target,
    type: 'array'
})
    .option('ignore', {
    alias: 'i',
    describe: 'Ignore file or directories',
    default: options_1.options.ignore,
    type: 'array'
})
    .option('comments', {
    alias: 'c',
    describe: 'Add comments from proto',
    default: options_1.options.comments,
    type: 'boolean'
})
    .option('verbose', {
    describe: 'Log all output to console',
    default: options_1.options.verbose,
    type: 'boolean'
})
    .demandOption(['path'], chalk_1.red.bold('Please provide both run and [path] argument to work with this tool'))
    .exitProcess(true)
    .parse(process.argv);
if (exports.cli === null || exports.cli === void 0 ? void 0 : exports.cli.template) {
    exports.cli.template = path_1.resolve(process.cwd(), exports.cli.template);
}
const compiller = new compiller_1.Compiller(Object.assign(Object.assign({}, options_1.options), exports.cli));
compiller.compile();
