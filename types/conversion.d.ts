/** Site profile and target contracts. HTML safe-static and WordPress FSE are experimental. */
export type SourceProvenance = 'public-capture' | 'authorized-repository' | 'inferred' | 'generated';
export type ConversionStatus = 'experimental' | 'review-required' | 'validated';
export type ConversionTarget = 'html-static' | 'wordpress-fse' | 'nextjs-static';
export interface StructuralCandidate {
  kind: 'header' | 'navigation' | 'footer' | 'hero' | 'card-group' | 'cta' | 'image-text' | 'form';
  suggestedName: string;
  confidence: 'low' | 'medium';
  repeatedAcrossPages: boolean;
  pagePaths: string[];
  occurrences: number;
  evidence: string[];
}
export interface ObservedToken { value: string; sourcePath: string; provenance: 'captured-css' }
export interface StructureReport {
  schemaVersion: 1;
  method: 'bounded-structural-heuristics';
  components: StructuralCandidate[];
  tokens: Record<'fontFamilies' | 'fontSizes' | 'spacing' | 'colors' | 'containerWidths' | 'breakpoints', ObservedToken[]>;
  unknown: string[];
  limitations: string;
}
export interface SitePage {
  path: string;
  url: string | null;
  title: string;
  headings: Array<{level: number; text: string}>;
  forms: Array<{method: string; fields: number; needsBackend: boolean}>;
  hasScripts: boolean;
  source: SourceProvenance;
}
export interface SiteProfile {
  schemaVersion: 1;
  engineVersion: string;
  mode: 'local-rules';
  source: {origin: string; stack: string; stackConfidence: number; evidence: Array<{stack: string; why: string}>};
  site: {
    pageCount: number;
    assetCount: number;
    components: {headings: number; images: number; forms: number; buttons: number};
    design: {colors: string[]; fontFamilies: string[]};
    intelligence?: StructureReport;
  };
  pages: SitePage[];
  conversion: {target: ConversionTarget; editableCoreBlocks: string[]; fallback: string; requiresReview: string[]; guaranteedSourceParity: false};
}
export interface ConversionArtifact {
  path: string;
  source: Uint8Array;
  provenance: SourceProvenance;
}
export interface TargetStackAdapter {
  id: string;
  version: string;
  status: ConversionStatus;
  convert(profile: SiteProfile, files: ConversionArtifact[]): Promise<ConversionArtifact[]>;
  validate?(files: ConversionArtifact[]): Promise<{passed: boolean; warnings: string[]}>;
}

export interface HTMLConversionAudit {
  path: string;
  title: string;
  headingCount: number;
  removed: {scripts: number; embeds: number; executableAttributes: number; unsafeUrls: number; disabledForms: number; disabledButtons: number};
  warnings: string[];
  externalReferences: string[];
  originalPrivateSourceRecovered: false;
}
export interface HTMLConversionReport {
  schemaVersion: 1;
  adapter: 'html-static';
  adapterVersion: string;
  strategy: 'safe-static';
  target: {stack: 'HTML/CSS'; runtime: 'browser'; buildStepRequired: false};
  pages: HTMLConversionAudit[];
  warnings: string[];
  aiExecution: string;
}
