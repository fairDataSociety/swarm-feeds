import { BeeDebug } from "@ethersphere/bee-js"

export default async function testsSetup(): Promise<void> {
  if (!process.env.BEE_POSTAGE) {
    try {
      console.log('Creating postage stamps...')
      const beeDebugUrl = process.env.BEE_DEBUG_API_URL || 'http://localhost:1635'
      const bee = new BeeDebug(beeDebugUrl)
      process.env.BEE_POSTAGE = await bee.createPostageBatch('1', 20)
      console.log('Queen stamp: ', process.env.BEE_POSTAGE)
      // sleep for 11 seconds (10 blocks with ganache block time = 1s)
      // needed for postage batches to become usable
      // FIXME: sleep should be imported for this, but then we fail with
      //        Could not find a declaration file for module 'tar-js'
      await new Promise<void>(resolve => setTimeout(() => resolve(), 11_000))
    } catch (e) {
      // It is possible that for unit tests the Bee nodes does not run
      // so we are only logging errors and not leaving them to propagate
      console.error(e)
    }
  }
}
