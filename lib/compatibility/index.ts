export {
  applySelectionRules,
  getCompatibleComponents,
  getCompatibleFabrics,
} from "./engine";
export type {
  DesignPhase,
  ComponentWithType,
  CompatibleComponentsResult,
  FabricCategoryWithSkins,
} from "./engine";

export {
  parseObjBoundaryLoops,
  classifyLoops,
  normalizeLoop,
  computeSimilarity,
  classifySleeveStyle,
} from "./mesh-analysis";
export type {
  Vec3,
  BoundaryLoop,
  LoopRole,
  ClassifiedLoop,
  SleeveStyle,
  ComponentRole,
} from "./mesh-analysis";
