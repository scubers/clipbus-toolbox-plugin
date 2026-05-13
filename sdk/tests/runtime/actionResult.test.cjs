'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { actionResult } = require('../../dist/runtime/index.cjs');
const fixtures = require('./__fixtures__/actionResult.cjs');

describe('actionResult', () => {
  it('text_buildsLockedShape', () => {
    const result = actionResult.text('hi');
    assert.deepEqual(result, fixtures.textResult);
  });

  it('text_coercesNullValueToEmptyString', () => {
    const result = actionResult.text(null);
    assert.equal(result.result.text, '');
    assert.equal(result.result.resultKind, 'text');
    assert.equal(result.userMessage, null);
  });

  it('text_acceptsUserMessageOption', () => {
    const result = actionResult.text('hi', { userMessage: 'done' });
    assert.equal(result.userMessage, 'done');
  });

  it('text_preservesEmptyStringUserMessage', () => {
    // Ensure ?? null (not || null) is used — empty string must not become null
    const result = actionResult.text('hi', { userMessage: '' });
    assert.equal(result.userMessage, '');
  });

  it('none_buildsLockedShape', () => {
    const result = actionResult.none();
    assert.deepEqual(result, fixtures.noneResult);
  });

  it('text_preservesNullUserMessageAsNull', () => {
    // explicit null must pass through as null, not become "" or undefined
    const result = actionResult.text('hi', { userMessage: null });
    assert.equal(result.userMessage, null);
  });

  it('none_acceptsUserMessage', () => {
    const result = actionResult.none({ userMessage: 'all done' });
    assert.equal(result.userMessage, 'all done');
    assert.equal(result.result.resultKind, 'none');
    assert.equal(result.result.text, null);
  });
});
