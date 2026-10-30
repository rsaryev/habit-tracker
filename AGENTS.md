# Working on Habit Tracker

This folder is the mini app's source; nothing here is installed with a package manager.
`mini-app check` runs every check, `mini-app build` also packages it into `dist/package/`, and
`mini-app install` puts the package into a running Localix. Inside Localix, look at the result with
the Browser tool on `mini-app:habit-tracker`; the workbench replaces the UI in place.

How a Localix mini app works: it is never used alone. Beside it is the chat with the agent — you —
which reads the photos, screenshots, PDFs and files the person attaches, understands free text in
any language, knows the world and calls every enabled mini app's tools. So the MINI APP keeps the
state, shows it and gives the agent tools to read and change it; the AGENT does the understanding.
Build no upload, model, vision, OCR or LLM call, text parser or API key into the mini app. Design
each tool for the agent to fill with structured input it extracts (a meal photo becomes log_meal({
items: [{ name, grams, kcal, protein, fat, carbs }] })); the app validates, stores and sums. The
screen's empty state tells the person what to do in chat ("attach a photo of your meal and ask to
log it"). Never stop to ask how the app should reach a model or an image: you are that model.

The app layer — every name below is exported by the SDK the check types against:

- shared/model.ts — the contract both sides import: zod schemas of an item and of its input, and the
  pure logic (totals, grouping, what the agent is told). Write it FIRST; everything else follows
  from it.
- backend/<items>.ts — defineCollection({ name: 'meals' (lower-kebab), item: mealSchema, input:
  mealInputSchema (a z.object), create: (input, { id, now }) => ({ ...input, id, at: new
  Date(input.at ?? now).toISOString() }) (kept in UTC; sort by Date.parse, never as text), scope:
  'app' | 'chat', limit, search: (meal) => `${meal.name} ${meal.note}` }) from
  @localixai/mini-app-sdk/backend. 'app' keeps it across chats under ctx.dataDir; 'chat' gives each
  chat its own, deleted with the chat. search makes it findable by meaning.
- backend/index.ts — export function register(ctx) { const app = createMiniApp(ctx); const meals =
  app.collection(mealsSpec); return app.registration({ tools: createTools(ctx, meals), routes }) }.
  That mounts GET/POST /rpc/<app>/<collection>, PATCH and DELETE /<collection>/:id (each answering {
  items }), the feed that updates an open screen the moment a tool writes, and the semantic index.
  routes is an optional new Hono<MiniAppRouteContext>() for anything else (a settings read, an
  action); a route that takes a body uses jsonBody(schema). register(ctx) runs more than once: keep
  state in collections, never in a module variable.
- A collection in code: await meals.list(where?), get(id, where?), add(input, where?) → the item,
  update(id, patch, where?) → item | null, remove(id, where?) → boolean, search(text, { limit }) →
  items nearest in meaning. where is { sessionId } for a 'chat' collection: a tool passes the
  session.id of execute's fifth argument.
