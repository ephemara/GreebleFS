export interface SketchfabModel {
    uid: string;
    name: string;
    description: string;
    thumbnails: {
        images: {
            url: string;
            width: number;
            height: number;
        }[];
    };
    user: {
        username: string;
        displayName: string;
    };
    viewerUrl: string;
}
export interface SketchfabSearchResult {
    models: SketchfabModel[];
    totalCount: number;
    nextCursor: string | null;
    prevCursor: string | null;
}
export interface SearchOptions {
    token?: string;
    count?: number;
    cursor?: string;
    randomize?: boolean;
}
export declare const searchSketchfab: (query: string, options?: SearchOptions) => Promise<SketchfabSearchResult>;
/**
 * Note: Downloading from Sketchfab via API usually requires OAuth token.
 * For this integration, we will try to get the download URL.
 * If authentication is needed, we might need a prompt or a token.
 */
export declare const getSketchfabDownloadUrl: (uid: string, token?: string) => Promise<string | null>;
