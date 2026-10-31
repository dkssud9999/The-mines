# Gameplay research notes

These notes collect reusable ideas for the game's combat and weapon design. The goal is high fun and clarity with low implementation and maintenance cost.

## Difficulty target

- Normal should be moderately challenging and teach the patterns.
- Hard should be brutally difficult, with the full pattern set and tighter execution windows.
- Preserve the boss's identity in Normal; raise pressure through pattern density, overlap, and timing in Hard rather than relying only on health and damage.

## Transferable boss-design ideas

- **Keep a learnable attack order.** Supreme Witch Calamitas uses a consistent attack cycle that continues across health transitions and bullet-hell interruptions. Players can learn the next move instead of solving a random encounter every attempt. [Official Calamity wiki: Supreme Witch, Calamitas](https://calamitymod.wiki.gg/wiki/Supreme_Calamitas)
- **Change the player's movement problem between phases.** Calamity's Devourer of Gods rotates through close tracking, aggressive charges, and laser formations, while changing movement constraints such as gravity or flight. Infernum adds portal exits with visible direction tells and laser patterns with explicit gaps. [Calamity DoG](https://calamitymod.wiki.gg/wiki/DoG), [Infernum DoG](https://infernummod.wiki.gg/wiki/DoG)
- **Keep a pattern family consistent for one full sequence.** Infernum DoG chooses one laser geometry for an eight-round barrage, while a line across its portal marks the exit direction before its charge. The player can commit to reading one shape and one tell instead of tracking several changing rules at once. The current wall attack already locks a visible safe gap; preserve that rule if its density increases in Hard. [Infernum DoG](https://infernummod.wiki.gg/wiki/DoG)
- **Use phase pauses as tells.** Infernum Ceaseless Void briefly stops all attacks and shakes the screen before its final mobile phase. The pause gives the player time to recognize a real state change. [Infernum Ceaseless Void](https://infernummod.wiki.gg/wiki/Ceaseless_Void)
- A transition pause works best when paired with one unmistakable cue. The final boss now briefly halts at each health-gated bullet-hell transition, clears the old hazards, flashes a pulsing ring, and labels the transition before attacks resume. This borrows the readable pause cue without adding a new attack subsystem.
- **Let a repeated movement pattern evolve.** Infernum Dragonfolly repeats horizontal charges, then adds delayed lightning, explosive feathers, and more charge repetitions at health thresholds. The recognizable base move stays readable while later phases alter its consequences. [Infernum Dragonfolly](https://infernummod.wiki.gg/wiki/Dragonfolly)
- **Create an urgent optional target.** Infernum Plaguebringer Goliath's final phase builds a nuke while the boss keeps attacking; the player can destroy the nuke before its visible countdown completes. A single breakable objective creates a strong decision without needing a whole new attack system. [Infernum Plaguebringer Goliath](https://infernummod.wiki.gg/wiki/The_Plaguebringer_Goliath)
- **Make summoned targets affect the fight.** Calamity Providence's guardians each change a clear boss property, so players can choose which source of pressure to remove. This works better than adding passive targets with no tactical consequence. [Calamity Providence](https://calamitymod.wiki.gg/wiki/Providence)
- **Coordinate attacks in pairs.** Infernum Exo Mechs use paired attacks, side changes, predictive lines, and explicit attack intervals. This makes the combination itself the challenge. [Infernum Exo Mechs](https://infernummod.wiki.gg/wiki/Exo_Mechs)
- **Keep paired adds from firing on top of the boss's full pattern cycle.** Calamitas' brother phase makes the player manage two distinct attack styles and target priority. The Star boss's twin phase had accidentally combined both brothers' nearly simultaneous volleys with the boss's ordinary pattern and an extra radial burst. It now pauses the boss and alternates the brothers, with a visible aim fan or marked strike point before each volley. [Calamitas strategy guide](https://calamitymod.wiki.gg/wiki/Guide%3ASupreme_Witch%2C_Calamitas_strategies)
- **Add a persistent threat late.** Calamitas introduces a moving maelstrom at a late health threshold; the arena grows more demanding without replacing the learned attack cycle. [Official Calamity wiki: Supreme Witch, Calamitas](https://calamitymod.wiki.gg/wiki/Supreme_Calamitas)
- **Preserve a boss's place in its attack cycle through transitions.** Calamitas' attacks follow a fixed cycle; bullet hells pause it, then combat resumes at the expected next move. This gives the player a learnable rhythm even when a phase interrupts it. The strategy page also documents tells such as turning transparent before a charge. [Calamitas strategy guide](https://calamitymod.wiki.gg/wiki/Guide%3ASupreme_Witch%2C_Calamitas_strategies)
- **Use adds as a purposeful phase gate.** In Calamitas' later sequence, summoned brothers make her invulnerable until defeated; another threshold adds Soul Seekers that periodically fire while the boss remains active. Both create a target-priority decision with clear stakes. [Official Calamity wiki: Supreme Witch, Calamitas](https://calamitymod.wiki.gg/wiki/Supreme_Calamitas)

## Transferable weapon-design ideas

- Sephiria's September 2026 official update gives especially useful patterns: a special attack can immediately trigger an artifact; another upgrade turns an artifact into a no-cooldown orbiting effect; other upgrades replace a weapon attack, turn excess HP into temporary damage, or charge a resource through ordinary attacks before spending it on a broad slash. A separate official update also makes held basic attacks resume immediately after a special attack ends, avoiding a dead input beat. These create a weapon-specific loop while keeping its cadence responsive. [TEAM HORAY's official Sephiria updates](https://steamcommunity.com/app/2436940/announcements/)
- Keep each branch tied to a distinct action: projectile path, return behavior, attack cadence, area control, or a weapon-specific interaction with relics.
- Offer a small set of two or three well-explained branches here. A handful of memorable choices fits this project's maintenance and balance budget better than a large upgrade tree.
- Make an evolution visible on every use when it replaces the core attack. A rare alternate hit can read as a missed attack if its tell is subtle; the evolved action should have a clear silhouette, reliable cadence, and an effect that reaches the enemies it is meant to hit.
- Let a shared relic scale each weapon's own attack shape. For example, a split projectile relic can add a returning axe or wand bolt, while adding another short crescent to the Twin Scythe. This prevents the relic from being a no-op when the weapon already starts with multiple attacks.
- Keep a larger relic pool readable by making each item express one clear role and visible trigger. The current six additions are protection, speed, kill recovery, slow, burning-death blast, and a marked every-fifth attack.

## Current implementation opportunities

1. The one-time weapon evolution now offers three behavior-changing branches for each weapon after the first boss. The added options emphasize stronger return hits, broad projectile coverage, and a periodic long-range slash; the return-hit upgrade also gets a distinct glow.
2. The final boss keeps its recognizable multi-phase fight in Normal; reduce volley count or density there before removing signature phases. Preserve every attack branch for Hard.
3. Route rewards now have a clear tradeoff: the Shrine heals and offers three relics; the Elite fight gives no heal but offers four relics.
4. Loot previews now name the synergies a choice would complete and describe their effects. The activation toast only appears when a new synergy is formed.
5. A future low-cost evolution can trigger a held relic from a weapon's signature action. This would make relic loadout and weapon evolution interact without introducing a large upgrade tree.
6. For bosses, keep an attack sequence stable across phase breaks, then add one readable objective or lingering arena threat at a health threshold. This raises pressure and target priority while keeping the learned core pattern intact.
7. The Twin Scythe had been implemented as two long-range returning axes, making it feel like a weaker copy of the Boomerang Axe. Its core is now short-range paired crescents; its cleave evolution now changes every swing into a stronger, wider slash, and Split adds another crescent.
8. The Star boss's twin-add phase now pauses the boss's normal attacks and schedules the brothers in turns. Normal uses longer warning and recovery intervals with fewer bullets; Hard keeps a shorter cadence and denser volleys.
9. The relic pool now has 18 items, including new effects for defense, movement, kill healing, enemy control, burn explosions, every-fifth-attack damage, and weapon-specific attacks. New relics enter loot pools without requiring existing save data to be reset.
10. The Explorer final boss is now slightly below the previous Hard pressure, while Abyss retains that previous Hard baseline. Abyss and Collapse also step up ordinary-enemy speed/fire cadence and the pressure of non-final bosses.

## Recorded playtest follow-ups

These are tracked for playtesting and are not part of the current difficulty-profile change:

- Recheck whether the 200-unit enemy spawn buffer feels fair across every arena edge and stage; the fallback chooses the farthest sampled point if no candidate meets the buffer.
- Rebalance regular-enemy and boss health after several full runs at each difficulty, especially the final boss's long multi-phase health budget.
- Verify mobile controls on a real phone or tablet: touch versus mouse mode switching, fullscreen start, the 75% dynamic-center range, dash isolation, and repeated axe charging while held.

## Difficulty context

Calamity's Death Mode is a higher challenge layered on Master Mode, with more aggressive AI and substantially harder boss changes. Infernum explicitly reworks boss patterns, mechanics, phases, and visuals beyond Calamity's Revengeance and Death modes. [Calamity Difficulty](https://calamitymod.wiki.gg/wiki/Difficulty), [Infernum Bosses](https://infernummod.wiki.gg/wiki/Bosses)
