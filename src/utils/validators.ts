export const validateInput = (inputs: (string | number | string[])[]) => {
  return inputs.every((input) => {
    if (Array.isArray(input)) {
      return !!input.length;
    } else {
      return !!input;
    }
  });
};
