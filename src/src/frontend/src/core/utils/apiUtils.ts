// API utilities

export const getApiKey = (): string | undefined => {
    return process.env.API_KEY;
};

export const checkApiKey = async (): Promise<boolean> => {
    const win = window as any;
    if (win.aistudio && win.aistudio.hasSelectedApiKey) {
        return await win.aistudio.hasSelectedApiKey();
    }
    return false;
};

export const connectApi = async (): Promise<void> => {
    const win = window as any;
    if (win.aistudio && win.aistudio.openSelectKey) {
        await win.aistudio.openSelectKey();
    }
};
