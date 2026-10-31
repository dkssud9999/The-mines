# Project notes

## Goal
- Build a highly enjoyable, polished game while keeping implementation and maintenance manageable.
- Prefer the smallest clear change that creates a noticeable improvement in play.
- Avoid unnecessary systems, dependencies, abstractions, and content that increase bug risk.

## Working rules
- Keep the game playable and easy to launch. The current project is a self-contained `index.html`; preserve that simplicity unless a concrete need justifies changing it.
- Read the relevant code before editing and keep changes focused on the requested behavior.
- Prefer readable, local functions and data over clever or deeply coupled systems.
- When adding a mechanic, make its warning, response, and result understandable to the player.
- Keep Normal moderately challenging and make Hard brutally difficult; preserve boss identity in Normal and reserve full pattern breadth and tighter execution for Hard.
- When a feature is complete, keep exploring low-complexity ways to improve fun if the user has not redirected the work; share concrete discoveries while the user playtests.
- For combat and weapon ideas, prioritize research into Sephiria's weapon branches and Terraria Calamity's Master/Death and Infernum boss patterns.
- Do not add tests or run test suites unless the user asks. When asked to verify, use the lightest useful check and report what was checked.
- Summarize changed files, behavior, and any unverified risks at the end of each task.
- Treat direct player feedback as the strongest design evidence; preserve working feel while improving the reported issue.
