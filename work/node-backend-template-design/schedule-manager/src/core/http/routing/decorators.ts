import 'reflect-metadata'
import type { FastifySchema } from 'fastify'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type Constructor<T = object> = new (...args: unknown[]) => T

const META_BASE = Symbol('ccl:controllerBase')
const META_ROUTES = Symbol('ccl:routes')

type RouteDef = {
  method: HttpMethod
  path: string
  propertyKey: string | symbol
  schema?: FastifySchema
}

const registry = new Set<Constructor>()

function pushRoute(target: object, def: RouteDef) {
  const list: RouteDef[] = Reflect.getOwnMetadata(META_ROUTES, target) ?? []
  list.push(def)
  Reflect.defineMetadata(META_ROUTES, list, target)
}

function methodDecorator(method: HttpMethod, path: string, schema?: FastifySchema) {
  return (target: object, propertyKey: string | symbol, _desc: PropertyDescriptor) => {
    pushRoute(target, { method, path, propertyKey, schema })
  }
}

/** Path segment after `/api/v1` (e.g. `admin` → `/api/v1/admin/...`). */
export function Controller(basePath: string) {
  return <T extends Constructor>(ctor: T) => {
    const normalized = basePath.replace(/^\/+|\/+$/g, '')
    Reflect.defineMetadata(META_BASE, normalized, ctor)
    registry.add(ctor)
    return ctor
  }
}

export function Get(path: string, schema?: FastifySchema) {
  return methodDecorator('GET', path, schema)
}

export function Post(path: string, schema?: FastifySchema) {
  return methodDecorator('POST', path, schema)
}

export function Put(path: string, schema?: FastifySchema) {
  return methodDecorator('PUT', path, schema)
}

export function Patch(path: string, schema?: FastifySchema) {
  return methodDecorator('PATCH', path, schema)
}

export function Delete(path: string, schema?: FastifySchema) {
  return methodDecorator('DELETE', path, schema)
}

export function getControllerRegistry(): Constructor[] {
  return [...registry]
}

export function getControllerBase(ctor: Constructor): string {
  return Reflect.getMetadata(META_BASE, ctor) ?? ''
}

export function getRouteDefs(ctor: Constructor): RouteDef[] {
  return Reflect.getOwnMetadata(META_ROUTES, ctor.prototype) ?? []
}
