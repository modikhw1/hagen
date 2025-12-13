# Fingerprint System Diagnostic Questions

> **Purpose**: Identify gaps, validate assumptions, and calibrate the fingerprint system toward 90% accuracy.
> 
> **How to use**: Answer each question with your actual expectations. Use ✅ (valid), ❌ (wrong assumption), or 🔶 (partially correct, needs refinement). Add comments in the `→ Your response:` sections.

---

## Meta-Layer 0: The Purpose & Scope

Before diving into technical layers, we need to align on *what problem we're actually solving*.

### Q0.1: What is a "good match"?
When the fingerprint system says "85% match," what should that mean in practice?

- **A)** The candidate video could be posted on the brand's account and feel native
Valid. Not only should it feel like it fits in thematically, emotionally or in terms of what makes sense (the size of business, the size of team for example would point towards replicability), it should also give a sense of excitement, which is in large parts what we are seeking for with the analyze-rate schema - a high quality sketch/concept for the particular brand.

- **B)** The candidate video creator could be hired to make content for the brand
Valid.

- **C)** The candidate video's *style* aligns, even if the topic/product differs
Valid. In it's current state, any type of content that gets a high rating should align with the feeling of the profile. Feeling could be the overall messaging, the age or cultural assumptions, the type of actors being used, the topics that are covered. A good match, where a concept takes place behind a bar, while to recipient business does not have a bar setup, is problematic. This is why replicability in general is an important metric. Other than the hassle of setting up a scene, editing, amount of actors, tougness to perform in a engaging way for the average service business, replicability is meant to figure out what concepts are likely to be replicated. Since we are doing café/restaurants/bars, we hope most content can be translated.

