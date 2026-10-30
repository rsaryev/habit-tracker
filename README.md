# Habit Tracker

Track daily habits, tick them off and sort them into categories of your own. Use the screen, or just
ask in the chat: "add a habit to read for 10 minutes", "mark running done", "create a category
called Finance".

A Localix mini app. Open **Habit Tracker** from the workspace overflow menu or the command palette.

## What it does

- **Today** shows how many habits are done, with the last seven days beneath.
- **Habits** are listed under their categories. Tick one, move it to another category from its row,
  or delete it (its history goes with it, after a confirmation).
- **Categories** are yours: add, rename and delete them on the screen or through the agent. A new
  install starts with Health & fitness, Learning, Wellbeing, Productivity and Relationships.
  Deleting a category never deletes its habits; they become uncategorized. Names are unique,
  ignoring case.
- A habit added without a category is sorted by Localix's decision model among the categories you
  have now. When it cannot answer, the habit stays uncategorized and the agent can set one.

## Tools

The agent works with the same data and rules as the screen.

| Tool                            | Does                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `habit_tracker_summary`         | Today, every habit with its id, the last 7 days, categories |
| `habit_tracker_create_habit`    | Adds a habit, optionally in a category                      |
| `habit_tracker_set_completion`  | Marks a habit done for a day, or takes the mark back        |
| `habit_tracker_set_category`    | Moves a habit to a category, or to none                     |
| `habit_tracker_remove_habit`    | Deletes a habit and its history                             |
| `habit_tracker_list_categories` | Lists the categories with their ids and sizes               |
| `habit_tracker_create_category` | Adds a category                                             |
| `habit_tracker_rename_category` | Renames a category                                          |
| `habit_tracker_delete_category` | Deletes a category, keeping its habits                      |

## Data

Two lists in the app's data folder: `habits.json` and `categories.json`. A habit points at its
category by id. Habits saved by earlier versions, which had one of six fixed categories, are read
into the matching default category (or none) and saved in the new shape on the next change; no habit
or day is lost.

## Development

`shared/` holds the model and the logic both sides share, `backend/` the collections, the agent's
tools and the routes, `ui/` the screen, and `guide.md` what the agent reads before it first uses the
app. The plumbing between them — routes, storage, live updates — is the SDK's.

`mini-app check` runs every check; `mini-app build` also packages it into `dist/package/`, and
`mini-app install` puts that package into a running Localix, which swaps it in place.
`mini-app pack` makes a catalog to share it.

MIT licensed.
