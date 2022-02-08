import { Expectation, State } from '../../index_'
import { ExpectationMatchResult, ExpectationMatchSuccess, Scenario } from '../../types'
import { lookupScenario } from '../helpers'
import ono from '@jsdevtools/ono'
import { casesHandled } from '~/helpers'
import { Express } from 'express'
import { log } from 'floggy'
import { IncomingHttpHeaders } from 'http'
import { isError } from 'lodash'
import { pathToRegexp } from 'path-to-regexp'
import { inspect } from 'util'

export const mockapieScopeHeader = `x-test-mock-api-scope`

export type MatchableRequest = {
  method: string
  path: string
  headers: IncomingHttpHeaders
  query: any // TODO
  body: any
}

export const mockEndpoints = (app: Express, state: State) => {
  app.all('*', (req, res) => {
    /**
     * Scope determines which set of scenarios this request is going to work with.
     *
     * Scope can be passed by header, or request path.
     */
    const scope =
      // Look in the headers
      req.headers[mockapieScopeHeader]
        ? (req.headers[mockapieScopeHeader] as string)
        : // Look in the path
        req.path.startsWith('/scope-')
        ? req.path.match(/\/scope-([^/]+)/)![1]!
        : // Default
          'default'

    const path = req.path.startsWith('/scope-') ? req.path.replace(/\/scope-[^/]*/, '') : req.path

    const matchableReq: MatchableRequest = {
      method: req.method,
      path,
      headers: req.headers,
      query: req.query,
      body: req.body,
    }

    log.trace('request', {
      scope,
      ...truncateBody(matchableReq),
    })

    const scenario = lookupScenario({
      index: state.scenarios,
      scope,
    })

    if (isError(scenario)) {
      throw ono(scenario, `Failed to get scenario. The matchable request was:\n\n${inspect(matchableReq)}`)
    }

    if (scenario.expectations.length === 0) {
      res.status(500)
      log.error(`empty_scenario`, {
        got: truncateBody(matchableReq),
      })
      res.send({
        code: `empty_scenario`,
      })
      return
    }

    let expectation: Expectation

    if (scenario.mode.name === 'stack') {
      expectation = scenario.expectations.shift()!

      if (!match(matchableReq, expectation).matches) {
        res.status(500)
        log.error(`no_match_next_expected_step`, {
          got: matchableReq,
          expected: expectation,
        })
        res.send({
          code: `no_match_next_expected_step`,
          got: truncateBody(matchableReq),
          expected: expectation,
        })
        return
      }
    } else if (scenario.mode.name === 'pool') {
      const stepIndex = scenario.expectations.findIndex((step) => match(matchableReq, step).matches)

      if (stepIndex === -1) {
        res.status(500)
        log.error(`no_match_any_remaining_step`, {
          got: matchableReq,
          remainingSteps: scenario.expectations,
        })
        res.send({
          code: `no_match_any_remaining_step`,
          got: truncateBody(matchableReq),
          remainingSteps: scenario.expectations,
        })
        return
      }

      expectation = scenario.expectations.splice(stepIndex, 1)[0]!
    } else if (scenario.mode.name === 'fixture') {
      const expectationFound = fixtureMatch(scenario, matchableReq)

      if (!expectationFound) {
        res.status(500)
        log.error(`no_match_any_step`, {
          got: truncateBody(matchableReq),
          steps: scenario.expectations,
        })
        res.send({
          code: `no_match_any_step`,
          got: truncateBody(matchableReq),
          steps: scenario.expectations,
        })
        return
      }

      expectation = expectationFound
    } else {
      casesHandled(scenario.mode)
      return // TODO why is TS requiring this?
    }

    log.trace('expectation_hit', {
      got: truncateBody(matchableReq),
      response: expectation.response,
    })

    res.status(expectation.response.status ?? responseDefaults.status)
    res.send(expectation.response.body)
  })
}

export const responseDefaults = {
  status: 200,
}

const fixtureMatch = (scenario: Scenario, requestInfo: any): null | Expectation => {
  const expectationMatches = scenario.expectations
    .map((expectation) => [expectation, match(requestInfo, expectation)] as const)
    .filter((res): res is [Expectation, ExpectationMatchSuccess] => {
      return res[1].matches
    })

  const expectationFound: null | Expectation =
    expectationMatches
      .sort(([_, match1], [__, match2]) => {
        return match1.specificity > match2.specificity ? -1 : 1
      })
      .map(([expectation]) => expectation)[0] ?? null

  if (expectationFound) {
    expectationFound.hits += 1
  }
  return expectationFound
}

/**
 * Truncate request info body. This is useful for very large bodies which would otherwise clog up the terminal when
 * logged.
 *
 * @remarks In The case of GitHub actions a large log output will actually cause CI to hang based on [our
 *          experiences](https://prisma-company.slack.com/archives/G01R4M0GCRJ/p1623687533012400).
 */
function truncateBody(info: MatchableRequest): MatchableRequest {
  const size = getBodySize(info)

  if (size && size > 100_000) {
    return {
      ...info,
      body: `Too big to log. Had string length of: ${size}`,
    }
  }

  return info
}

/**
 * Get the size of an HTTP body. If cannot be determined due to JSON stringify error then returns null.
 */
function getBodySize(body: any): null | number {
  if (typeof body === 'string') return body.length

  try {
    return JSON.stringify(body).length
  } catch (_error) {
    return null
  }
}

/**
 * Match request to expectation.
 *
 * @param req          - The actual request.
 * @param expectation  - An expected request to match.
 */
function match(req: MatchableRequest, expectation: Expectation): ExpectationMatchResult {
  /**
   * Request can match on multiple criteria. The more criteria that matches, the higher the specificity.
   */
  let specificity = 0

  if (expectation.match.method !== '*') {
    if (expectation.match.method.toLowerCase() !== req.method.toLowerCase()) return { matches: false }
    specificity += 1
  }

  if (expectation.match.path !== '*') {
    if (!pathToRegexp(expectation.match.path).exec(req.path)) return { matches: false }
    // Each route param detracts from the match strength
    const routeParamCount = expectation.match.path.split('/').filter((seg) => seg.startsWith(':')).length
    specificity -= routeParamCount
  }

  return {
    matches: true,
    specificity,
  }
}
