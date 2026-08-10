# Exercise Manifest — Next Move catalog (S11-01)

Reference for the Asset Designer. The exercise library (15 entries) is shared by
all quests; quests differ only in segment pacing (S11-01) — never exercise
content. All animation work targets the **AT-01 pose set**: `squat`, `reach`,
`stride`, `idle`. Each pose maps to the body's safest neutral representation of
the move; the table notes the floor/seat variation so rigs can be shared.

## Exercise catalog (15)

| #   | slug                     | name                     | category  | beginner variation                                             |
| --- | ------------------------ | ------------------------ | --------- | -------------------------------------------------------------- |
| 1   | wall-push-up             | Wall Push-Up             | strength  | Step closer to the wall for an easier angle                    |
| 2   | chair-squat              | Chair Squat              | strength  | Use a higher chair or a cushion to shorten the movement        |
| 3   | glute-bridge             | Glute Bridge             | strength  | Rest your hands on the floor at your sides for extra support   |
| 4   | bird-dog                 | Bird Dog                 | strength  | Lift only the arm or only the leg until you feel steady        |
| 5   | seated-leg-raise         | Seated Leg Raise         | strength  | Lift just a few inches or keep the knee slightly bent          |
| 6   | wall-sit                 | Wall Sit                 | strength  | Hold a higher position or for a shorter time at first          |
| 7   | march-in-place           | March in Place           | endurance | Touch each foot down without lifting the knee high             |
| 8   | step-touch               | Step Touch               | endurance | Walk the pattern instead of stepping, or slow the pace         |
| 9   | side-steps               | Side Steps               | endurance | Take smaller steps or walk side to side without bending as low |
| 10  | gentle-hops              | Gentle Hops              | endurance | March in place with a little bounce instead of hopping         |
| 11  | seated-march             | Seated March             | endurance | Lift only the heel, or raise the knee a small amount           |
| 12  | neck-shoulder-rolls      | Neck and Shoulder Rolls  | mobility  | Only roll the shoulders if neck rotation feels like too much   |
| 13  | cat-cow                  | Cat Cow                  | mobility  | Perform it seated with your hands on your knees                |
| 14  | seated-hamstring-stretch | Seated Hamstring Stretch | mobility  | Rest your hands on your thigh or a towel for support           |
| 15  | standing-quad-stretch    | Standing Quad Stretch    | mobility  | Hold your ankle with a towel or band for a longer reach        |

## Pose mapping — exercise → AT-01 pose

| slug                     | AT-01 pose | animation notes                                                                      |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| wall-push-up             | `reach`    | Upright torso, arms press forward toward wall (shoulder-height); no floor rig needed |
| chair-squat              | `squat`    | Full squat pattern from standing; hips to seat, press through heels                  |
| glute-bridge             | `idle`     | Floor pose: lying on back, knees bent; hips lift loop (10s–60s holds)                |
| bird-dog                 | `stride`   | All-fours; alternate arm/leg extension — diagonal stride line                        |
| seated-leg-raise         | `idle`     | Seated pose, chair support; alternating leg lift                                     |
| wall-sit                 | `squat`    | Half-squat hold with back against wall; static only                                  |
| march-in-place           | `stride`   | Standing step rhythm; knees lift, arms swing                                         |
| step-touch               | `stride`   | Side step + touch; light weight shift per beat                                       |
| side-steps               | `stride`   | Lateral travel, soft knees, low stance                                               |
| gentle-hops              | `stride`   | Small bounce alternation; feet stay near ground                                      |
| seated-march             | `idle`     | Seated pose; alternating knee raise                                                  |
| neck-shoulder-rolls      | `idle`     | Standing/desk-neutral; small head + shoulder circles                                 |
| cat-cow                  | `idle`     | All-fours arch/round cycle, breath-paced                                             |
| seated-hamstring-stretch | `idle`     | Seated pose, one leg extended; forward hinge + hold                                  |
| standing-quad-stretch    | `idle`     | Standing single-leg balance, heel to glute; hold                                     |

## Pacing rules (S11-01, applied by tier)

- **easy**: first work blocks 30–45s, rests 20–40s, static holds < 45s,
  stretches 60–90s — "I can do this" is the gate.
- **normal**: rests 30s, work blocks 90–120s.
- **hard**: work blocks 120–150s, rests 30–60s, single holds capped at 60s.
- **elite**: 60–90s work across **3 rounds** with 20s rests; difficulty from
  density (rounds), never from longer single holds.
- Every quest: warmup (1st segment) + cooldown (last segment), no zero-duration
  segments, totals within 480–900s (FR-QUES-7).

## Quest catalog (11)

| slug             | tier   | XP  | duration (s) | category   |
| ---------------- | ------ | --- | ------------ | ---------- |
| morning-stretch  | easy   | 50  | 480          | mobility   |
| first-steps      | easy   | 50  | 480          | endurance  |
| desk-break       | easy   | 50  | 480          | mobility   |
| home-circuit     | easy   | 50  | 600          | strength   |
| steady-flow      | easy   | 50  | 480          | discipline |
| power-walk       | normal | 100 | 720          | endurance  |
| core-basics      | normal | 100 | 600          | strength   |
| full-body-flow   | normal | 100 | 720          | mobility   |
| interval-boost   | hard   | 200 | 900          | endurance  |
| strength-builder | hard   | 200 | 900          | strength   |
| interval-peak    | elite  | 400 | 900          | endurance  |

Tier spread: 5 easy / 3 normal / 2 hard / 1 elite (11 quests, FR-QUES-7).
