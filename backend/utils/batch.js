// Runs `task` for every item, `size` at a time, and returns the results in order. For fan-outs where each
// item is independent (one chat per pending offer): side by side, a batch takes about as long as one item,
// while the batches keep a popular listing from flooding the database connection pool.
export const inBatches = async (items, task, size = 20) => {
    const results = [];
    for (let i = 0; i < items.length; i += size) {
        results.push(...(await Promise.all(items.slice(i, i + size).map(task))));
    }
    return results;
};
