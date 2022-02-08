import { Scenario } from '../types'
import { inspect } from 'util'

export const lookupScenario = ({
  index,
  scope,
}: {
  index: Record<string, Scenario>
  scope: string
}): Error | Scenario => {
  const value = index[scope]

  if (value === undefined) {
    return new Error(
      `The given scope "${scope}" does not exist. Maybe a typo or did you incorrectly setup your request mocks? Here is what the scenarios index looks like:\n\n${inspect(
        index,
        { depth: 10 }
      )}`
    )
  }

  return value
}
