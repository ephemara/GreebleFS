/**
 * Generates a seamless texture or HDRI based on a text prompt.
 * Currently mocked to return a procedurally generated placeholder.
 *
 * @param prompt Description of the texture/skybox
 * @returns Promise resolving to a Data URL (base64 image)
 */
export declare function generateAITexture(prompt: string): Promise<string | null>;
