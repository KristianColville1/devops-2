import type { FastifyInstance } from 'fastify'
import { JSON_API_V1_PREFIX } from '@/core/http/jsonApiV1Prefix.js'
import { joinRoutePaths } from '@/core/http/routing/joinRoutePaths.js'
import {
  getControllerBase,
  getControllerRegistry,
  getRouteDefs,
} from '@/core/http/routing/decorators.js'

export async function registerDecoratedControllers(app: FastifyInstance) {
  const root = JSON_API_V1_PREFIX
  for (const ControllerClass of getControllerRegistry()) {
    const base = getControllerBase(ControllerClass)
    const routes = getRouteDefs(ControllerClass)
    const instance = new ControllerClass()
    for (const route of routes) {
      const segment = route.path.replace(/^\/+|\/+$/g, '')
      const url = joinRoutePaths(root, base, segment)
      const fn = (instance as Record<string | symbol, unknown>)[route.propertyKey]
      if (typeof fn !== 'function') continue
      app.route({
        method: route.method,
        url,
        schema: route.schema,
        handler: fn.bind(instance),
      })
    }
  }
}
