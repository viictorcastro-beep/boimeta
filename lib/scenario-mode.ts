export type ScenarioMode = 'validation' | 'exploration';

export type ScenarioPriceProvenance =
  | 'working-assumption'
  | 'local-spreadsheet'
  | 'conab-official'
  | 'manual-override'
  | 'scenario-shock'
  | 'future-scenario'
  | 'demo-snapshot';

export function provenanceCanRank(
  provenance: ScenarioPriceProvenance,
  mode: ScenarioMode,
) {
  if (provenance === 'working-assumption') return false;
  if (provenance === 'demo-snapshot') return mode === 'exploration';
  return true;
}
