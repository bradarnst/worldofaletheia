# World of Aletheia

World of Aletheia is a fantasy worldbuilding website and evolving campaign platform. This glossary captures domain language only; implementation and architecture decisions belong elsewhere.

## Language

**Campaign Content**:
Anything inside of, or directly associated with, a specific campaign: campaign-owned source documents and referenced source assets. It excludes site-level Campaigns pages, global Campaigns explanation/about content, front-end UI/UX, authentication accounts, and membership records.
_Avoid_: campaigns content, campaign(s) content

**Campaign Content Item**:
A single Campaign Content document or referenced source asset with its own Content Visibility. It is the smallest campaign content unit that must be authorized before it is read.
_Avoid_: content record, content file

**Campaign Slug**:
The stable kebab-case identifier for a specific campaign, shared across campaign routes, campaign-owned content, and campaign authorization relationships. It is the foreign key that connects campaign membership to a campaign.
_Avoid_: campaign id, campaign key, campaign name

**Campaign Gate**:
The access boundary for entering a campaign-specific area. A Campaign Gate may allow the public or require Campaign Membership, but it is not the mechanism for GM-only secrecy.
_Avoid_: protected campaign, campaign permission

**Campaign Index**:
The site-level campaigns list that helps visitors discover available campaigns. It may show campaign titles even when entering a specific campaign requires Campaign Membership.
_Avoid_: cross-campaign index, campaign content index

**Campaign Membership**:
The relationship that grants a user access to a specific campaign as either a member or a game master. It is scoped to exactly one Campaign Slug.
_Avoid_: campaign access record, campaign permission

**Campaign Root Entry Point**:
The primary authored Campaign Content Item for a specific campaign. It introduces the campaign but does not by itself define the Campaign Gate.
_Avoid_: campaign homepage, campaign settings page

**Campaigns Presentation**:
The cross-campaign browser-facing surfaces that explain, navigate, or frame campaigns as a site area. It excludes any page, document, or asset that belongs to one specific campaign.
_Avoid_: campaign content UI, campaign source content

**Content Visibility**:
The cumulative access classification of a specific Campaign Content document or asset within a campaign boundary: public, campaign member, or GM-only. Public items are readable by everyone who passes the Campaign Gate, campaign member items are readable by members and game masters, and GM-only items are readable only by game masters.
_Avoid_: content permission, document gate
