// Newest-first cursor pagination: `before` (a date) asks for rows older than the last page.
// A page never ends in the middle of rows that share one timestamp (two messages saved in the
// same millisecond), so passing the oldest row's date as the next `before` can't skip anything.
// Returns plain objects (lean).
export const findPageBefore = async (Model, filter, { field, before, limit }) => {
    const rows = await Model.find({ ...filter, ...(before && { [field]: { $lt: before } }) })
        .sort({ [field]: -1, _id: -1 })
        .limit(limit + 1)
        .lean();

    if (rows.length <= limit) return { rows, hasMore: false };

    const last = rows[limit - 1];
    if (rows[limit][field].getTime() !== last[field].getTime()) return { rows: rows.slice(0, limit), hasMore: true };

    // The next row has the same timestamp: take every remaining row with it into this page.
    const ties = await Model.find({ ...filter, [field]: last[field], _id: { $lt: last._id } }).sort({ _id: -1 }).lean();
    const hasMore = Boolean(await Model.exists({ ...filter, [field]: { $lt: last[field] } }));
    return { rows: [...rows.slice(0, limit), ...ties], hasMore };
};
