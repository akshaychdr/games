# 3D characters and snakes

## Snakes

Procedural geometry in `scene3d.js`: tapered cylinder segments along a Catmull-Rom curve that follows the same bezier paths as the 2D game (`snakePoints` in `game.js`). Scale/diamond albedo textures are generated on a canvas at runtime.

## Kids

No external rigged glTF is bundled. During development, CC0 packs from Quaternius and Kenney were not available as a direct downloadable low-poly chibi with a license file suitable to commit in this environment.

Kids are **built from Three.js primitives** in `scene3d.js` (`ChibiKid3D`): low-poly body, head, limbs, optional topi (player 1 and 3) or lehenga skirt and hair (player 2 and 4). Animation is procedural each frame from the existing `poseFor()` states (idle bob, hop squash, scared arms, cheer, ladder climb, snake gulp).

If you replace them later, drop a CC0 `.glb` under `assets/` and update `CHARACTERS-LICENSE.md` with the author and license text.
