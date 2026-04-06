export const getRemainingTTL = (exp: number) =>
  (exp - Math.floor(Date.now() / 1000)) * 1000;
