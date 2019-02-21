import cp from 'child_process';

const tasks = {
    context: null,
    passed: 0,
    rejected: 0,
    before: [],
    beforeEach: [],
    list: [],
    afterEach: [],
    after: [],
};

const threadList = [];
const stack = [];
let timer = null;

function run(task) {
    return new Promise((resolve, reject) => {
        try {
            const result = task.fn();
            if (result && typeof result.then === 'function') {
                result.then(() => {
                    resolve({ task });
                }, reject);
            } else {
                resolve({ task });
            }
        } catch (error) {
            reject(error);
        }
    });
}

export function runAll(listOfFiles = [], results = { passed: 0, failed: 0 }) {
    if (listOfFiles.length === 0 && threadList.length === 0) {
        console.log(`\n\x1b[32m${results.passed}\x1b[0m tests passed, \x1b[31m${results.failed}\x1b[0m tests failed.`);
    }
    while (threadList.length < 5 && listOfFiles.length > 0) {
        const child = cp.fork(listOfFiles.shift());
        child.on('close', (code) => {
            if (code !== 0 && !child.messageReceived) {
                results.failed += 1;
            }
            threadList.splice(threadList.indexOf(child), 1);
            runAll(listOfFiles, results);
        });
        child.on('message', (message) => {
            if (!message.final && !message.success) {
                console.error(`\x1b[31mx ${message.context} - ${message.name}: ${message.error}\x1b[0m\x1b[2m\n${message.stack}\n\x1b[0m`);
            } else if (message.final) {
                results.passed += message.passed;
                results.failed += message.rejected;
                child.messageReceived = true;
                if (message.success) {
                    console.log(`\x1b[32m√ ${message.context} (${message.duration}ms)\x1b[0m`);
                } else {
                    console.error(`\x1b[31mx ${message.context}\x1b[0m`);
                    process.exit(1);
                }
            }
        });
        threadList.push(child);
    }
}

function notify(message) {
    if (typeof process !== 'undefined' && typeof process.send === 'function') {
        process.send(message);
    } else if (!message.final) {
        if (message.success) {
            console.log(`\x1b[32m√ ${message.context} - ${message.name} (${message.duration}ms)\x1b[0m`);
        } else {
            console.error(`\x1b[31mx ${message.context} - ${message.name}: ${message.error}\x1b[0m\x1b[2m\n${message.stack}\n\x1b[0m`);
        }
    } else if (message.final) {
        if (message.success) {
            console.log(`\x1b[32m√ ${message.context} (${message.duration}ms)\x1b[0m`);
        } else {
            console.error(`\x1b[31mx ${message.context}\x1b[0m`);
        }
        console.log(`\n\x1b[32m${message.passed}\x1b[0m tests passed, \x1b[31m${message.rejected}\x1b[0m tests failed.`);
    }
}

function runStackEntry(tasksCopy, level) {
    let passed = 0;
    let rejected = 0;

    return Promise.all(tasksCopy.before.map(run)).
        then(() => {
            const list = tasksCopy.list;
            const runTask = () => {
                if (list.length <= 0) return Promise.resolve();
                const runnable = list.shift();
                let start = Date.now();
                return Promise.resolve().
                    then(() => Promise.all(tasksCopy.beforeEach.map(run))).
                    then(() => run(runnable)).
                    then(() => Promise.all(tasksCopy.afterEach.map(run))).
                    then(() => {
                        passed += 1;
                        notify({
                            success: true,
                            context: tasksCopy.context,
                            name: runnable.name,
                            duration: Date.now() - start,
                        });
                    }).
                    catch(err => {
                        rejected += 1;
                        notify({
                            success: false,
                            context: tasksCopy.context,
                            name: runnable.name,
                            error: err.message,
                            stack: err.stack.toString(),
                        });
                    }).then(runTask);
            }
            return runTask();
        }).
        then(() => Promise.all(tasksCopy.after.map(run))).
        then(() => ({
            rejected: level.rejected + rejected,
            passed: level.passed + passed,
            describeStart: level.describeStart,
        }));
}

