import { lookupScenario } from '../helpers'
import { State } from '../server'
import { Express } from 'express'
import { log } from 'floggy'
import { isError } from 'lodash'

export const scenarioGetEndpoint = (app: Express, state: State) => {
  app.post(`/scenario/get`, (req, res) => {
    log.trace('get_scenario', req.body)
    const scenario = lookupScenario({
      index: state.scenarios,
      scope: req.body.scope,
    })
    if (isError(scenario)) {
      throw scenario
    }
    res.send(scenario)
  })
}
