# El paquete de diseño: de dónde sale y cómo se instala

`/diseno` orquesta skills de terceros. **No vienen copiadas en mi-claude**: se instalan desde su
repo original, así siempre están al día y con su licencia. Lo propio de este skill es el flujo
(`SKILL.md`), el catálogo de paletas (`paletas.md`) y el catálogo de marcas (`catalogo-marcas.md`).

Si al correr `/diseno` falta alguna, Claude la instala (es un comando por repo, sin cuenta):

| Para qué | Repo | Instalar |
|---|---|---|
| Motor de diseño de producto: `shape`, `critique`, `audit`, `polish`, detector… | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `npx skills add pbakaus/impeccable --skill impeccable -g -a claude-code -y` |
| Anti-slop para landings y portafolios | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `npx skills add Leonxlnx/taste-skill --skill design-taste-frontend -g -a claude-code -y` |
| Movimiento: `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary`, `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `npx skills add emilkowalski/skills --skill animate review-animations improve-animations find-animation-opportunities animation-vocabulary emil-design-eng -g -a claude-code -y` |
| `frontend-design`, `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill frontend-design web-design-guidelines -g -a claude-code -y` |
| 74 sistemas de diseño de marcas reales (DESIGN.md) | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | No se instala: se lee el `DESIGN.md` de la marca elegida desde GitHub (ver `catalogo-marcas.md`) |

Opcionales, si la persona los tiene o los pide: `ui-ux-pro-max`, `typography-scale`,
`critique-typography`, `playwright-skill`. Si un nombre de `--skill` no coincide, `npx skills add
<repo> --list` muestra los nombres exactos.

Regla de seguridad: un repo ajeno se lee antes de instalarlo. Estos se revisaron para el
paquete, pero si se agrega otro, primero se mira qué hace.
