import { responseDefaults } from './server/endpoints/mock'
import { Expectation, ExpectationSettings, Scenario } from './types'
import ono from '@jsdevtools/ono'
import { deepInspect } from '~/helpers'
import columnify from 'columnify'
import endent from 'endent'
import got from 'got/dist/source'
import { merge } from 'lodash'
import { PartialDeep } from 'type-fest'

export type ClientSettings = {
  scope: string
  mode: Scenario['mode']
  server: {
    protocol: string
    host: string
    port: number
  }
}

export class Client {
  constructor(settings?: PartialDeep<ClientSettings>) {
    this.settings(settings ?? {})
  }
  private expectations: Scenario['expectations'] = []

  private _settings: ClientSettings = {
    server: {
      protocol: 'http',
      host: `localhost`,
      port: 9000,
    },
    scope: 'default',
    mode: {
      name: 'fixture',
    },
  }

  add(expectations: ExpectationSettings | ExpectationSettings[]) {
    if (!Array.isArray(expectations)) {
      expectations = [expectations]
    }

    expectations.forEach((e) =>
      this.expectations.push({
        match: {
          method: e.method ?? '*',
          path: e.path ?? '*',
        },
        response: e.response ?? {},
        hits: 0,
      })
    )
    return this
  }

  reset() {
    this.expectations = []
    return this
  }

  /**
   * Helpers
   */

  settings(settings: PartialDeep<ClientSettings>) {
    merge(this._settings, settings)
  }

  async start() {
    await this.setScenario()
    return this
  }

  async done() {
    const scenario = await this.getScenario()

    if (this._settings.mode.name === 'fixture') {
      const unusedExpectations = scenario.expectations.filter((expectation) => expectation.hits === 0)

      if (unusedExpectations.length > 0) {
        throw new Error(
          endent`
            Mockapie scenario is expected to be done but is not. Mockapie expected the following requests but they never came:

            ${renderExpectations(unusedExpectations)}
          `
        )
      }
    } else {
      if (scenario.expectations.length > 0) {
        throw new Error(
          endent`
            Mockapie scenario is expected to be done but is not. Mockapie expected the following requests but they never came:

            ${renderExpectations(scenario.expectations)}
          `
        )
      }
    }
  }

  /**
   * Internal API
   */

  private async setScenario() {
    await got
      .post(
        `${this._settings.server.protocol}://${this._settings.server.host}:${this._settings.server.port}/scenario/set`,
        {
          responseType: 'json',
          json: {
            scope: this._settings.scope,
            scenario: {
              expectations: this.expectations,
              mode: this._settings.mode,
            } as Scenario,
          },
        }
      )
      .catch((e) => {
        throw ono(e, `Failed to set api mock scenario`)
      })

    return this
  }

  private async getScenario() {
    const res = await got
      .post<Scenario>(
        `${this._settings.server.protocol}://${this._settings.server.host}:${this._settings.server.port}/scenario/get`,
        {
          responseType: 'json',
          json: {
            scope: this._settings.scope,
          },
        }
      )
      .catch((e) => {
        throw ono(e, `Failed to get api mock scenario`)
      })

    return res.body
  }
}

const renderExpectations = (x: Expectation[]) => {
  return columnify(
    x.map((_) => ({
      match: deepInspect(_.match),
      response: deepInspect({
        ..._.response,
        ...responseDefaults,
      }),
    })),
    {
      columnSplitter: '   ',
    }
  )
}
