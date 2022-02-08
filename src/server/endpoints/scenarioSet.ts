import { Scenario } from '../../types'
import { State } from '../server'
import { Express } from 'express'
import { log } from 'floggy'

export const scenarioSetEndpoint = (app: Express, state: State) => {
  app.post(`/scenario/set`, (req, res) => {
    log.trace('set_scenario', req.body)
    state.scenarios[req.body.scope] = req.body.scenario as Scenario
    res.send()
  })
}
