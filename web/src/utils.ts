export const parseMoney = (val?: string): number => {
  if (!val || typeof val !== 'string') return NaN as unknown as number;
  // Clean the string of currency symbols, commas, etc.
  let cleanStr = val.toLowerCase().replace(/[$,]/g, '');
  if (cleanStr === '' || /^(none|n\/a|na|unknown|unk)$/i.test(cleanStr)) {
    return NaN as unknown as number;
  }

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
  
  return isNaN(num) ? (NaN as unknown as number) : num * multiplier;
}