- **D)** Something else entirely?
Partially. A good match is based on the assumption that the sketch is good in itself, can be replicated somewhat easily, is actually "worth" buying (which includes freshness, before everyone else values, as well as proven viralability - likes relative to profile size etc, which hasn't been implemented yet). On top of that is closeness to brand fingerprint - themes, agreement in thought (Cultural, overall coolness posturing, themes taken, risk, humour types)


---

### Q0.2: Who is the end user of a fingerprint?
- A sales team comparing prospects to successful accounts?

Wrong assumption. The fingerprint is used from the service to match content with brands that are very likely to find the purchase worth it.

- A content strategist planning what videos to make?

Partially. The fingerprint is formed and stored by the service. The brand_profile chat function also helps mixing in the customers expectations, and the service takes accountability for this sentence - "If you want a humourous sketch that mixes well with your marketing flow, especially TikTok, and focusing right now on service businesses, you are very likely to enjoy our service and find the purchases useful as standalone uploads the trend and compete with other content". They trust the service for this.

- An AI system auto-matching influencers to brands?

Wrong assumption, not the functionality planned.

- You personally, evaluating potential collaborations?

**

→ Your response:

Overall, the goal is to get a really good understanding of a businesses' current goals, wants, attitude, current strategy, humour, themes, production ambition, business ambition/striving etc. The fingerprint for brands are then a set value, that can be matched with content uploaded and vetted by me or other users.

---

### Q0.3: What's the cost of a false positive vs. false negative?
- **False positive**: System says "good match" but it's actually not

If the system says good match, meaning that the video has a fingerprint that doesn't match the profiles, then a profile would purchase a concept/premise, view the content, and say "this doesn't match us/this is boring/this seems too advanced/this doesn't match the culture in where we operate/this seems like something we could have found for free browsing TikTok/This is heavily trend-bound/meme dependent/This isn't clever/This doesn't fit within our risk-assessment/This wouldn't get approved by our higher ups.

- **False negative**: System says "poor match" but it would've been great

This would lead to content uploads that don't get purchased. The quality of the uploads are ambitioned to be vetted in terms of strength clarity and overall replicability. A poor matchc would not get picked up or purchased, wasting time in adding postings to the marketplace/matchmaking service of content.

Which is worse? This determines how conservative or aggressive we should be.

→ Your response:

Both are not good. The first would lead to unhappy users/refunds, the other would make the data entry work, potentially using humans for input, wasteful.

---

### Q0.4: Should the system differentiate between "this brand SHOULD be like X" vs "this brand IS like X"?
Currently we only measure what a brand *is doing*. But maybe they're doing it poorly and the fingerprint shouldn't perpetuate that?

→ Your response:
This is a good point. The data we can mainly use would be the current postings, and especially the content mix and what type of videos are selected to be created. On TikTok, it's not expected for these brands to come up with the content themselves. A lot of inspiration (copying) is done, and this means that the overall taste/intention can be seen on what is uploaded, despite it being done "badly" or not effectively. But with that said, the Brand-profile (brand discovery) function aims to fill the other side of that. The brand fingerprint asks questions about intention, what the goal is. Although this function isn't entirely mapped out yet, the aim is to match that function to the fingerprint structure, making it so that profile/videos/written intention is combined.

So to answer the question. It can be differentiated if it creates more depth. Offering concepts that entire match the customer, without an "upwards" intention (Basically improving the profile with better content), may not be the best strategy. Undestanding what the brand should or 'could' be, it could lead to some smart recommendation to really make the purchases worth it.

---

### Q0.5: What distinguishes a brand's fingerprint from a single video's analysis?
If I have 10 videos, what emerges at the profile level that doesn't exist at the video level? Currently we average—but should we look for consistency? Range? Evolution over time?

→ Your response:

A brands fingerprint contains the general themes contained - humour, style, preferences, tendencies. A brands fingerprint should also (despite us not having implemented this) contain overall content-mix, also taking account the overall balance between humour and informative content/visually engaging food content (two examples I've seen a lot). This would create a need for some other type of analysis which isn't covered in /analyze-rate, since this only takes the service content recommendation system in priority (is it good or bad?).

A brands fingerprint would also contain bio, follower count, size of team, overall seriousness (meaning how important is a successful content-strategy? This has to do with the survival-idea mentioned in legacy models)

Overall, a brands fingerprint would combine what the owner or content-responsible person for the brand would say about the brand and it's social media presence, as well as subconcious or unsaid things that also affect, including for example ability to create good content (no owner would say "I don't have skills in making good videos").

A video level fingerprint would do it's best to guess all of the above, but focus mainly on the /analyze-rate mechanism to figure out: Is the video good for the marketplace (can it satisfy a vast amount of businesses with high likelyhood), and does this video fit a brand? Many of the values mentioned above can only be alluded to, seeing what is in the actual video. But with enough data point I hope it's possible to get close.

---

## Layer 1: Quality & Service Fit

The first layer assesses whether content is "good" from two angles: (a) useful for your service, and (b) well-executed objectively.

The layer is first because it is the core assumption that needs to be satisfied to go on the marketplace. It needs to be relevant first and foremost. The L1a is useful, and L1b is mainly there to say that: Yes, content that isn't the best for the service can still have viralability. For example content creators without a service business focus, or very edgy and non-safe humour etc. The core difference could be

L1a: Makes sense for the service, fits the mold and has viralability potential (perhaps crossing with actual viral data - likes or shown growth). Of course, the L1a doesn't 'need' to have proven viralability (although this would be good). The reason being that additions to the marketplace is meant to be inserted by real people, vetting and adding good quality content before virality if possible. This makes the USP that content is provided early before other's have gotten to it.

L1b: It has gained virality, or is relatively viral for a profile (likes to follower ratio, meaning explosive growth outperforming profile size. This is an example, just inspiration to what could be used.)

### Q1.1: What makes a video "excellent" vs "good" vs "mediocre"?
Current mapping: excellent=0.9, good=0.7, mediocre=0.5, bad=0.3

Can you articulate the criteria you use when rating? Is it:
- Virality potential?
- Production polish?
- Message clarity?
- Authenticity?
- Something hospitality-specific?

→ Your response:

The videos I deem to be excellent is a concept that usually: Isn't too short, doesn't require too many actors, isn't to simple or one-shot, has a creative sketch or clever joke, not too heavily reliant on props, fun and engaging towards a broad target audience, some edginess/meanness to it (making it less dry), an assumed virality potential, mostly set in the environment (showing off the backdrop), not too obvious/expected, usually absurdist.

The excellence comes from the above, where production polish or performances isn't the most important. When using the service, a standalone sketch can be purchased that is meant to be recreated. For this reason, it would only matter in the stage of buying it, getting to see the original sketch. This would be the reason to have it be high quality, to "sell" it to the user, even if it's expected to be buy first see later.

Good would be acceptable, but assumed to have a less universally fitting idea. The concept may be less creative, have a replicability that requires hassle, too short or too long (usually less than 5 seconds, more than 30s).

Mediocre would be generally boring, or just fall flat in many of the criteria listed above.

Bad would be the same as mediocre, but have an element that makes it unusable. Maybe a theme that is too dark/risky, or playing on sexual themes. 

---

### Q1.2: Are you rating the *video* or the *brand behind it*?
A great brand can make a mediocre video. A nobody can go viral once. Which matters more for fingerprinting?

→ Your response:

Fingerprinting would work the same hopefully for both types of videos. The idea of storing fingerprint values for both, and then matching the relevant aspects of the fingerprint with the users of the service, is the goal.

If the video fingerprint works as intended, the brand will not matter exactly, other than the features of the brand that is expected to matter to the user. Meaning that the brand doesn't matter, but the aspects that the user is expected to recreate/form an opinion about, would be relevant. The video and it's core qualitities, mentioned in Q1.1 would be most valuable.

---

### Q1.3: Should quality be relative to category or absolute?
A "high-production" TikTok from a small café is different from a hotel chain's polished ad. Do we grade on a curve, or is there a universal standard?

→ Your response:

No, the assumption is that there is an universal standard. Especially in regards to good concepts aimed for the service, not being reliant on production value. A small business that puts a lot of effort in production would likely enjoy being recommended content from businesses that have that down as well, but would be too bothered by not having that.

---

### Q1.4: The current L1 split (Service Fit vs Execution Quality) assumes they're separate.
**Service Fit**: "Is this style useful for our clients?"
**Execution Quality**: "Is this well-made regardless of style?"

Is this distinction valuable? Can a video have high execution but low service fit, or vice versa?

→ Your response:

I mentioned this earlier. The "well-made" regardless of style would perhaps find a place on the marketplace, but would be seen by brands that value that style or theme. The aim of the service is to provide balanced and strong concepts that many would enjoy. The other variants, for example quick and easy meme-based concepts, can be found scrolling TikTok and doing the normal - finding inspiration on the site and recreating it.

---

### Q1.5: Execution Quality is computed from 4 signals:
- `execution_coherence` (35%) – message clarity
- `distinctiveness` (35%) – stands out from generic content
- `confidence` (15%) – presenter confidence
- `message_alignment` (15%) – personality matches message

Are these the right signals? Wrong weights? Missing anything?

→ Your response:

Execution coherence: I'm not sure exactly what this would entail. In general, a hindrance to effective content is either that it's boring, doesn't have a good hook, isn't creative or exciting, has a weak payoff, confusing concept, playing on inside jokes etc. This can be used as a value, but I don't know what it represents. Any weighing would have to be found somehow I can't direct right now.

Distinctiveness: Not having it be boring, too short, too reliant on inside jokes/culture-specific themes, is the most important. Distinctiveness could include how many times the video has been seen by users. This type of data could be searched for (scraped), but we assume that it's hard and not accessible right now. One idea was to add a field later, when the content-input agent adds a concept, asking "have you seen this before? If so, how many times". This would add another layer to this metric. But yes. If this value is important to weed out what is not useful, it's useful.

Confidence: Perhaps, I'm not sure.

Message Alignment: Perhaps.

Execution quality, if we're talking production value, can also include editing skill or quality, color quality, audio quality etc.

---

### Q1.6: Quality currently has no engagement data (views, likes, shares).
Is "proven virality" a signal we should include? Or is it noise (luck, timing, algorithm)?

→ Your response:

Yes. It has not been included yet, but can add another dimension. It has not been implemented to create initial clarity for the original algorithm - favoring good quality content without taking meta-data into account. It is definitely timing, luck, algorithm etc.

An initial goal was to make possible 'arbitrage' of content - making it so that videos in one country (e.g Sweden) would be translated to another (e.g Finland), by assuming that the users of both countries are isolated from the other. Engagement data for smaller markets could then be more useful, than the main "for you" algorithm.

---

### Q1.7: How stable should quality be across a brand's videos?
If a brand has 3 excellent videos and 2 mediocre ones, should the fingerprint:
- Average them (current approach)?
- Weight toward the best (aspirational)?
- Flag the inconsistency as a risk?

→ Your response:

The important thing for brand fingerprint isn't the quality in terms of sketches/ideas. It is mainly the type of content they enjoy or have stated to enjoy. But, for the sake of matching brand fingerprint - video fingerprint, it can just create an average or aspirational. It can also just keep track of all of it, saying that it generally goes for x or y, having a somewhat strong baseline and likely putting a lot of effort into their content strategy.

The quality is more important in matching videos to brand. There the quality metric makes sense, as it is used to filter out bad content and not recommend it towards brands.

---

## Layer 2: Personality & Likeness

This layer captures *who the brand is* if it were a person—tone, humor, positioning.

### Q2.1: The "personality as a person" metaphor—is it useful?
We describe brands as having energy, warmth, formality, etc. But does a restaurant have a personality, or does the *owner/content creator* have one?

→ Your response:

The abstraction isn't good in practice, as the brand is an invention that is meant for the audience to attach meaning to. The personality of an individual has similarities, as different traits are related to differently. Generous, intelligent or creative people can draw others in for various people, where instead selfish, low effort and "non-threatening" (safe topics, not being up to trend, not competing for business growth generally)individuals may not be granted attention or attraction.

The brand will have some intentional traits, and some unintentional. Based on the overall impression, general content engagement satisfaction, thumbnails, actors performance, video quality, energy and personality of the brand (everything we're talking about), the social media users will relate to it. Even the users have a free flowing function of discernment, relying on cultural imprints and overall expectations from comparing to other creators. Meaning that there is comparative relating, not absolute rating.

The owners intentiton mixes with ability and understanding of the audience expectation.

---

### Q2.2: How many dimensions actually differentiate brands?
L2 currently has 20+ fields. In practice, how many matter for matching? Could we reduce to 5-7 "core" differentiators?

→ Your response:

Yes and no. If it's focused, there is no problems with sharpening the criteria to fewer differentiators.

---

### Q2.3: The tone metrics (energy/warmth/formality) are 1-10 scales.
What's a meaningful difference? Is 6 vs 7 energy distinguishable, or is it noise?

→ Your response:

I'm not sure what improvements can be made.

---

### Q2.4: Humor is heavily weighted but optional.
Not all hospitality brands use humor. Is the system biased toward funny content? How should we treat brands with no humor presence?

→ Your response:

For the intended channel, TikTok, a big part of our target audience uses humor. In fact, the service is built towards brands that want just that, and it is positioned as such. The reason is that high quality entertaining clips, with a comedic effect, has a unique way of penetrating the noise.

The system may need to take other types of content into account. The analyze-rate is strictly a humor type/rating tool, which doesn't mesh well with profiles that have a mix of humor, meme, informative & visually engaging posts. This mix of content may still be relevant to understand, since it can give some insight into how the brand thinks. It's not common to have a fairly big and professional brand page with only humor. At the same time, the service is meant to give concepts that can be used when needed. In it's current form, the service doesn't promise or market a complete social media mix.

---

### Q2.5: `age_code` (younger/older/balanced) is a proxy for audience.
Is this the right signal? What about urban/suburban, income level, cultural background?

→ Your response:

This metric is mainly about what type of humor/themes will be relevant for what audience. The concepts I have graded as being excellent has an engaging premise/theme/style for people between 15-45. Absurdism tend to do well here.

Within the younger audience, many teens enjoy simple and to the point meme formats, often with a POV text overlay establishing the premise, and having support of a TikTok "sound" as well as a short clip with simple acting. These are simple to replicate, have a quick and easy payoff, and usually uses attractive people in them. These tend to be very quick and 'vapid', making them not the most memorable or in extension - not creating room to relate a (positive) feeling towards the profile.

Themes that seem somewhat popular with younger people, but not only teens, is work drama/gossip, relationships/mating, power structures at work etc.

What seems to work for most is sketches that seem somewhat effortless (not too much planning for the script for example), but with a humorous twist that mixes between meanness, a simple misunderstanding, someone tricking someone else etc. Simple human dynamics played out in a service environment, that is still "safe" but with some dynamics that are more mature or contain some dramatic element.

Cultural background and income is normally matched through user viewing numbers, meaning that any focus for a brand would attract those viewers. This data is likely not relevant to track.

---

### Q2.6: `accessibility` (everyman/aspirational/exclusive/elite) seems crucial.
How well is the AI detecting this? A fancy restaurant trying to seem approachable—how should that tension be captured?

→ Your response:

It would be the language, themes and clothing/grooming/backdrop. I'm not sure about this variable in general, but in general, I would say that any content that is aimed to do well on TikTok will always be accessible, or trying to be.

---

### Q2.7: `edginess` might be the most subjective signal.
"Safe" vs "provocative"—these judgments vary by culture, generation, context. How do we calibrate?

→ Your response:

I think this signal shouldn't be viewed as very subjective. I'm sure if there is some analysis done online, there should be a vast array of data sources describing what type of themes may or may not be deemed as safe for a brand with certain expectations.

There are notes within the /analyze-rate data collection that speak on what type of videos may not work. But in general, hateful or explicitly sexual themes may not work well. Flirting but in a restrained way can sometimes work. And sometimes relationship dynamics are being alluded to, instead of actually shown as a real dynamic.

When a concept is centered around work environment dynamic, some themes may not be good if not shown to be clearly absurdist or ironic. If the team is shown to be incapable, hateful, non-serviceminded, unrespectful - these are generally not good. It also depends on the type of brand and it's size, assuming that bigger brands or companies need to be restrained while smaller profiles may take bigger risks.

---

### Q2.8: `traits_observed` is a freeform array (e.g., ["friendly", "quirky", "confident"]).
The AI generates these, but they're not standardized. Should we have a controlled vocabulary?

→ Your response:

These are ok. I have no problem with this, but if traits/tags are added, perhaps there should be a deeper system in place. This is something that can be iterated.

---

### Q2.9: How do we handle brand evolution?
A brand's personality can shift. Are we fingerprinting "current state" or "core identity"? Should older videos be downweighted?

→ Your response:

I think brand personality should be calculated at the time of the fingerprint creation. If the user wants to append data, he/she can interact with the profile analysis tool once again.

---

### Q2.10: What's the relationship between personality and performance?
If a brand is warm but their warm content underperforms vs. their edgy content—which defines them?

→ Your response:

I don't think this is an important off-case. One is assuming that the profile using this service will find it easy to go one way or the other, wishing or asking the brand profile to track changes in intention, which perhaps adds another dimenson to the fingerprint (desire vs current).

---

## Layer 3: Production DNA

This layer captures visual/audio execution style—production investment, effort, format consistency.

### Q3.1: Is production style actually differentiating?
Many TikToks share similar iPhone-shot, natural-light, talking-head formats. Does L3 add signal or just noise?

→ Your response:

---

### Q3.2: "Effortlessness" is a style choice, not a quality measure.
High-effort content made to look effortless is different from actually-low-effort content. Can the AI distinguish?

→ Your response:

---

### Q3.3: `has_repeatable_format` flags consistency.
Is format consistency a positive signal (brand recognition) or a negative one (boring/predictable)?

→ Your response:

---

### Q3.4: `social_permission` (how shareable is this content).
What makes content shareable vs. private? Is this about topic or presentation?

→ Your response:

---

### Q3.5: Should L3 capture platform-specific conventions?
TikTok vs Instagram vs YouTube styles differ. Is a "good TikTok" approach applicable to Instagram?

→ Your response:

---

### Q3.6: Audio is minimally captured (music/voice tone).
For hospitality content, does audio matter? Background music, ASMR food sounds, voiceover style?

→ Your response:

---

### Q3.7: We don't capture visual branding (colors, logos, graphics).
Some brands have strong visual identity. Others are just raw footage. Should we track this?

→ Your response:

---

## Aggregation & Computation

How signals combine across videos into a fingerprint.

### Q4.1: Simple averaging loses information.
If brand has 50% "witty" humor and 50% "wholesome"—we report both as dominant. But are they alternating, experimenting, or inconsistent?

→ Your response:

---

### Q4.2: Mode selection for categories can be fragile.
With 10 videos and 4 "entertain", 3 "inform", 3 "inspire" intents—we pick "entertain." But is 40% really "dominant"?

→ Your response:

---

### Q4.3: Video weights (quality × coherence) bias toward "good" content.
Should exceptional outliers be weighted higher, or does this bias the fingerprint away from the brand's typical output?

→ Your response:

---

### Q4.4: The embedding centroid is a single 1536-dim vector.
This compresses all semantic nuance into one point. Two very different videos could average to a centroid that resembles neither. Is this a problem?

→ Your response:

---

### Q4.5: Confidence score is just data completeness, not accuracy.
Having 100% of videos rated doesn't mean ratings are accurate. How should we differentiate "lots of data" from "reliable data"?

→ Your response:

---

### Q4.6: How many videos are actually needed?
Documentation says 5-10. But some brands are consistent (3 might suffice), others are varied (might need 20). How do we know?

→ Your response:

---

## Matching & Comparison

How we use fingerprints to find similar content or evaluate fit.

### Q5.1: Current match weights: L2 (35%) > Embedding (30%) > L1 (25%) > L3 (10%)
Do these reflect importance correctly? Why is L3 so low if production style matters?

→ Your response:

---

### Q5.2: L1 match penalizes quality differences.
If a 0.9-quality brand matches against a 0.7-quality candidate, they're penalized. But maybe the style matches perfectly?

→ Your response:

---

### Q5.3: L2 match uses humor overlap heavily (30%).
Non-humorous brands get a 0 here, hurting their match scores. Is this fair?

→ Your response:

---

### Q5.4: Embedding similarity is cosine on the centroid.
This treats all 1536 dimensions equally. Some might be noise. Should we reduce dimensionality or weight dimensions?

→ Your response:

---

### Q5.5: What's the minimum threshold for a "useful" match?
Currently 0.85 is "good." But is 0.70 still valuable? At what point is a match misleading?

→ Your response:

---

### Q5.6: Should we match fingerprint-to-fingerprint, or fingerprint-to-video?
A brand fingerprint compared to a single video is asymmetric. How should we handle this?

→ Your response:

---

## Data Sources & Ground Truth

The fundamental inputs that everything depends on.

### Q6.1: Human ratings are sparse.
How many of your 4 test brands' videos have been manually rated? Is the system flying blind?

→ Your response:

---

### Q6.2: Schema v1 requires GCS upload for video analysis.
Is every video being analyzed, or are some missing? How reliable is the AI analysis without corrections?

→ Your response:

---

### Q6.3: Corrections/overrides are rarely populated.
The system has a `human_patch` mechanism but it seems unused. Is the AI output being trusted blindly?

→ Your response:

---

### Q6.4: There's no feedback loop on matches.
We can't currently record "this match was good/bad" to tune the system. How critical is this?

→ Your response:

---

### Q6.5: Embeddings are generated by OpenAI's model.
These aren't hospitality-specific. A "cozy café" might be similar to "cozy living room" in embedding space. Is this a problem?

→ Your response:

---

## Test Case Calibration

For your 4 test brands (Cassa Kitchen, Kiele Kassidy, Steve's Poke, Bram's Burgers):

### Q7.1: What should the ideal fingerprint capture for each?
In 2-3 sentences, describe what makes each brand distinctive. This is your ground truth.

**Cassa Kitchen**: 
→ Your response:

**Kiele Kassidy**: 
→ Your response:

**Steve's Poke**: 
→ Your response:

**Bram's Burgers**: 
→ Your response:

---

### Q7.2: Which pairs should be "similar" and which should be "different"?
Draw the expected similarity matrix:

|  | Cassa | Kiele | Steve's | Bram's |
|--|-------|-------|---------|--------|
| Cassa | - | ? | ? | ? |
| Kiele | ? | - | ? | ? |
| Steve's | ? | ? | - | ? |
| Bram's | ? | ? | ? | - |

→ Your response:

---

### Q7.3: What would a "false positive" look like for each brand?
What kind of content would the system incorrectly flag as a match?

→ Your response:

---

### Q7.4: What would a "false negative" look like?
What content fits the brand perfectly but the system might miss?

→ Your response:

---

### Q7.5: If you had to pick ONE signal that best differentiates these 4 brands, what would it be?
(This helps prioritize what the system must get right)

→ Your response:

---

## Next Steps

After you complete this questionnaire:

1. **I will analyze patterns in your answers** to identify which layers need refinement
2. **We'll create ground truth annotations** for the test videos
3. **Build an accuracy test harness** that compares system output to your expectations
4. **Iterate on weights/signals** until we hit 90% alignment

---

*Document created: December 13, 2025*
*Last updated: —*
