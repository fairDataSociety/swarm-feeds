export const getCurrentTime = (d = new Date()) => d.getTime()

/**
 * Calculates nearest index
 * @param initialTime initial time of streaming feed
 * @param updatePeriod streaming feed frequency in milliseconds
 * @param lookupTime lookup time
 * @returns Returns -1 if not found, otherwise the index
 */
export const getIndexForArbitraryTime = (lookupTime: number, initialTime: number, updatePeriod: number): number => {
  const currentTime = getCurrentTime() // Tp

  //  the nearest last index to an arbitrary time (Tx) where T0 <= Tx <= Tn <= Tp
  if (currentTime >= initialTime && lookupTime >= initialTime) {
    return Math.floor((lookupTime - initialTime) / updatePeriod)
  }

  return -1
}
