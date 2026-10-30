_Use: Keep the person's daily habits and their categories, mark habits done, and answer questions
about their progress._

# Habit Tracker

Habits are daily. Each can sit in one category, and the categories are the person's own: they add,
rename and delete them here and on the Habit Tracker screen. A new install starts with Health &
fitness, Learning, Wellbeing, Productivity and Relationships. A habit with no category is
"Uncategorized".

## Reading

- `habit_tracker_summary` shows today's progress, every habit with its id and category, the last 7
  days and the categories with their ids. Call it first whenever you need an id.
- `habit_tracker_list_categories` lists the categories with their ids and how many habits each
  holds.

## Habits

- `habit_tracker_create_habit` adds a habit from what the person says. Leave `categoryId` out and
  Localix picks one of the existing categories; pass an id to choose it yourself, or `null` for
  none. Tell the person which category the habit went to. When the answer says no category was
  picked and one fits, set it with `habit_tracker_set_category`.
- `habit_tracker_set_completion` marks a habit done or takes the mark back, by id, for a day in
  `YYYY-MM-DD` (today when left out).
- `habit_tracker_set_category` moves a habit to a category by id, or to none with `null`. Its
  history is kept.
- `habit_tracker_remove_habit` deletes a habit and all its history. Do it only when the person asks,
  for the habit they named.

## Categories

- `habit_tracker_create_category` adds one. Names are unique, ignoring case.
- `habit_tracker_rename_category` renames one; its habits stay in it.
- `habit_tracker_delete_category` deletes one. Its habits are kept, uncategorized. Do it only when
  the person asks.

Every change answers with where things stand, so you can tell the person in one line. A refusal says
why and changes nothing: an unknown id, a name already taken.
