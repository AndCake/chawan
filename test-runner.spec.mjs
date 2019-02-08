#!/usr/bin/env -S node --no-warnings --experimental-modules
import { describe, it, before, beforeEach, after, afterEach, expect, spy} from './test-runner';

describe('Test context', () => {
    let x = 0;

    before(() => {
        x = 1;
    });

    beforeEach(() => {
        x = x + 1;
    });
    after(() => {
        x = 0;
    });
    afterEach(() => {
        x = x - 1;
    });

    it('task', () => {
        expect(x).toEqual(2);
    });

    describe('Promise handling', () => {
        it('promise', () => {
            return Promise.resolve(x);
        });

        it('rejects', () => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        expect(true).toBeTrue();
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }, 10);
            });
        });
    });

    describe('expectations', () => {
        it('detects deep-equal', () => {
            expect({test: [{x: 12}, 'a']}).toDeepEqual({test: [{x: 12}, 'a']});
        });
        it('can expect exceptions', () => {
            expect(() => {
                throw new TypeError();
            }).toThrow(TypeError);
            expect(() => {
                throw new Error('Test message from sub function');
            }).toThrow('Test');
            expect(() => {
                throw 'test message from sub function';
            }).toThrow('sub');
            expect(() => {}).toNotThrow(Error);
            expect(() => {
                throw new Error();
            }).toNotThrow(TypeError);
            expect(() => {
                throw new Error('Regular message');
            }).toNotThrow('Weird message');
        });
    });

    describe('spies', () => {
        it('can create spies', () => {
            const s = spy();
            expect(s).toBeA('function');
            s.returns('test');
            let result = s();
            expect(s).toHaveBeenCalled();
            expect(result).toEqual('test');
            s('a', 5);
            expect(s).toHaveBeenCalled(2);
            expect(s).toHaveBeenCalledWith('a', 5);
        });
    });
});
