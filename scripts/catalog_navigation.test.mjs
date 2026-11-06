import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createUiCatalog,
  levelForModelId,
  modelForLevel,
  modelIdFromSearch,
} from '../src/catalog.mjs';
import {
  PORTRAIT_FIT_MARGIN_ASPECT,
  distanceLimitsForFit,
  fitDistanceForAspect,
} from '../src/cameraFraming.mjs';

const models = [
  { id: 'white-walker-1' },
  { id: 'white-walker-2' },
  { id: 'white-walker-3' },
  { id: 'white-walker-4' },
];
const catalog = createUiCatalog(models);

test('explicit metadata lists exactly the four White Walker levels in order', () => {
  assert.deepEqual(catalog.levels.map((entry) => entry.level), ['1', '2', '3', '4']);
  assert.equal(modelForLevel(catalog, '4').id, 'white-walker-4');
  assert.equal(levelForModelId(catalog, 'white-walker-2'), '2');
  assert.match(catalog.levels[0].label, /1 sezon\)$/);
  assert.match(catalog.levels[3].label, /7 sezonów\)$/);
});

test('unknown and unconfigured IDs fail closed', () => {
  assert.equal(modelForLevel(catalog, '9'), null);
  assert.equal(levelForModelId(catalog, 'not-listed'), null);
  assert.throws(() => createUiCatalog([...models, { id: 'future-unmapped-model' }]), /Brak jawnego poziomu/);
  assert.throws(() => createUiCatalog(models.slice(1)), /Brak jawnej pozycji/);
});

test('model query and root active model navigation are exact', () => {
  const known = new Set(models.map((model) => model.id));
  assert.deepEqual(modelIdFromSearch('?model=white-walker-3', 'white-walker-4', known), { modelId: 'white-walker-3', missingId: null });
  assert.deepEqual(modelIdFromSearch('', 'white-walker-4', known), { modelId: 'white-walker-4', missingId: null });
  assert.deepEqual(modelIdFromSearch('?model=white-walker-33', 'white-walker-4', known), { modelId: null, missingId: 'white-walker-33' });
});

test('portrait full-scene framing scales distance and clamps while preserving desktop and Harabin baselines', () => {
  assert.equal(PORTRAIT_FIT_MARGIN_ASPECT, 1.08);
  assert.equal(fitDistanceForAspect(3, true, 16 / 9), 3);
  assert.equal(fitDistanceForAspect(2.4, false, 0.626), 2.4);
  const portraitFit = fitDistanceForAspect(3, true, 0.626);
  assert.ok(Math.abs(portraitFit - 5.17571884984) < 1e-9);
  const limits = distanceLimitsForFit(portraitFit, true, 1.15, 6, 3);
  assert.ok(Math.abs(limits.minimum / portraitFit - 1.15 / 3) < 1e-12);
  assert.ok(Math.abs(limits.maximum / portraitFit - 2) < 1e-12);
});
