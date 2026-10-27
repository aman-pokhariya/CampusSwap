// Escapes characters that mean something in a regex, so a search for "c++ (book)" is matched
// literally instead of breaking the query (or being used to craft a slow regex).
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
