"use strict";

/** Questions Sage must answer with the right tool (the action evals live in each action file). */
const READ_EVALS = [
  { ask: "Who owes me the most money?", expect: { tool: "dues" } },
  { ask: "How much has Bombay Saree Centre paid so far?", expect: { tool: "customer_summary" } },
  { ask: "What were our sales this month?", expect: { tool: "period_summary" } },
  { ask: "How many orders did we get in September 2026? List them all.", expect: { tool: "list_orders" } },
  { ask: "How do I record a payment in the app?", expect: { mentions: "/orders" } },
];

module.exports = { READ_EVALS };
