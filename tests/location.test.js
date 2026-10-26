import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCoordinates } from '../src/utils/location.js';

test('pickup pins accept finite coordinates, numeric input values, and zero', () => {
  assert.deepEqual(getCoordinates(13.6217, 123.1942), [13.6217, 123.1942]);
  assert.deepEqual(getCoordinates(' 13.6217 ', '123.1942'), [13.6217, 123.1942]);
  assert.deepEqual(getCoordinates(0, 0), [0, 0]);
  assert.deepEqual(getCoordinates(-90, 180), [-90, 180]);
});

test('missing, partial, malformed, or out-of-range pins cannot render a map', () => {
  for (const [latitude, longitude] of [
    [undefined, undefined], [null, null], ['', ''], [' ', ' '],
    [13.6217, null], ['', 123.1942], [NaN, 123], [13, Infinity],
    [91, 123], [-91, 123], [13, 181], [13, -181],
    [false, false], [[], []], ['Naga City', 'Carolina'],
  ]) {
    assert.equal(getCoordinates(latitude, longitude), null);
  }
});
