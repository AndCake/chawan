United ES6 test tools

Mocha is great but having asserts, assert plugins and spies spread out as separate projects is a bit frustrating, especially when you have to jump around all of the different documentations to setup test environments.

Additionally, most of these are regular CommonJS modules which makes their usage in a pure ES module awkward.

Chawan goals
============

 * directly usable as an ES6 module in Node without cross-compiling
 * have test files runnable as regular programs
 * test files should run in separate processes
 * documentation for expectations/spies/tests in ONE place
 * shallow learning curve, quick to start and work with

BDD API
=======

Chawan provides a mocha-like API to structure your tests. It also supports promises and the typical hooks:

* before
* beforeEach
* afterEach
* after

```js
import { describe, it } from 'chawan';

describe('Array', () => {
    describe('#lastIndexOf', () => {
        it('finds the last occurrence of a given element', () => {
            // ...
        });

        it('returns -1 if no such element exists', () => {
            // ...
        });

        it.skip('is not done yet', () => {
            // ...
        });
    });
});

```

Expectations
============

 * `expect(a).toBeA(e)` - check if `a` is of type `e`
 * `expect(a).toEqual(e)`, `expect(a).toNotEqual(b)` - checks for equality
 * `expect(a).toBeTrue()`, `expect(a).toNotBeTrue()`
 * `expect(a).toBeFalse()`, `expect(a).toNotBeFalse()`
 * `expect(a).toBeEmpty()`, `expect(a).toNotBeEmpty()`
 * `expect(a).toExist()`, `expect(a).toNotExist()`
 * `expect(a).toBeLessThan(e)`, `expect(a).toBeGreaterThan(e)`
 * `expect([1,2]).toInclude(1)`, `expect([1,2]).toNotInclude(3)`
 * `expect(f).toThrow([<Error>|<String>])`, `expect(f).toNotThrow([<Error>|<String>])`
 * `expect(s).toMatch(regexp)`, `expect(s).toNotMatch(regexp)`
 * `expect(a).toDeepEqual(b)`, `expect(a).toNotDeepEqual(b)`

for spies:

 * `expect(s).toHaveBeenCalled([nTimes])`
 * `expect(s).toHaveBeenCalledWith(a1, a2)`

Spies
=====

```js
import {expect, spy} from 'chawan';

// spy on objects
{
    const obj = {};
    spy(obj, 'funcName');
    obj.funcName();
    expect(obj.funcName).toHaveBeenCalled();
}
// standalone spy
{
    let s = spy();
    s();
    expect(s).toHaveBeenCalled();
}

// spy with specific return value
{
    let s = spy().returns('hello world!');
    expect(s()).toEqual('hello world!');
    expect(s).toHaveBeenCalled(1);
}

// spy overwriting existing function
{
    const obj = {
        myFunc: () => { return 'original'; }
    };
    s(obj, 'myFunc').returns(2);
    expect(obj.myFunc('a', 3, 7)).toEqual(2);
    expect(obj.myFunc).toHaveBeenCalledWith('a', 3);
    expect(obj.myFunc.lastArgs[2]).toEqual(7);
    obj.myFunc.restore();
    expect(obj.myFunc()).toEqual('original');
}
```

Running tests
=============

In order to execute a test file, simply run it as you would normally do in Node.js:

```bash
$ node --experimental-modules --no-warnings ./tests/my-test.mjs
```

Alternatively, you can also have the test file directly executable:

```js
#!/usr/bin/env -S node --no-warnings --experimental-modules

import { describe, it, expect } from 'chawan';

describe('my test', () => {
    // ...
});
```

You can then run it like that:

```bash
$ sh ./tests/my-test.mjs
```

If you want to run multiple tests together as one test suite, you can use the chawan binary:

```bash
$ chawan ./tests/*.mjs
```
