import * as Util from 'util'

/**
 * TypeScript helper to statically enforce that all cases have been handled in a switch (or similar) block.
 */
export const casesHandled = (x: never): never => {
  // Should never happen, but in case it does :)
  throw new Error(`All cases were not handled:\n${Util.inspect(x)}`)
}

export const deepInspect = (x: unknown) => Util.inspect(x, { depth: 20 })
