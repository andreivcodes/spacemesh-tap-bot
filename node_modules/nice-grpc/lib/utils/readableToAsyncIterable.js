"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readableToAsyncIterable = void 0;
/**
 * This is a copy of NodeJS createAsyncIterator(stream), with removed stream
 * destruction.
 *
 * https://github.com/nodejs/node/blob/v15.8.0/lib/internal/streams/readable.js#L1079
 *
 * @internal
 */
async function* readableToAsyncIterable(stream) {
    let callback = nop;
    function next(resolve) {
        if (this === stream) {
            callback();
            callback = nop;
        }
        else {
            callback = resolve;
        }
    }
    const state = stream._readableState;
    let error = state.errored;
    let errorEmitted = state.errorEmitted;
    let endEmitted = state.endEmitted;
    let closeEmitted = state.closeEmitted;
    stream
        .on('readable', next)
        .on('error', function (err) {
        error = err;
        errorEmitted = true;
        next.call(this);
    })
        .on('end', function () {
        endEmitted = true;
        next.call(this);
    })
        .on('close', function () {
        closeEmitted = true;
        next.call(this);
    });
    while (true) {
        const chunk = stream.destroyed ? null : stream.read();
        if (chunk !== null) {
            yield chunk;
        }
        else if (errorEmitted) {
            throw error;
        }
        else if (endEmitted) {
            break;
        }
        else if (closeEmitted) {
            break;
        }
        else {
            await new Promise(next);
        }
    }
}
exports.readableToAsyncIterable = readableToAsyncIterable;
const nop = () => { };
//# sourceMappingURL=readableToAsyncIterable.js.map