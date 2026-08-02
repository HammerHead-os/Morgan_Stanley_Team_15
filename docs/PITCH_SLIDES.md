# Love 21 · Code to Give — Pitch slide notes

Same arc: Love 21 → their ask → criteria one by one (impact as ESG).  
Written to land harder: problem → what we built → why it matters. Cut hedges.

**On the slide** = deck lines. **What to say** = spoken. Steal the sharpest line from each “what to say” if the deck feels thin.

---

## Slide 1 — Love 21

**On the slide**
Love 21 Foundation · San Po Kong  
Free sport, nutrition, and family support for neurodiverse people and their families  
#Somuchability — ability first, not deficit first  
They already do the hard work offline. The website was not pulling its weight.

**What to say**
Love 21 is a Hong Kong charity in San Po Kong. They run free sport, nutrition, and family programmes for people with Down syndrome, autism, and other forms of neurodiversity. Their brand is #Somuchability — lead with what people can do. The gap we were handed wasn’t “explain who they are.” It was: the offline work is strong, and the digital side wasn’t converting curiosity into money, time, or belonging.

---

## Slide 2 — The brief (what they asked for)

**On the slide**
Four asks from Love 21  
1. Stop losing people between “nice website” and “I gave / I signed up”  
2. Educate *and* make visitors feel what their community lives with — empathy, not pity  
3. Make it immersive and a bit game-like so people don’t bounce after one scroll  
4. Tell us who’s visiting, how long they stay, and what they actually do  

If we don’t hit these, we didn’t do the brief.

**What to say**
This is the scorecard they gave us. One: viewers become donors, volunteers, or families — not just readers. Two: don’t only teach facts about neurodiversity; get people closer to the lived experience of the people Love 21 serves. Three: gamified and immersive, so the site holds attention instead of feeling like a brochure. Four: analytics — who came, how long, what they clicked — so staff aren’t flying blind. Everything after this slide is us proving we hit those four, under each judging criterion.

---

## Slide 3 — Relevance  
*Did we actually address their challenge?*

**On the slide**
Relevance = mapped 1:1 to the four asks  
Ask 1 → Home role → Profile next action → gift / book / claim a shift  
Ask 2 → About story + “Walk the park” sensory playground + live Instagram  
Ask 3 → Scroll morph storytelling + volunteer points + redeemable rewards  
Ask 4 → PostHog on the pages + journey events in the backend  

Not a generic charity template. Their problem → our product surface.

**What to say**
Relevance is the unsexy question: did we build *their* thing? Ask one — conversion — is Home and Profile: you arrive as family, donor, or volunteer, and the profile doesn’t dump you on a dashboard; it pushes a next action. Ask two — empathy — is About: #Somuchability story, a sensory playground called Walk the park, and Instagram so the community is real people, not stock photos. Ask three — immersion — is scroll-driven image transitions plus volunteer points you earn and redeem. Ask four — analytics — is PostHog on the pages and journey events stored when people act. If a judge asks “how is this relevant,” the answer is: open the product and point at their four asks. We’re not adjacent to the brief. We are the brief.

---

## Slide 4 — Effectiveness and feasibility  
*Does it work? Can they run it?*

**On the slide**
Effectiveness  
You can complete the journeys today: donate, book a programme, claim a volunteer shift  
Donors get a story-back receipt — what the gift roughly paid for  
Milestone emails at 25 / 50 / 75 / 100% of a fundraising goal  
Feasibility  
Demo logins for carer, donor, volunteer, admin — staff can train without live data  
Email starts in console mode; flip to SMTP when ready  
Static front end + FastAPI API — no fairy-tale stack  

**What to say**
Effectiveness isn’t a slide title. It’s whether a stranger can finish the job. In the demo: give money and see a story-back line on the receipt. Book a programme with party size. Claim a shift and watch points move. When a fundraising goal crosses a quarter, half, three-quarters, or full, the system can fire a milestone email — so “I donated once” becomes “I’m still in the loop.” Feasibility: four seeded accounts, SQLite for the prototype, email that doesn’t need production credentials on day one. Instagram tokens stay server-side. A small team can run this locally, show it to board members, and grow into real hosting without rewriting the idea. That is what “feasible” means here — usable this month, not a vision deck.

---

## Slide 5 — Technical design and code completeness  
*Is there real software behind the pitch?*

**On the slide**
Not Figma dressed as a product  
Backend: people, households, registrations, donations, volunteer claims, prefs, journey events, fundraising goals, email outbox  
Profile API that changes with role  
About: scroll morph + sensory sim + Meta Instagram through our API  
Email module: templates, triggers, delivery log  
A11y in the top nav: text size, contrast, wave motion, image transitions  
Judges can log in. Empty screens don’t count as completeness.