export function describe(context = '', callback = () => {}) {
    // register all contained tasks
    let tasksCopy = JSON.parse(JSON.stringify(tasks));
    tasksCopy.context = stack.length === 0 ? context : `${stack[0].context} ${context}`;
    let level = stack.push(tasksCopy);
    callback();

    clearTimeout(timer);
    timer = setTimeout(() => {
        function next(result = {rejected: 0, passed: 0, describeStart: Date.now()}) {
            if (stack.length > 0) {
                runStackEntry(stack.shift(), result).then(next);
            } else {
                notify({
                    success: result.rejected === 0,
                    final: true,
                    context: tasksCopy.context,
                    rejected: result.rejected,
                    passed: result.passed,
                    duration: Date.now() - result.describeStart,
                });

                if (result.rejected > 0) {
                    process.exit(1);
                }
            }
        }
        next();
    }, 1);
}

describe.skip = () => {};

export function it(context, callback) {
    if (typeof callback !== 'function') return;
    stack[stack.length - 1].list.push({name: context, fn: callback});
}
it.skip = () => {};

export function before(callback) {
    stack[stack.length - 1].before.push({name: 'before', fn: callback});
}

export function after(callback) {
    stack[stack.length - 1].after.unshift({name: 'after', fn: callback});
}

export function beforeEach(callback) {
    stack[stack.length - 1].beforeEach.push({name: 'beforeEach', fn: callback});
}

export function afterEach(callback) {
    stack[stack.length - 1].afterEach.unshift({name: 'afterEach', fn: callback});
}

export function spy(toSpyOn, spyName) {
    let spyFn = (...args) => {
        spyFn.called += 1;
        spyFn.lastArgs = args;
        return spyFn._returnData;
    };
    spyFn.called = 0;
    spyFn.reset = () => {
        spyFn.called = 0;
        spyFn.lastArgs = [];
    };
    spyFn.returns = (data) => {
        spyFn._returnData = data;
        return spyFn;
    };
    spyFn.restore = () => {
        toSpyOn[spyName] = spyFn.originalFn;
    };
    if (!toSpyOn) {
        return spyFn;
    }
    spyFn.originalFn = toSpyOn[spyName];
    toSpyOn[spyName] = spyFn;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed.');
    }
}

function deepEqual(objA, objB) {
    if (objA === objB) return true;
    if (objA === null) return false;
    if (objB === null) return false;
    if (objA instanceof Date && objB instanceof Date) return objA.getTime() === objB.getTime();
    if (objA.prototype !== objB.prototype) return false;

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
        return false;
    }

    if (keysA.join('\0') !== keysB.join('\0')) return false;

    for (let i = 0, len = keysA.length, key; key = keysA[i], i < len; i += 1) {
        if (!deepEqual(objA[key], objB[key])) {
            return false;
        }
    }
    return true;
}

