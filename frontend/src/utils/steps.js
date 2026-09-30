/** Index of the first step whose errorsFor(i) has any key, or -1. */
export const firstInvalid = (count, errorsFor) => {
  for (let i = 0; i < count; i += 1) if (Object.keys(errorsFor(i)).length) return i;
  return -1;
};
