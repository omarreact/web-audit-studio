/** Planned cross-stack adapter contract. WordPress FSE is the first experimental adapter. */
export type SourceProvenance = 'public-capture' | 'authorized-repository' | 'inferred' | 'generated';
export type ConversionStatus = 'experimental' | 'review-required' | 'validated';
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
  };
  pages: SitePage[];
  conversion: {target: 'wordpress-fse'; editableCoreBlocks: string[]; fallback: string; requiresReview: string[]; guaranteedSourceParity: false};
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
