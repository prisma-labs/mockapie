import { serverLog } from '../logger'
import { Scenario } from '../types'
import { mockEndpoints } from './endpoints/mock'
import { scenarioGetEndpoint } from './endpoints/scenarioGet'
import { scenarioSetEndpoint } from './endpoints/scenarioSet'
import { json } from 'body-parser'
import express, { Express } from 'express'
import { createServer, Server } from 'http'

export type ServerSettings = {
  /**
   * The port to run the Mockapie server on.
   *
   * @defaultValue 9000
   */
  port?: number
}

export type Config = Required<ServerSettings>

export type State = {
  scenarios: Record<string, Scenario>
}

export class MockapieServer {
  config: Config

  constructor(settings?: ServerSettings) {
    this.config = {
      port: 9000,
      ...settings,
    }

    const state: State = {
      scenarios: {},
    }

    /**
     * Setup Express app
     */

    const app = express()

    // @ts-expect-error TODO
    app.use(json({ limit: '200mb' }))

    /**
     * Scenario API
     */

    scenarioSetEndpoint(app, state)
    scenarioGetEndpoint(app, state)

    /**
     * Mock API, whatever the scenarios allow!
     */

    mockEndpoints(app, state)

    app.use((error: any, _req: any, res: any, _next: any) => {
      serverLog.error('uncaught_error', {
        error,
      })
      res.status(500).send({})
    })

    this.app = app
    this.server = createServer(this.app)
  }

  private server: Server

  private app: Express

  start() {
    return new Promise((res) => {
      this.server.listen(this.config.port, () => {
        serverLog.info('server_started', {
          config: this.config,
        })
        res({
          port: this.config.port,
        })
      })
    })
  }

  stop() {
    return new Promise((res, rej) => {
      this.server.close((err) => {
        if (err) return rej(err)
        return res(null)
      })
    })
  }
}
