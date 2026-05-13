'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { definePlugin } = require('../../dist/runtime/index.cjs');

describe('definePlugin', () => {
  it('rejectsMissingSetup — throws when setup function absent', () => {
    assert.throws(
      () => definePlugin({}),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'definePlugin(...) requires a setup(init) function.');
        return true;
      }
    );
  });

  it('rejectsNull — throws for null input', () => {
    assert.throws(
      () => definePlugin(null),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'definePlugin(...) requires a setup(init) function.');
        return true;
      }
    );
  });

  it('rejectsUndefined — throws for undefined input', () => {
    assert.throws(
      () => definePlugin(undefined),
      (err) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'definePlugin(...) requires a setup(init) function.');
        return true;
      }
    );
  });

  it('passesThroughDefinition — returns same reference for valid input', () => {
    const def = { setup() { return {}; } };
    const result = definePlugin(def);
    assert.equal(result, def);
  });
});
