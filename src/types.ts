import { LiteralUnion } from 'type-fest'

export type ExpectationMatchSuccess = {
  specificity: number
  matches: true
}

export type ExpectationMatchFailure = {
  matches: false
}

export type ExpectationMatchResult = ExpectationMatchFailure | ExpectationMatchSuccess

export const HttpMethod = {
  get: 'get',
  post: 'post',
  put: 'put',
  delete: 'delete',
  patch: 'patch',
  options: 'options',
  head: 'head',
  trace: 'trace',
} as const

export const HttpMethods = Object.values(HttpMethod)

export type HttpMethod = keyof typeof HttpMethod

export const isHttpMethod = (value: string): value is HttpMethod => Boolean(HttpMethods.find((_) => _ === value))

export const HTTPStatusCode = {
  200: 200,
  401: 401,
  403: 403,
  404: 404,
  400: 400,
  500: 500,
} as const

export const HTTPStatusCodes = Object.values(HTTPStatusCode)

export type HTTPStatusCode = keyof typeof HTTPStatusCode

export type Expectation = {
  /**
   * Criteria a request must match for the mock response to be sent.
   */
  match: {
    /**
     * Expect an HTTP method.
     *
     * The wildcard `"*"` is special and will match any method.
     */
    method: '*' | HttpMethod
    /**
     * Expect a path following the URL host/port.
     *
     * The wildcard `"*"` is special and will match any path (including the lack of one).
     */
    path: LiteralUnion<'*', string>
  }
  /**
   * The mock response to send.
   */
  response: {
    status?: HTTPStatusCode
    /**
     * The body of the response. Assumed to be some kind of JSON object.
     */
    body?: object
  }
  // TODO this should be hidden as state inside the server
  /**
   * How many times has this expectation been used?
   */
  hits: number
}

export type ExpectationSettings = {
  method?: '*' | HttpMethod
  path?: LiteralUnion<'*', string>
  response?: {
    status?: HTTPStatusCode
    body?: object
  }
}

export type Scenario = {
  expectations: Expectation[]
  /**
   * The mode to execute the scenario in.
   */
  mode:
    | {
        /**
         * This mode treats the expectations like fixtures. Requests can match expectations in any order and one or many times.
         *
         * In this mode, any expectation that was not called at least once is considered a test error.
         */
        name: 'fixture'
      }
    | {
        /**
         * This mode is semi-strict. Requests must match the exact number of expectations specified but order does not matter.
         */
        name: 'pool'
      }
    | {
        /**
         * This mode is strict. Requests must match the exact order and number of expectations specified.
         */
        name: 'stack'
      }
}