**What to say**
Code completeness is where a lot of hackathon pitches die. Ours doesn’t. There is a real data model for households and money and shifts and consent. Profile isn’t one HTML page with fake numbers — it loads from the API and behaves differently for a carer vs a donor vs a volunteer. About’s Instagram feed goes through our backend so secrets aren’t in the browser. Emailing is a module with an outbox you can inspect, not a mailto link. Accessibility is in the main toolbar because our audience includes people who need it, and because burying it in a floating button was wrong. We’re honest about what production still needs — proper auth hardening, hosting ops — but the paths we claim are implemented and clickable. That is the bar.

---

## Slide 6 — Creativity and innovation  
*What did we do that a brochure site wouldn’t?*

**On the slide**
Creativity with a job  
Scroll story: images dissolve and reform as you move — education that feels like motion  
Walk the park: sensory overload you opt into — empathy you feel, not a paragraph you skim  
Volunteer loop: claim → points → redeem — soft gamification that rewards showing up  
Story-back receipts + milestone emails — trust mechanics, not decoration  
One person, many roles — family *and* donor *and* volunteer without three logins  

**What to say**
Innovation for us isn’t a buzzword slide. It’s the parts that make the four asks possible. Most charity sites educate with paragraphs. We made About move — the story images morph as you scroll — so people stay long enough to care. Then Walk the park: headphones on, sensory noise dialled up on purpose, so empathy is experiential. On the involvement side, volunteering isn’t a form that disappears into an inbox; you claim work, earn points, redeem rewards. Donors don’t get a dead PDF thank-you — they get a line about what the gift funded, and later emails when the campaign they joined actually moves. And we refused the trap of “pick one identity.” Real people around Love 21 wear more than one hat. The product lets them.

---

## Slide 7 — ESG  
*Social impact + governance (+ light environmental) — their sheet’s last criterion, in language partners already use*

**On the slide**
**S — Social**  
Dignity-first public face (#Somuchability)  
Families book free programmes; volunteers get a real loop; public meets members via Instagram and story, not pity copy  

**G — Governance**  
Published finance on About (income / spend made visible)  
Opt-in email prefs, journey logging, analytics so decisions aren’t vibes  

**E — Environmental**  
Digital engagement and static hosting where we can — less paper chase for the same relationships  
(We’re not claiming a climate product. We’re not wasting the E either.)

**What to say**
Judges call this social and environmental impact. We’re saying ESG because that’s how funders and boards already talk, and because it forces us to be specific. Social: the product treats neurodiverse adults and families as people with ability and schedules and community — programmes are bookable, volunteering is trackable, the About page refuses the tragic charity trope. Governance: money isn’t hidden — the site surfaces published finance figures — and emailing respects prefs, while analytics and journey events give Love 21 something to manage against. Environmental: modest on purpose. Moving thank-yous, updates, and engagement online, and shipping a light static front end, cuts needless paper and print cycles. The win isn’t a green badge. It’s a product that is socially responsible, governable, and not wasteful.

---

## Slide 8 — Demo (prove it)

**On the slide**
Show, don’t summarise  
1. Home → pick a role → Profile next action  
2. Donor gift → story-back on the receipt  
3. About → scroll morph → Walk the park  
4. If time: claim a shift / open email outbox as admin  
`http://127.0.0.1:8000`

**What to say**
We’re going to spend less time talking and more time clicking. Watch ask one on Profile, ask two and three on About, and ask four if we open analytics or the event trail. Interrupt us when something doesn’t make sense — that’s better than polite silence.

---

## Slide 9 — Close

**On the slide**
Love 21 asked for conversion, empathy, immersion, and visibility into users.  
We answered with a working Profile, an immersive About, gamified volunteering, email that follows the gift, and analytics.  
Judged under relevance, effectiveness, technical depth, creativity, and ESG — same product, five lenses.  
Questions.

**What to say**
One line: we didn’t pitch a vibe. We built the four things Love 21 asked for, and we can open them in a browser. Thanks — what do you want to pressure-test first?

---

## Demo logins

| Role | Email | Password |
|---|---|---|
| Family (carer) | `carer@chen.demo` | `love21demo` |
| Donor | `donor@demo.love21` | `love21demo` |
| Volunteer | `volunteer@demo.love21` | `love21demo` |
| Admin | `admin@demo.love21` | `love21demo` |

---

## If a slide still feels empty

Steal one of these as the big line on the deck:
- “Offline work is strong. The site was leaking people.”
- “Four asks. If we miss them, we failed the brief.”
- “Relevance = open the product and point.”
- “Empty screens don’t count as completeness.”
- “Empathy you feel, not a paragraph you skim.”
