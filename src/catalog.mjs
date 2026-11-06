// Explicit UI list of the four authorized White Walker levels.
// Additions must be listed here deliberately; model IDs are never inferred from suffixes.
export const LEVEL_DEFINITIONS = Object.freeze([
  Object.freeze({ modelId: 'white-walker-1', level: '1', label: '1 — sam (1 sezon)' }),
  Object.freeze({ modelId: 'white-walker-2', level: '2', label: '2 — z plecakiem (3 sezony)' }),
  Object.freeze({ modelId: 'white-walker-3', level: '3', label: '3 — z ZÜCA (5 sezonów)' }),
  Object.freeze({ modelId: 'white-walker-4', level: '4', label: '4 — z ZÜCA i retrieverem (7 sezonów)' }),
]);

export function createUiCatalog(models) {
  const modelById = new Map(models.map((model) => [model.id, model]));
  const levels = LEVEL_DEFINITIONS.map((entry) => {
    const model = modelById.get(entry.modelId);
    if (!model) throw new Error(`Brak jawnej pozycji interfejsu w manifeście: ${entry.modelId}.`);
    return { ...entry, model };
  });
  const configured = new Set(LEVEL_DEFINITIONS.map((entry) => entry.modelId));
  const unconfigured = models.filter((model) => !configured.has(model.id));
  if (unconfigured.length) throw new Error(`Brak jawnego poziomu w interfejsie: ${unconfigured.map((model) => model.id).join(', ')}.`);
  return { levels, modelById };
}

export function levelForModelId(catalog, modelId) {
  return catalog.levels.find((entry) => entry.modelId === modelId)?.level ?? null;
}

export function modelForLevel(catalog, level) {
  return catalog.levels.find((entry) => entry.level === level)?.model ?? null;
}

export function modelIdFromSearch(search, activeModel, knownIds) {
  const requested = new URLSearchParams(search).get('model');
  if (!requested) return { modelId: activeModel, missingId: null };
  return knownIds.has(requested) ? { modelId: requested, missingId: null } : { modelId: null, missingId: requested };
}
