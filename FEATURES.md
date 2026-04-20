# BookManager Feature Roadmap

## ACE — AI Assistant

ACE is the in-app AI assistant powered by Snowflake Intelligence (Cortex Agents).
It currently has access to the following tools:

### Current Tools
- **Sales_Knowledge_Assistant** — Cortex Search over internal sales knowledge
- **Use_Case_Explorer** — Cortex Analyst: text-to-SQL over use case data
- **Sales_Data_Assistant** — Cortex Analyst: general sales data queries
- **Sales_Account_360_Data** — Cortex Analyst: account 360 view

---

## Planned Features

### [ ] Glean Integration for ACE
Give ACE access to Glean as a retrieval tool, enabling it to search across:
- **Google Drive** — account docs, decks, meeting notes
- **Slack** — conversation history, deal threads
- **Confluence** — internal wikis and playbooks

#### Planned Glean Skills
- **Global Account Engineering Drive** — index and search the AE team's shared Google Drive
  (`Global Account Engineering` folder) for assets like pitch decks, technical docs, 
  competitive battle cards, and onboarding materials

#### Notes
- Glean can expose a search API that ACE calls as a tool_resource (similar to Cortex Search)
- Skills should be scoped by folder/label to keep context tight and relevant
- Authentication: Glean OAuth or service account token stored in Snowflake secrets

---

## Completed
- [x] Snowflake Intelligence streaming chat (SSE proxy via `/api/agent/chat`)
- [x] NBA context auto-loaded into ACE on "Open with ACE" click
- [x] Upcoming go-lives linked to account detail page
- [x] Use Case tab split: My Use Cases / Other Use Cases accordion panes
