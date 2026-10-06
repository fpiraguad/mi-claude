---
name: arquitectura
description: Auditoría y mejora integral de la arquitectura de un proyecto — módulos, funciones y tablas — orquestando en un solo flujo las skills improve-codebase-architecture (con codebase-design, grilling y domain-modeling), clean-code y las oficiales de Supabase (supabase, supabase-postgres-best-practices) cuando están instaladas. Usar cuando la persona diga /arquitectura, "mejora la arquitectura", "audita el proyecto", "limpia el código", "simplifica esto", "revisa las tablas" o pida hacer un proyecto más simple, limpio o minimalista.
---

# Arquitectura — auditoría y mejora integral

Un solo comando que revisa las tres capas de un proyecto y entrega un plan de mejora priorizado.
**Primero se audita y se presenta; no se refactoriza nada hasta que la persona elija qué atacar.**

Las skills que orquesta se usan si están instaladas; si falta alguna, se aplica su criterio con lo
que dice este archivo y se nombra en el reporte cuál faltó.

## Paso 0 — Ubicar el contexto

1. Determinar el proyecto: la carpeta que la persona nombre, o el proyecto en el que se está
   trabajando. Leer su `CLAUDE.md` y su `README`.
2. Leer también el `CONTEXT.md` y los `docs/adr/` del proyecto si existen: **una decisión con ADR no
   se re-propone**, salvo que la fricción sea real — y entonces se dice explícitamente que
   contradice tal ADR y por qué vale reabrirlo.
3. Si el proyecto usa Supabase, detectar el modo de la base: local (variables que apuntan a
   `localhost`/`127.0.0.1`, o `SUPABASE_MODE=local`) o nube.
4. Si la persona señaló un área concreta («el módulo de pagos», «la parte de WhatsApp»), acotar todo
   el flujo a esa área.

## Principio rector: lo más pequeño que funcione

Antes de proponer una tabla, una función, un archivo, un paquete o un servicio, la pregunta no es
«¿dónde lo pongo?» sino **«¿hace falta que exista?»**. Una columna existe si se filtra, se ordena, se
indexa o es clave foránea; lo demás puede ir en un JSONB `datos`. Un módulo profundo (interfaz chica,
mucho comportamiento detrás) vale más que muchos módulos delgados.

## Paso 1 — Módulos y estructura

Invocar la skill `improve-codebase-architecture` (usa por debajo `codebase-design`, `grilling` y
`domain-modeling`). Genera el reporte de oportunidades de mejora con diagramas antes/después.

El reporte se le **muestra** a la persona (como página o artifact), no basta con dejarlo en una
carpeta temporal y decir la ruta: no tiene por qué usar la terminal.

## Paso 2 — Funciones y legibilidad

Sobre los archivos que el paso 1 señaló como problemáticos (o el área acotada), aplicar los
criterios de la skill `clean-code`: funciones largas, nombres confusos, responsabilidades mezcladas,
manejo de errores sucio. Máximo 5-8 hallazgos concretos, cada uno con archivo:línea y qué se ganaría.

## Paso 3 — Tablas y base de datos

Solo si el proyecto usa una base de datos (las indicaciones de abajo son para Supabase/Postgres):

- **Nube**: con el MCP de Supabase (si está conectado), correr `list_tables` y `get_advisors`
  (security y performance). Los hallazgos del advisor van tal cual al reporte.
- **Local o sin MCP**: revisar la carpeta de migraciones contra la skill
  `supabase-postgres-best-practices` (índices faltantes, RLS, tipos, nombres).
- En ambos casos, la skill `supabase` da el criterio general de RLS y auth.
- Lo que más aparece: clave foránea sin índice, columna de política RLS sin índice, `auth.uid()` sin
  envolver en `(select …)`, vistas sin `security_invoker`, y `security definer` sin chequeo de
  `auth.uid()` dentro.

## Paso 4 — Entregar y decidir

Cerrar con un resumen en español, sin jerga, ordenado por impacto:

1. **Top 3 mejoras** con qué se gana en cada una (más simple de mantener, más rápido, más seguro).
2. Qué es cosmético y puede esperar.
3. Preguntar cuál atacar (AskUserQuestion con las candidatas).

Cuando la persona elija una, seguir el flujo de `grilling` para acordar el refactor, ejecutarlo,
verificarlo (tests y, si tiene pantalla, en el preview) y hacer checkpoint con `git commit`.

## Reglas

- **Nunca refactorizar en la misma pasada que se audita.** Reporte primero, cambios después de que
  la persona elija.
- Respetar las decisiones ya registradas (ADRs / `CONTEXT.md` del proyecto) — no re-proponer lo ya
  descartado.
- **Cambios de esquema en Supabase: en NUBE van por `apply_migration`; en LOCAL, por `execute_sql`
  (o `supabase db query`) y después se recoge el resultado en un archivo de migración.** No es lo
  mismo: `apply_migration` contra una base local escribe historial en cada llamada, y a las dos
  iteraciones `db diff` y `db pull` quedan inservibles.
- **Nunca editar una migración ya aplicada en un proyecto vivo** — se encadena otra. Si no, el
  esquema de la base y los archivos dejan de corresponderse y nadie se entera hasta el siguiente
  `reset`.
- No proponer migrar el proyecto a otro framework o plantilla salvo que la persona lo pida.
