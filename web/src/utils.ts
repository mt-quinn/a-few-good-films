export const parseMoney = (val?: string): number => {
  if (!val || typeof val !== 'string') return 0;
  // Clean the string of currency symbols, commas, etc.
  let cleanStr = val.toLowerCase().replace(/[$,]/g, '');

  let multiplier = 1;
  if (cleanStr.endsWith('k')) {
    multiplier = 1000;
    cleanStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('m')) {
    multiplier = 1000000;
    cleanStr = cleanStr.slice(0, -1);
  } else if (cleanStr.endsWith('b')) {
    multiplier = 1000000000;
    cleanStr = cleanStr.slice(0, -1);
  }

  const num = parseFloat(cleanStr);
  
  return isNaN(num) ? 0 : num * multiplier;
}