export function expect(actual, message) {
    return {
        toEqual(expected) {
            assert(actual === expected, message || `${actual} is not equal to ${expected}`);
        },
        toInclude(expected) {
            const msg = message || `${actual} does not contain ${expected}`;
            if (Array.isArray(actual) || typeof actual === 'string') {
                assert(actual.indexOf(expected) >= 0, msg);
            } else if (typeof actual === 'number' && typeof expected === 'number') {
                assert(actual % expected === 0, msg);
            } else if (typeof actual === 'object') {
                assert(actual[expected], msg);
            }
        },
        toNotInclude(expected) {
            const msg = message || `${actual} does contain ${expected}`;
            if (Array.isArray(actual) || typeof actual === 'string') {
                assert(actual.indexOf(expected) < 0, msg);
            } else if (typeof actual === 'number' && typeof expected === 'number') {
                assert(actual % expected !== 0, msg);
            } else if (typeof actual === 'object' && actual) {
                assert(typeof actual[expected] === 'undefined', msg);
            }
        },
        toBeTrue() {
            assert(actual === true, message || `${actual} is not true`);
        },
        toBeFalse() {
            assert(actual === false, message || `${actual} is not false`);
        },
        toBeA(type) {
            const msg = message || `${actual} is a ${typeof actual}, but not a ${type}`;
            if (typeof type === 'string') {
                assert(typeof actual === type, msg);
            } else {
                assert(actual instanceof type, msg);
            }
        },
        toExist() {
            assert(actual, message || `${actual} does not exist`);
        },
        toNotExist() {
            assert(!actual, message || `${actual} does exist`);
        },
        toBeEmpty() {
            const msg = message || `${actual} is not empty`;
            if (Array.isArray(actual) || typeof actual === 'string') {
                assert(actual.length === 0, msg);
            } else if (typeof actual === 'object') {
                assert(Object.keys(actual).length === 0, msg);
            } else {
                throw new TypeError(`Unexpected type for ${actual} (${typeof actual})`);
            }
        },
        toNotBeEmpty() {
            const msg = message || `${actual} is empty`;
            if (Array.isArray(actual) || typeof actual === 'string') {
                assert(actual.length !== 0, msg);
            } else if (typeof actual === 'object') {
                assert(Object.keys(actual).length !== 0, msg);
            } else {
                throw new TypeError(`Unexpected type for ${actual} (${typeof actual})`);
            }
        },
        toDeepEqual(expected) {
            assert(deepEqual(actual, expected), message || `${JSON.stringify(actual)} is not deep equal to ${JSON.stringify(expected)}`);
        },
        toNotDeepEqual(expected) {
            assert(!deepEqual(actual, expected), message || `${JSON.stringify(actual)} is deep equal to ${JSON.stringify(expected)} but shouldn't`);
        },
        toThrow(expected) {
            assert(typeof actual === 'function', 'Input needs to be a function');
            try {
                actual();
                assert(false, message || `did not throw ${expected}`)
            } catch (err) {
                if (!expected) return;
                if (typeof err === 'string') {
                    assert(err.indexOf(expected) >= 0, message || `Expected exception thrown: ${err}, expected ${expected}`);
                } else if (typeof expected !== 'string') {
                    assert(err instanceof expected, message || `Expected exception thrown: ${err.stack}, expected ${expected}`)
                } else {
                    assert(err.message.indexOf(expected) >= 0, message || `Expected exception thrown: ${err.stack}, expected ${expected}`)
                }
            }
        },
        toNotThrow(expected) {
            assert(typeof actual === 'function', 'Input needs to be a function');
            try {
                actual();
            } catch (err) {
                assert(expected, message || `Did not expect an exception thrown`);
                if (typeof err === 'string') {
                    assert(err.indexOf(expected) < 0, message || `Expected exception not thrown: ${err}, expected ${expected}`);
                } else if (typeof expected !== 'string') {
                    assert(!(err instanceof expected), message || `Expected exception not thrown: ${err.stack}, expected ${expected}`)
                } else {
                    assert(err.message.indexOf(expected) < 0, message || `Expected exception not thrown: ${err.stack}, expected ${expected}`)
                }
            }
        },
        toBeLessThan(expected) {
            assert(actual < expected, message || `Expected ${actual} to be less than ${expected}`);
        },
        toBeGreaterThan(expected) {
            assert(actual > expected, message || `Expected ${actual} to be greater than ${expected}`);
        },
        toMatch(expected) {
            assert(typeof actual === 'string', `${actual} needs to be a string`);
            assert(expected instanceof RegExp, `${expected} needs to be a regular expression`);
            assert(actual.match(expected), message || `${actual} does not match ${expected}`);
        },
        toNotMatch(expected) {
            assert(typeof actual === 'string', `${actual} needs to be a string`);
            assert(expected instanceof RegExp, `${expected} needs to be a regular expression`);
            assert(!actual.match(expected), message || `${actual} does match ${expected}, but shouldn't`);
        },
        toHaveBeenCalled(times) {
            assert(typeof times !== 'number' ? actual.called > 0 : actual.called === times, message || `spy was not called ${times}`);
        },
        toHaveBeenCalledWith(...args) {
            const argMatch = args.filter(arg => actual.lastArgs.indexOf(arg) >= 0);

            assert(argMatch.length === args.length, message || `Expected spy to be called with ${args.join(', ')}`);
        }
    }
}
