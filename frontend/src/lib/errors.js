/** The server's message when it sent one (they are written for people), else the fallback. */
export const errorText = (err, fallback) => err?.response?.data?.message || fallback;
