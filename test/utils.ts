import { BatchId } from '@ethersphere/bee-js'

/**
 * Returns a url for testing the Bee public API
 */
export function beeUrl(): string {
  return process.env.BEE_API_URL || 'http://localhost:1633'
}

/**
 * Returns a url for testing the Bee Debug API
 */
export function beeDebugUrl(): string {
  return process.env.BEE_DEBUG_API_URL || 'http://localhost:1635'
}

/**
 * Returns a url for testing the Bee Debug API
 */
export function beePeerDebugUrl(): string {
  return process.env.BEE_PEER_DEBUG_API_URL || 'http://localhost:11635'
}

/**
 * Helper function that create monster batch for all the tests.
 * There is semaphore mechanism that allows only creation of one batch across all the
 * parallel running tests that have to wait until it is created.
 */
export function getPostageBatch(url = beeDebugUrl()): BatchId {
  let stamp: BatchId

  switch (url) {
    case beeDebugUrl():
      stamp = process.env.BEE_POSTAGE as BatchId
      break
    case beePeerDebugUrl():
      stamp = process.env.BEE_PEER_POSTAGE as BatchId
      break
    default:
      throw new Error('Unknown URL ' + url)
  }

  if (!stamp) {
    throw new Error('There is no postage stamp configured for URL ' + url)
  }

  return stamp
}
