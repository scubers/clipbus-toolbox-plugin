'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { rendererResult } = require('../../dist/runtime/index.cjs');

describe('rendererResult', () => {
  it('success_buildsLockedShape', () => {
    const result = rendererResult.success();
    assert.deepEqual(result, { success: true, userMessage: null });
  });

  it('success_acceptsUserMessage', () => {
    const result = rendererResult.success({ userMessage: 'great' });
    assert.equal(result.success, true);
    assert.equal(result.userMessage, 'great');
  });

  it('failure_buildsLockedShape', () => {
    const result = rendererResult.failure('something went wrong');
    assert.deepEqual(result, { success: false, userMessage: 'something went wrong' });
  });

  it('failure_coercesUndefinedToNull', () => {
    const result = rendererResult.failure(undefined);
    assert.equal(result.success, false);
    assert.equal(result.userMessage, null);
  });

  it('failure_coercesNullToNull', () => {
    const result = rendererResult.failure(null);
    assert.equal(result.success, false);
    assert.equal(result.userMessage, null);
  });
});
