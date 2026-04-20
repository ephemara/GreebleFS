
export const loadScript = (src: string) => {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    document.body.appendChild(s);
  });
};

export async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && retries > 0 && response.status !== 400) throw new Error(response.statusText);
    return response;
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(res => setTimeout(res, 1000));
    return fetchWithRetry(url, options, retries - 1);
  }
}

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};