- backend/tools.ts — ctx.defineTool({ name: '<snake>_<verb>', label, activeVerb, description,
  inputSchema: the shared input schema with a .describe() per field — mealInputSchema.extend({ name:
  mealInputSchema.shape.name.describe('…') }), never a looser copy, so the agent is shown the limits
  the collection keeps — executionMode: 'sequential' for a write or 'parallel' for a read, mutates,
  classify: () => ({ effect: 'host' }) for a write or ({ effect: 'read' }), permissionPaths: () =>
  [], async execute(_toolCallId, input) { return { content: text } } }). Answer with what changed
  AND where things stand (today's total, what is left), so the agent can tell the person in one
  line; return { content, isError: true } only when the input was wrong and nothing happened. Give
  the agent a tool for everything the person can do on the screen.
- Settings the person changes: "config" in .localix-mini-app/mini-app.json ({ "DAILY_GOAL": { "type": "string",
  "title", "description", "default": "2000" } }); the backend reads ctx.config.DAILY_GOAL, parsed
  with a fallback, and the screen reads it through a small route.
- ui/App.tsx — export function App({ active, publishMessageContext }: ScreenProps). const meals =
  useCollection<Meal, MealInput>({ app: APP, name: 'meals', item: mealSchema, active }) from
  @localixai/mini-app-sdk/ui/app gives { items, loading, error, sending, add(input), update(id,
  patch), remove(id) }; each change resolves to the new list or null (error says why). Another
  route: usePolledSnapshot({ path: `/rpc/${APP}/settings`, schema, intervalMs: null, active }) from
  @localixai/mini-app-sdk/ui/route-snapshot. Anything derived from time: useNow(60_000, active) from
  @localixai/mini-app-sdk/ui/now. Compute what the screen shows with the SAME shared function the
  tools use.
- Tell the agent what the screen shows: useAgentContext(publishMessageContext, active && !loading, {
  label, content }) with the text the shared logic makes; it is cleared when the tab hides. A failed
  read: const problem = useScreenProblem({ app, subject, failure: meals.error, showingData }) and
  {problem && <ProblemLine {...problem} />} (ProblemLine from
  @localixai/mini-app-sdk/ui/components).
- ui/register.tsx — export const registerUi = screenUi({ app: APP, title, label, keywords, Icon
  (lucide-react), Screen: lazy App, loading: <LoadingHint>…</LoadingHint>, agentContext: {
  description, tools: [the tool names], nextSteps: [when to call which] }, scope? }). scope: 'chat'
  gives every chat its own tab, for a 'chat' collection.
- Tests (bun:test) through what the agent and the screen do, from
  @localixai/mini-app-sdk/backend/testing: await using ctx = await testMiniAppContext({ name: APP,
  config? }); const registration = register(ctx); await callTool(registration, '<tool>', input) → {
  text, isError }; await requestRoute(registration, 'GET', '/meals') → { status, json }. Test the
  shared logic directly. A mini app's own tests cannot render the screen: keep its logic in shared
  functions and test those.

When the app needs more (backend only; each answers when the host cannot, so keep a fallback):

- A small, frequent judgment the app makes itself (which column, which of a few options): await
  decide(ctx, { userId, sessionId, purpose: 'triage', state: { …facts }, question, options: { todo:
  'Not started', done: 'Finished' }, fallback: 'todo' }) → { pick, by: 'model' | 'fallback' } from
  @localixai/mini-app-sdk/backend. It bills the person's chat; never call a model of your own.
- Order items by meaning: await rankByMeaning(ctx, query, items, (item) => text) → { items, by:
  'model' | 'fallback' }, on this computer's embedding model, free. A collection's own search(text)
  already does this for its items.
- Hand something to the agent from a route (a button that needs judgment, a watched value changed):
  await askAgent(ctx, { userId: c.env.userId, sessionId: c.env.sessionId, message, tools: [your
  tools], key }) → { status: 'delivered' | 'missed' | 'refused' | 'failed' }; the screen sends
  ?sessionId= from useWorkItemSessionId() and registers with scope: 'chat'. Never from your own
  tool: the agent would wake itself.
- Live data that is not a collection: a wsFrames entry in app.registration({ backend: { wsFrames }
  }), followed with createRealtimeFeed/useRealtimeFeed from
  @localixai/mini-app-sdk/ui/realtime-feed; files with ctx.watchPath, never node:fs.watch. A
  command: Bun.spawn and readProcessOutputWithTimeout, never a synchronous call — the backend runs
  inside Localix and a sync call freezes it.
- A notice to the person: toast.success(…) or toast.warning(…) from @localixai/mini-app-sdk/ui.

Design — a polished product screen, not a form. Decide it before writing, the way the template's
ui/App.tsx and ui/parts/ do. The squint test: blurred, the eye still finds the one number that
matters, then its breakdown, then the items.

- One headline: that number (today's kcal, this month's spend) at text-3xl font-semibold
  tabular-nums in the screen's own font (monospace is not a style for numbers), its goal and unit
  beside it in text-xs text-text-faint, inside a ContextRing (@localixai/kit/context-ring, fraction
  0–1) or above a ProgressBar toward the goal. Then its history: TrendChart from
  @localixai/mini-app-sdk/ui/stats-charts, the last 7 or 30 days. Never a row of identical stat
  tiles.
- Group by space and dividers, not boxes: at most one container level (a rounded-lg border list with
  divide-y divide-border-faint), never a card in a card. Tight inside a group (gap-1 to gap-2),
  generous between groups (gap-6).
- A row: the title text-sm font-medium, a meta line (time · category) text-xs text-text-faint, the
  value right-aligned tabular-nums with its unit muted, an IconButton to remove; text in a flex row
  gets min-w-0 and truncate.
- Colour is meaning, never decoration: host tokens only; text-status-success on track, -warning near
  a limit, -error over it, always beside words or a number. No gradients, glow, glass, thick side
  stripes or emoji (icons are lucide-react).
- Words: a button says verb and object ("Log meal", never "Submit"); one name per thing across the
  screen, the tools and guide.md; an error says what failed and what to do.
- Layout: an @container root that scrolls on one axis (h-full min-h-0 overflow-y-auto) and fills its
  pane — no centred max-w column — with px-4 py-5. It may be 360px wide: one column until @lg, then
  columns side by side; reflow, never shrink the text.
- States: LoadingHint while loading, controls disabled while a change is sending, StateNotice with
  an icon when empty, saying what to do in the chat. Never sample or placeholder data: every number
  comes from the shared logic over real items.
- An icon of its own: `mini-app icon <folder> --glyph '<path d="…"/>'` draws the glyph (24×24,
  stroke, lucide style — the same icon as Icon in ui/register.tsx) on the store tile into icon.svg.

House rules:

- The entries keep their path and export: .localix-mini-app/mini-app.json, guide.md, icon.svg, backend/index.ts,
  ui/register.tsx. `.localix-mini-app/mini-app.json` names the app, its settings (`config`) and its backend
  (`./backend/index.ts`; the package's copy names its bundle under `dist/backend/`). `guide.md`
  tells the agent which tool does what and what to tell the person. A mini app holds no Claude Code
  plugin — no `skills/`, `.claude-plugin/` or hooks.
- What the template's own domain was (shared/model.ts, shared/model.test.ts, backend/entries.ts,
  backend/settings.ts, backend/tools.ts, backend/index.test.ts, ui/App.tsx, ui/parts/) is replaced
  by this app's; `mini-app check` names any of it that is left.
- Build every control from the kit and colour with host tokens; `mini-app check` reports a raw
  `<button>` or a palette class with its line. `KIT.md` lists each kit module by the job it does —
  look there before writing a control. No file over 300 lines.
- Every contributed id stays namespaced `habit-tracker:`; tool names stay unique across mini apps.
- `tsconfig.json` and `KIT.md` are written by every check; do not edit them. The SDK's declarations
  under the `paths` of `tsconfig.json` are the contract of every call above, and you may read them.

Imports: the backend may use hono, zod, @localixai/mini-app-sdk/backend,
@localixai/mini-app-sdk/navigation, @localixai/mini-app-sdk/resource-refs,
@localixai/mini-app-sdk/session-resource, @localixai/mini-app-sdk/typed-error,
@localixai/mini-app-sdk/prerequisite, @localixai/mini-app-sdk/rich-text,
@localixai/mini-app-sdk/document-layout, @localixai/mini-app-sdk/store-changes, node:_, bun:_ and
its own files; tests also @localixai/mini-app-sdk/backend/testing. The screen may use React, zod,
lucide-react, @localixai/mini-app-sdk/ui* (not /ui/testing) and the host kit `@localixai/kit/<id>` —
the ids KIT.md lists. Nothing else resolves. Everything you need is in this folder and this message;
do not search the disk for SDK or kit sources.

## This app: Habit Tracker

Two collections, both `scope: 'app'`: `habits` (`{ id, title, days, categoryId }`) and `categories`
(`{ id, name }`). `categoryId` is a category's id or `null`; one that points at a deleted category
reads as `null`, so the generic collection routes can never leave a habit in a category that is
gone.

- `shared/model.ts` is the contract. Its habit schema also reads the first version's
  `category: 'health' | … | 'other'`: each key is the id of a seeded category (`SEED_CATEGORIES`),
  `other` or none is `null`. Keep that migration for as long as such a file can exist. The stored
  file moves to the new shape on the next write.
- A change is parsed as a partial of the input schema, so that schema must have **no defaults**: a
  default would reset the days when a category changes, and the category when a day is marked.
  Defaults live in `create` (`backend/habits.ts`).
- `backend/categories.ts` seeds the default categories once, when `categories.json` does not exist.
  `register(ctx)` runs more than once; the seed is queued in the store before it returns.
- The collection routes accept any name and know nothing of the habits in a category. The rules
  (unique names, unlinking on delete, an existing category) are in `backend/category-actions.ts` and
  `backend/habit-actions.ts`, used by the tools and by the screen's routes in `backend/routes.ts`;
  the screen reads the collections and writes through those routes.
- A habit added without a category asks the decision model (`backend/category-choice.ts`), with the
  current categories as options; no answer leaves it uncategorized and says why.
