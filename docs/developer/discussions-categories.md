# GitHub Discussions categories

> How to enable Discussions and what each of the four categories
> is for. Discussions are an **admin-side setting** — the maintainer
> flips them on in the GitHub repo Settings → General → Discussions
> → "Set up discussions" / "Enable discussions". Once enabled, the
> categories below are the recommended configuration.

## Why Discussions?

GitHub Issues are for actionable work. Discussions are for
conversations that don't have a clear "ship it / close it"
trajectory — design debates, show-and-tell, Q&A that doesn't
need a code change.

Using the right channel saves a triage round: a maintainer
moving a "how do I…?" question out of Issues into Discussions
takes ~30 seconds but adds friction.

## Categories

The recommended configuration when Discussions is enabled:

### General

Anything that doesn't fit the others. Project announcements
from the maintainer, "what's the roadmap?" debates, requests
for opinions on naming or refactors.

### Ideas

Long-form proposals that need discussion before becoming
issues. The Ideas category is the right place for "we should
add a Voronoi generator" or "the store should split into per-
feature slices". When a thread reaches consensus, the
maintainer moves it to a feature issue and closes the
discussion.

### Show and tell

Levels built with the editor, plugins, Bevy projects that
consume an export. Screenshots / GIFs / videos welcome. The
maintainer often cross-posts interesting projects to the
README's "Real-world uses" gallery (planned).

### Q&A

User-to-user support. "How do I configure…?", "Why does this
crash?", "What's the difference between modes X and Y?".
Answers stay in the thread — there's no "fixed" state. The
maintainer pins frequently-asked questions at the top.

## When to use what

| Question / topic                                      | Channel                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| "How do I export to Bevy 0.19?"                       | Discussions → Q&A                                          |
| "I built an office with 10K objects — here's a video" | Discussions → Show and tell                                |
| "Add navmesh generation"                              | Discussions → Ideas (then issue)                           |
| "Editor crashes when I open this .morgan file"        | Issues → bug                                               |
| "Add a property to the Inspector"                     | Issues → feature                                           |
| "How does the undo system work?"                      | Discussions → Q&A (or read docs/developer/architecture.md) |
| "We should drop React 17"                             | Discussions → General                                      |

## Enabling Discussions (maintainer)

1. Go to `https://github.com/<owner>/<repo>/settings` → General →
   Features → Discussions → **Set up Discussions**.
2. Pick the four categories above (General / Ideas / Show and
   tell / Q&A) in the form categories dialog. The format
   suggestion field stays empty — there's no required template
   per category.
3. Pin the **Q&A** category with a short description: "User-to-
   user support. Issues are for actionable bugs and features only."
4. Add a one-line description to each of the other three
   categories explaining when to use them (the descriptions
   above are copy-paste ready).
5. Click **Done**.

The `config.yml` in `.github/ISSUE_TEMPLATE/` already
references Discussions via the `contact_links` section — the
"Get help" link in the new-issue form surfaces the Discussions
URL before the user types anything.

## Moderation

Discussion categories are moderated by the maintainer. The
moderation policy mirrors the [CODE_OF_CONDUCT](../../CODE_OF_CONDUCT.md):
be respectful, stay on topic, no marketing or spam.

Comments that should be issues get the "Convert to issue" button
in the comment menu. Comments that should be PRs get a `!`
mention asking the author to open one. Off-topic threads get
locked, not deleted (so the conversation is preserved).
