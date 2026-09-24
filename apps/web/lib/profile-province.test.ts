import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  MAX_PROVINCE_LENGTH,
  normalizeProvince,
  provinceValidationError,
} from './profile-province.ts';

test('normalizes province whitespace before sending it to the API', () => {
  assert.equal(
    normalizeProvince('  นครราชสีมา   เขตเมือง  '),
    'นครราชสีมา เขตเมือง',
  );
});

test('allows an empty province so legacy null profiles can update other fields', () => {
  assert.equal(provinceValidationError('   '), null);
});

test('accepts a province within the API length limit', () => {
  assert.equal(provinceValidationError('เชียงใหม่'), null);
  assert.equal(provinceValidationError('ก'.repeat(MAX_PROVINCE_LENGTH)), null);
});

test('rejects a province longer than the API length limit', () => {
  assert.equal(
    provinceValidationError('ก'.repeat(MAX_PROVINCE_LENGTH + 1)),
    `จังหวัดต้องมีความยาวไม่เกิน ${MAX_PROVINCE_LENGTH} ตัวอักษร`,
  );
});
